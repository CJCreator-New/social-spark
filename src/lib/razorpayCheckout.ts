import { supabase } from "@/integrations/supabase/client";

/**
 * Razorpay Standard Web Checkout helper.
 *
 * Flow: create-order (Edge Function) → open Razorpay modal → verify-payment
 * (Edge Function, signature check). The key SECRET never reaches the browser;
 * only the public VITE_RAZORPAY_KEY_ID is used here.
 */

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (response: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

/** Injects the Razorpay checkout script once; resolves when ready. */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function edgeHeaders(token: string): Record<string, string> {
  const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

export type PaidPlan = "starter" | "pro";

export interface CheckoutParams {
  /** Which plan to purchase. The server derives the price — the client never sends an amount. */
  plan: PaidPlan;
  /** Branding shown in the modal */
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
}

export type CheckoutResult =
  | { status: "success"; tier: PaidPlan; periodEnd: string | null }
  | { status: "dismissed" }
  | { status: "failed"; error: string };

/**
 * Runs the full Standard Checkout flow. Resolves with the outcome instead of
 * throwing for user-driven outcomes (dismiss / payment failure), so callers can
 * branch on `status`. Genuine setup errors (no session, script blocked, order
 * creation failed) reject.
 */
export async function startRazorpayCheckout(params: CheckoutParams): Promise<CheckoutResult> {
  if (params.plan !== "starter" && params.plan !== "pro") {
    throw new Error("Invalid plan.");
  }

  const keyId = (import.meta.env.VITE_RAZORPAY_KEY_ID as string) || "";
  if (!keyId) {
    throw new Error("Razorpay is not configured (missing VITE_RAZORPAY_KEY_ID).");
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error("Please sign in to continue with payment.");
  }

  const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";

  const scriptOk = await loadRazorpayScript();
  if (!scriptOk || !window.Razorpay) {
    throw new Error("Could not load the payment gateway. Check your connection and try again.");
  }

  // 1) Create the order server-side (server derives amount from the plan)
  const orderRes = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
    method: "POST",
    headers: edgeHeaders(token),
    body: JSON.stringify({ plan: params.plan }),
  });
  if (!orderRes.ok) {
    const data = await orderRes.json().catch(() => ({}));
    throw new Error(data?.error || `Failed to create order (${orderRes.status})`);
  }
  const order = await orderRes.json() as { order_id: string; amount: number; currency: string; label?: string };

  // 2) Open the Razorpay modal and await the user outcome
  return new Promise<CheckoutResult>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.order_id,
      name: params.name || "Social Spark",
      description: params.description || order.label,
      prefill: params.prefill,
      theme: { color: "#c8f09a" },
      handler: async (response: RazorpaySuccessResponse) => {
        try {
          // 3) Verify the signature server-side before trusting success
          const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/verify-payment`, {
            method: "POST",
            headers: edgeHeaders(token),
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json().catch(() => ({}));
          if (verifyRes.ok && verifyData?.verified && verifyData?.granted) {
            resolve({
              status: "success",
              tier: (verifyData.tier as PaidPlan) ?? params.plan,
              periodEnd: verifyData.period_end ?? null,
            });
          } else {
            resolve({ status: "failed", error: verifyData?.error || "Payment verification failed." });
          }
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Payment verification failed."));
        }
      },
      modal: {
        ondismiss: () => resolve({ status: "dismissed" }),
      },
    });

    rzp.on("payment.failed", (resp) => {
      resolve({ status: "failed", error: resp?.error?.description || "Payment failed." });
    });

    rzp.open();
  });
}
