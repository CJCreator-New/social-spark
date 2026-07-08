/**
 * Single client-side source of truth for plan/tier display data (name, price,
 * features). Used by both the marketing pricing section (Pricing.tsx) and the
 * in-app plan settings (PlanSettings.tsx) so the two never drift apart.
 *
 * Prices are ENFORCED server-side in supabase/functions/_shared/plans.ts —
 * these values are for presentation only and must be kept in sync with that
 * source of truth.
 */

export type PlanTierId = "free" | "starter" | "pro";

export interface PlanTier {
  id: PlanTierId;
  name: string;
  price: string;
  features: string[];
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    features: [
      "50 platform generations / month",
      "BYOK (use your own API key)",
      "Calendar + single posts",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: "₹199",
    features: [
      "100 platform generations / month",
      "BYOK — you control AI costs",
      "Priority support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹499",
    features: [
      "500 platform generations / month",
      "BYOK for unlimited generations",
      "Premium features",
    ],
  },
];
