import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getCorsHeaders } from "../_shared/promptHelpers.ts";

Deno.serve(async (req) => {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized access." }, 401);
    }

    // Rate Limiting: max 5 requests per user per minute
    const rateLimitCheck = await checkRateLimit(user.id, "delete-api-key", {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Update user_settings table to null out api_key_enc and disable use_own_key
    const { error: dbError } = await adminClient
      .from("user_settings")
      .update({
        api_key_enc: null,
        use_own_key: false,
        key_mode: "fallback",
        updated_at: new Date().toISOString()
      })
      .eq("user_id", user.id);

    if (dbError) {
      console.error("Database error during key deletion:", dbError);
      return jsonResponse({ error: "An unexpected error occurred." }, 500);
    }

    // Log the deleted lifecycle event to api_key_audit_log
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
    const { error: logError } = await adminClient
      .from("api_key_audit_log")
      .insert({
        user_id: user.id,
        action: "deleted",
        provider: null,
        source: null,
        ip_address: ip,
      });

    if (logError) {
      console.error("Audit logging failed for delete:", logError);
    }

    console.info("User API key deleted:", {
      user_id: user.id,
      action: "deleted",
      timestamp: new Date().toISOString(),
    });

    return jsonResponse({ success: true });
  } catch (e) {
    console.error("delete-api-key handler error:", e);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
