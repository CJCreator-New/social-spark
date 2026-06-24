// deno-lint-ignore-file
// @ts-ignore - Deno ESM import resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
declare const Deno: { env: { get(key: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void; openKv(): Promise<any> };
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

Deno.serve(async (req: Request) => {
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
    if (!supabaseUrl || !supabaseAnonKey) {
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
    const rateLimitCheck = await checkRateLimit(user.id, "decrypt-api-key", {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
    }

    // Call RPC to decrypt
    const { data, error: rpcError } = await supabase.rpc("get_decrypted_api_key");

    if (rpcError) {
      console.error("RPC Error during key decryption/fetch:", rpcError);
      return jsonResponse({ error: "An unexpected error occurred." }, 500);
    }

    const resultRow = Array.isArray(data) ? data[0] : data;

    if (!resultRow || !resultRow.decrypted_key) {
      return jsonResponse({ apiKey: null, provider: null });
    }

    // Never log raw key in console/server logs. Only log action metadata.
    console.info("User API key retrieved/decrypted:", {
      user_id: user.id,
      provider: resultRow.api_provider,
      action: "decrypted",
      timestamp: new Date().toISOString(),
    });

    return jsonResponse({
      hasKey: !!resultRow.decrypted_key,
      provider: resultRow.api_provider,
      last4: resultRow.decrypted_key ? resultRow.decrypted_key.slice(-4) : null,
    });
  } catch (e) {
    console.error("decrypt-api-key handler error:", e);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
