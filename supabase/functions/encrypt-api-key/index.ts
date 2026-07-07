// deno-lint-ignore-file
// @ts-ignore - Deno ESM import resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  openKv(): Promise<any>;
};
import {
  checkRateLimit,
  getCorsHeaders,
  callAI,
  getProviderModel,
} from "../_shared/promptHelpers.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req.headers.get("origin"));

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized access." }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return jsonResponse({ error: "An unexpected error occurred." }, 500);
    }

    // Validate the token and retrieve the user
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized access." }, 401);
    }

    // Rate Limiting: max 5 requests per user per minute
    const rateLimitCheck = await checkRateLimit(user.id, "encrypt-api-key", {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "validate") {
      // Live key check: make a minimal real call to the provider so the user
      // knows the key works BEFORE we store it. The key is never persisted on
      // this path and is never returned to the client.
      const candidateKey = String(body.apiKey || "").trim();
      const candidateProvider = String(body.provider || "").trim();

      if (!candidateKey) {
        return jsonResponse({ valid: false, reason: "Missing API key." }, 400);
      }
      const validProviders = ["openai", "anthropic", "openrouter", "gemini", "kimi", "glm"];
      if (!validProviders.includes(candidateProvider)) {
        return jsonResponse({ valid: false, reason: "Invalid provider." }, 400);
      }

      const provider = candidateProvider as
        "openai" | "anthropic" | "openrouter" | "gemini" | "kimi" | "glm";
      const candidateModel = String(body.model || "").trim() || getProviderModel(provider, "draft");
      const pingRes = await callAI([{ role: "user", content: "ping" }], null, candidateKey, {
        provider,
        model: candidateModel,
        temperature: 0,
        max_tokens: 5,
      });

      if (pingRes.status === 200) {
        return jsonResponse({ valid: true });
      }

      // Map common upstream statuses to actionable reasons. We deliberately do
      // not forward the raw provider error body (may contain noise/PII).
      let reason = "The provider rejected this key.";
      if (pingRes.status === 401 || pingRes.status === 403) {
        reason = "Key was rejected (invalid or revoked). Double-check you copied it correctly.";
      } else if (pingRes.status === 429) {
        reason = "Key is valid but currently rate-limited. Try again in a moment.";
      } else if (pingRes.status === 402) {
        reason = "Key is valid but the provider account has no remaining credits.";
      } else if (pingRes.status >= 500) {
        reason = "Couldn't reach the provider right now. Please try again.";
      } else if (pingRes.status === 404) {
        reason =
          "The test model isn't available for this key. The key may still work for generation.";
      }

      return jsonResponse({ valid: false, status: pingRes.status, reason });
    }

    if (action === "toggle") {
      const useOwnKey = body.useOwnKey;
      if (typeof useOwnKey !== "boolean") {
        return jsonResponse({ error: "Invalid request parameters." }, 400);
      }

      const rawKeyMode = String(body.keyMode || "").trim();
      const keyMode = rawKeyMode === "always" ? "always" : "fallback";

      // Upsert the toggle configuration in user_settings table
      const { error: dbError } = await adminClient.from("user_settings").upsert(
        {
          user_id: user.id,
          use_own_key: useOwnKey,
          key_mode: keyMode,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (dbError) {
        console.error("Database error during toggle upsert:", dbError);
        return jsonResponse({ error: "An unexpected error occurred." }, 500);
      }

      // Insert audit log using service role
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
      const { error: logError } = await adminClient.from("api_key_audit_log").insert({
        user_id: user.id,
        action: "toggled",
        provider: null,
        source: null,
        ip_address: ip,
      });

      if (logError) {
        console.error("Audit logging failed for toggle:", logError);
      }

      console.info("User API key settings updated:", {
        user_id: user.id,
        action: "toggled",
        timestamp: new Date().toISOString(),
      });

      return jsonResponse({ success: true });
    }

    if (action === "update-model") {
      const newModel = String(body.model || "").trim() || null;
      const { error: updateError } = await supabase
        .from("user_settings")
        .update({ api_model: newModel, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);

      if (updateError) {
        console.error("Database error during model update:", updateError);
        return jsonResponse({ error: "An unexpected error occurred." }, 500);
      }

      return jsonResponse({ success: true });
    }

    // Default Save Action
    const apiKey = String(body.apiKey || "").trim();
    const provider = String(body.provider || "").trim();
    const apiModel = String(body.model || "").trim() || null;

    if (!apiKey) {
      return jsonResponse({ error: "Invalid request parameters." }, 400);
    }

    if (
      !provider ||
      !["openai", "anthropic", "openrouter", "gemini", "kimi", "glm"].includes(provider)
    ) {
      return jsonResponse({ error: "Invalid request parameters." }, 400);
    }

    // Invoke SECURE DEFINER RPC via user client to preserve auth context
    const { error: rpcError } = await supabase.rpc("upsert_encrypted_api_key", {
      p_api_key: apiKey,
      p_api_provider: provider,
      p_api_model: apiModel,
    });

    if (rpcError) {
      console.error("RPC Error during key encryption/upsert:", rpcError);
      return jsonResponse({ error: "An unexpected error occurred." }, 500);
    }

    // Log the save lifecycle event to api_key_audit_log
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const { error: logError } = await adminClient.from("api_key_audit_log").insert({
      user_id: user.id,
      action: "saved",
      provider,
      source: null,
      ip_address: ip,
    });

    if (logError) {
      console.error("Audit logging failed for save:", logError);
    }

    console.info("User API key saved successfully:", {
      user_id: user.id,
      provider,
      action: "saved",
      timestamp: new Date().toISOString(),
    });

    return jsonResponse({ success: true });
  } catch (e) {
    console.error("encrypt-api-key handler error:", e);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
