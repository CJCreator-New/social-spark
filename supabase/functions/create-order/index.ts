import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, getCorsHeaders } from "../_shared/promptHelpers.ts";
import { getPlan, isPaidPlan } from "../_shared/plans.ts";

// Razorpay enforces a minimum charge of 100 paise (₹1.00).
const MIN_AMOUNT_PAISE = 100;

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
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!supabaseUrl || !supabaseAnonKey || !razorpayKeyId || !razorpayKeySecret) {
      console.error("create-order: missing required environment configuration");
      return jsonResponse({ error: "Payment is not configured." }, 500);
    }

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

    // ── Rate limiting: 10 order creations per user per minute ───────────────
    const rateLimitCheck = await checkRateLimit(user.id, "create-order", {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
    }

    // ── Validate input ──────────────────────────────────────────────────────
    // The client picks a PLAN; the server derives the amount. The client never
    // dictates price (prevents "pay ₹1 for Pro" tampering).
    const body = await req.json().catch(() => ({}));
    const planId = String(body.plan || "").trim();

    if (!isPaidPlan(planId)) {
      return jsonResponse({ error: "Invalid plan. Must be 'starter' or 'pro'." }, 400);
    }
    const plan = getPlan(planId);

    if (plan.amount < MIN_AMOUNT_PAISE) {
      console.error("create-order: plan amount below Razorpay minimum", planId, plan.amount);
      return jsonResponse({ error: "Payment is not configured." }, 500);
    }

    const receipt = `rcpt_${user.id.slice(0, 8)}_${Date.now()}`;

    // ── Create the Razorpay order via REST (Basic auth: key_id:key_secret) ──
    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        amount: plan.amount,
        currency: plan.currency,
        receipt,
        // Record the intended buyer + plan on the order itself so verify-payment
        // can re-derive entitlement without trusting client input.
        notes: { user_id: user.id, plan: plan.tier },
      }),
    });

    if (!rpRes.ok) {
      const errText = await rpRes.text().catch(() => "");
      // Never echo Razorpay's raw error (may contain account metadata) to the client.
      console.error("create-order: Razorpay API error", rpRes.status, errText);
      return jsonResponse({ error: "Failed to create payment order." }, 500);
    }

    const order = await rpRes.json();

    return jsonResponse({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      plan: plan.tier,
      label: plan.label,
    });
  } catch (e) {
    console.error("create-order handler error:", e);
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
