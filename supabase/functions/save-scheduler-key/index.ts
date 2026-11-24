// deno-lint-ignore-file
// @ts-ignore - Deno ESM import resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
import { checkRateLimit, getCorsHeaders } from "../_shared/promptHelpers.ts";

// Keep in sync with src/lib/schedulerKeys.ts
const PROVIDERS = ["buffer", "hootsuite"];
const MAX_KEY_LENGTH = 512;

function validateKey(key: unknown): string | null {
  if (typeof key !== "string" || key.length === 0) return "Enter an access token.";
  if (key.length > MAX_KEY_LENGTH) return "That token is too long.";
  if (/\s/.test(key)) return "The token must not contain spaces or line breaks.";
  if (!/^[\x21-\x7E]+$/.test(key)) return "The token has characters that are not allowed.";
  return null;
}

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
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "An unexpected error occurred." }, 500);
    }

    // User-JWT client: RLS and auth.uid() apply to every query below.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized access." }, 401);
    }

    const rateLimitCheck = await checkRateLimit(user.id, "save-scheduler-key", {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const action =
      req.method === "DELETE" ? "delete" : String(body?.action || "save").trim();

    if (action === "status") {
      const { data, error } = await supabase
        .from("scheduler_api_keys")
        .select("provider")
        .eq("user_id", user.id);
      if (error) {
        console.error("save-scheduler-key: status lookup failed");
        return jsonResponse({ error: "An unexpected error occurred." }, 500);
      }
      const saved = new Set((data ?? []).map((r: { provider: string }) => r.provider));
      return jsonResponse({
        ok: true,
        saved: { buffer: saved.has("buffer"), hootsuite: saved.has("hootsuite") },
      });
    }

    const provider = String(body?.provider || "").trim();
    if (!PROVIDERS.includes(provider)) {
      return jsonResponse({ error: "Invalid provider." }, 400);
    }

    if (action === "delete") {
      const { error } = await supabase
        .from("scheduler_api_keys")
        .delete()
        .eq("user_id", user.id)
        .eq("provider", provider);
      if (error) {
        console.error("save-scheduler-key: delete failed");
        return jsonResponse({ error: "An unexpected error occurred." }, 500);
      }
      return jsonResponse({ ok: true, provider });
    }

    if (action !== "save") {
      return jsonResponse({ error: "Invalid request parameters." }, 400);
    }

    const key = body?.key;
    const problem = validateKey(key);
    if (problem) {
      return jsonResponse({ error: problem }, 400);
    }

    // SECURITY DEFINER RPC encrypts with the same pgsodium primitive as
    // upsert_encrypted_api_key and upserts into scheduler_api_keys.
    const { error: rpcError } = await supabase.rpc("upsert_scheduler_api_key", {
      p_provider: provider,
      p_api_key: key,
    });
    if (rpcError) {
      // Never log the key or the raw error payload.
      console.error("save-scheduler-key: save failed");
      return jsonResponse({ error: "An unexpected error occurred." }, 500);
    }

    return jsonResponse({ ok: true, provider });
  } catch (_e) {
    console.error("save-scheduler-key handler error");
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
