import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side view of the user's subscription/tier state. The source of truth
 * is `user_settings` (written server-side after payment verification); this
 * module only READS it. Mirrors the mock-Supabase fallback used by
 * apiKeyManager so local/E2E environments keep working.
 */

export type Tier = "free" | "starter" | "pro";

export interface SubscriptionStatus {
  tier: Tier;
  /** Effective tier after expiry — a lapsed paid window reads as 'free'. */
  effectiveTier: Tier;
  planPeriodEnd: string | null;
  /** Whether the paid window is still active. */
  active: boolean;
  used: number;
  limit: number;
  /** BYOK (own API key) allowed for this user. */
  canUseOwnKey: boolean;
}

export const FREE_STATUS: SubscriptionStatus = {
  tier: "free",
  effectiveTier: "free",
  planPeriodEnd: null,
  active: false,
  used: 0,
  limit: 10,
  canUseOwnKey: false,
};

function isMockEnv(): boolean {
  const url = (import.meta.env.VITE_SUPABASE_URL as string) || "";
  return !url || url.includes("mock.supabase.co");
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  if (isMockEnv()) {
    const tier = (localStorage.getItem("social_spark_tier") as Tier) || "free";
    const periodEnd = localStorage.getItem("social_spark_plan_period_end");
    return computeStatus(tier, periodEnd, Number(localStorage.getItem("social_spark_generation_count") || "0"), 10);
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return FREE_STATUS;

  try {
    const { data, error } = await (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)("user_settings")
      .select("tier, plan_period_end, generation_count, quota_limit")
      .maybeSingle();
    if (error) throw error;
    const row = data as unknown as {
      tier?: string;
      plan_period_end?: string | null;
      generation_count?: number;
      quota_limit?: number;
    } | null;
    if (!row) return FREE_STATUS;

    const tier = (row.tier === "starter" || row.tier === "pro") ? row.tier : "free";
    return computeStatus(tier, row.plan_period_end ?? null, row.generation_count ?? 0, row.quota_limit ?? 10);
  } catch (err) {
    console.warn("getSubscriptionStatus failed:", err);
    return FREE_STATUS;
  }
}

function computeStatus(tier: Tier, planPeriodEnd: string | null, used: number, limit: number): SubscriptionStatus {
  const endMs = planPeriodEnd ? Date.parse(planPeriodEnd) : NaN;
  const active = tier !== "free" && Number.isFinite(endMs) && endMs > Date.now();
  const effectiveTier: Tier = tier === "free" ? "free" : (active ? tier : "free");
  return {
    tier,
    effectiveTier,
    planPeriodEnd,
    active,
    used,
    limit,
    canUseOwnKey: effectiveTier === "starter" || effectiveTier === "pro",
  };
}

/** Days remaining in the current paid window, or null if not on a paid plan. */
export function daysRemaining(planPeriodEnd: string | null): number | null {
  if (!planPeriodEnd) return null;
  const endMs = Date.parse(planPeriodEnd);
  if (!Number.isFinite(endMs)) return null;
  return Math.max(0, Math.ceil((endMs - Date.now()) / (24 * 60 * 60 * 1000)));
}
