import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getCorsHeaders } from "../_shared/promptHelpers.ts";
import { computePeriodEnd, getPlan, isPaidPlan } from "../_shared/plans.ts";

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
    // ── Auth: require a valid Supabase session ──────────────────────────────
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized access." }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !razorpayKeyId || !razorpayKeySecret) {
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

    // ── Fetch the order from Razorpay to re-derive plan + amount server-side ──
    // We trust the ORDER (created server-side with our notes), never the client.
    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Basic ${basicAuth}` },
    });
    if (!orderRes.ok) {
      const errText = await orderRes.text().catch(() => "");
      console.error("verify-payment: failed to fetch order", orderRes.status, errText);
      return jsonResponse({ verified: false, error: "Could not confirm the order." }, 502);
    }
    const order = await orderRes.json() as {
      amount: number;
      status: string;
      notes?: { user_id?: string; plan?: string };
    };

    const planId = order.notes?.plan;
    if (!isPaidPlan(planId)) {
      console.error("verify-payment: order has no valid plan in notes", { order_id: orderId });
      return jsonResponse({ verified: false, error: "Order is not associated with a plan." }, 400);
    }
    const plan = getPlan(planId);

    // Integrity: the order must belong to THIS user and the charged amount must
    // match the server-side plan price exactly. Defends against tampering.
    // Require user_id to be PRESENT and equal — a missing note must not
    // auto-pass, or an order created without it (e.g. via a leaked Razorpay
    // key, or a create-order regression) would let anyone claim it.
    if (order.notes?.user_id !== user.id) {
      console.warn("verify-payment: order user mismatch", { order_id: orderId, user_id: user.id });
      return jsonResponse({ verified: false, error: "Order does not belong to this account." }, 403);
    }
    if (order.amount !== plan.amount) {
      console.error("verify-payment: amount mismatch", {
        order_id: orderId, order_amount: order.amount, expected: plan.amount,
      });
      return jsonResponse({ verified: false, error: "Payment amount mismatch." }, 400);
    }

    // ── Grant the tier (idempotent on order_id) via service role ─────────────
    const periodEnd = computePeriodEnd();
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: grantData, error: grantError } = await adminClient.rpc("grant_tier_from_payment", {
      p_user_id: user.id,
      p_tier: plan.tier,
      p_quota_limit: plan.quotaLimit,
      p_period_end: periodEnd,
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_amount: plan.amount,
      p_currency: plan.currency,
    });

    if (grantError) {
      console.error("verify-payment: grant_tier_from_payment failed:", grantError?.code || grantError?.message);
      return jsonResponse({ verified: true, granted: false, error: "Payment verified but access could not be granted. Contact support." }, 500);
    }

    const granted = Array.isArray(grantData) ? grantData[0] : grantData;

    return jsonResponse({
      verified: true,
      granted: true,
      tier: granted?.tier ?? plan.tier,
      period_end: granted?.period_end ?? periodEnd,
    });
  } catch (e) {
    console.error("verify-payment handler error:", e);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
