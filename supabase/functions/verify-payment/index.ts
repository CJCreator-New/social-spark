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

/** Lowercase hex encoding of an ArrayBuffer. */
function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison to avoid timing side-channels. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** HMAC-SHA256(message, secret) → lowercase hex. */
async function hmacSha256Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(sig);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: require a valid Supabase session ──────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized access." }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!supabaseUrl || !supabaseAnonKey || !razorpayKeySecret) {
      console.error("verify-payment: missing required environment configuration");
      return jsonResponse({ error: "Payment is not configured." }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized access." }, 401);
    }

    // ── Rate limiting: 10 verifications per user per minute ─────────────────
    const rateLimitCheck = await checkRateLimit(user.id, "verify-payment", {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
    }

    // ── Validate input ──────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const orderId = String(body.razorpay_order_id || "").trim();
    const paymentId = String(body.razorpay_payment_id || "").trim();
    const signature = String(body.razorpay_signature || "").trim();

    if (!orderId || !paymentId || !signature) {
      return jsonResponse({ error: "Missing required payment fields." }, 400);
    }

    // ── Verify the signature: HMAC-SHA256(order_id|payment_id, key_secret) ──
    const expected = await hmacSha256Hex(`${orderId}|${paymentId}`, razorpayKeySecret);

    if (!timingSafeEqual(expected, signature)) {
      console.warn("verify-payment: signature mismatch", { user_id: user.id, order_id: orderId });
      return jsonResponse({ verified: false, error: "Payment signature verification failed." }, 400);
    }

    console.info("verify-payment: signature verified", {
      user_id: user.id,
      order_id: orderId,
      payment_id: paymentId,
    });

    // NOTE: This endpoint only proves the payment is authentic. Persisting the
    // payment and granting entitlements is handled separately (subscription
    // Phase 1/3), so no DB writes occur here.
    return jsonResponse({ verified: true });
  } catch (e) {
    console.error("verify-payment handler error:", e);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
