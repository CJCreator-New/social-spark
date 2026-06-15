// ─────────────────────────────────────────────────────────────────────────
// Server-side plan catalogue — SINGLE SOURCE OF TRUTH for pricing + entitlement.
//
// SECURITY: prices live ONLY here, server-side. The client never sends an
// amount; it sends a `plan` id and the server derives amount + quota + tier.
// This prevents "pay ₹1, get Pro" tampering.
//
// amount is in PAISE (₹1 = 100 paise).
// ─────────────────────────────────────────────────────────────────────────

export type PaidPlan = "starter" | "pro";

export interface PlanConfig {
  tier: PaidPlan;
  /** Charge in paise. PLACEHOLDER. */
  amount: number;
  currency: "INR";
  /** Monthly generation allowance granted with this plan. PLACEHOLDER. */
  quotaLimit: number;
  /** Human label for the Razorpay modal / receipts. */
  label: string;
}

export const PLAN_CATALOG: Record<PaidPlan, PlanConfig> = {
  // Starter: unlocks BYOK (user pays their own AI costs). Soft generation cap.
  starter: {
    tier: "starter",
    amount: 19900, // ₹199
    currency: "INR",
    quotaLimit: 1000, // BYOK soft cap
    label: "Social Spark Starter",
  },
  // Pro: high platform quota + premium features.
  pro: {
    tier: "pro",
    amount: 49900, // ₹499
    currency: "INR",
    quotaLimit: 300, // monthly platform generations
    label: "Social Spark Pro",
  },
};

/** Days of access granted per one-time payment (beta model). */
export const ENTITLEMENT_WINDOW_DAYS = 30;

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "starter" || value === "pro";
}

export function getPlan(plan: PaidPlan): PlanConfig {
  return PLAN_CATALOG[plan];
}

/** period_end = now + window. */
export function computePeriodEnd(fromMs: number = Date.now()): string {
  return new Date(fromMs + ENTITLEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
