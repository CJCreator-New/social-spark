import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, corsHeaders } from "../_shared/promptHelpers.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Content-Security-Policy": "default-src 'none'",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    if (action === "toggle") {
      const useOwnKey = body.useOwnKey;
      if (typeof useOwnKey !== "boolean") {
        return jsonResponse({ error: "Invalid request parameters." }, 400);
      }

      const rawKeyMode = String(body.keyMode || "").trim();
      const keyMode = rawKeyMode === "always" ? "always" : "fallback";

      // Upsert the toggle configuration in user_settings table
      const { error: dbError } = await adminClient
        .from("user_settings")
        .upsert(
          { user_id: user.id, use_own_key: useOwnKey, key_mode: keyMode, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );

      if (dbError) {
        console.error("Database error during toggle upsert:", dbError);
        return jsonResponse({ error: "An unexpected error occurred." }, 500);
      }

      // Insert audit log using service role
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
      const { error: logError } = await adminClient
        .from("api_key_audit_log")
        .insert({
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

    // Default Save Action
    const apiKey = String(body.apiKey || "").trim();
    const provider = String(body.provider || "").trim();

    if (!apiKey) {
      return jsonResponse({ error: "Invalid request parameters." }, 400);
    }

    if (!provider || !["openai", "anthropic", "openrouter"].includes(provider)) {
      return jsonResponse({ error: "Invalid request parameters." }, 400);
    }

    // Invoke SECURE DEFINER RPC via user client to preserve auth context
    const { error: rpcError } = await supabase.rpc("upsert_encrypted_api_key", {
      p_api_key: apiKey,
      p_api_provider: provider,
    });

    if (rpcError) {
      console.error("RPC Error during key encryption/upsert:", rpcError);
      return jsonResponse({ error: "An unexpected error occurred." }, 500);
    }

    // Log the save lifecycle event to api_key_audit_log
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const { error: logError } = await adminClient
      .from("api_key_audit_log")
      .insert({
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
