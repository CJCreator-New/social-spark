import { CheckCircle2, Sparkles, Zap, Crown, AlertCircle } from "lucide-react";
import { RazorpayCheckoutButton } from "@/components/RazorpayCheckoutButton";
import { useSubscription } from "@/hooks/useSubscription";
import { daysRemaining, type Tier } from "@/lib/subscription";
import { PLAN_TIERS, type PlanTierId } from "@/constants/plans";

/**
 * Display-only plan catalogue, sourced from the shared PLAN_TIERS constant.
 * Prices are ENFORCED server-side in supabase/functions/_shared/plans.ts —
 * these values are for presentation and must be kept in sync with that
 * source of truth.
 */
const TIER_META: Record<PlanTierId, { cadence: string; icon: typeof Sparkles; purchasable: boolean }> = {
  free: { cadence: "", icon: Sparkles, purchasable: false },
  starter: { cadence: "/ month", icon: Zap, purchasable: true },
  pro: { cadence: "/ month", icon: Crown, purchasable: true },
};

const PLANS: Array<{
  id: Tier;
  name: string;
  price: string;
  cadence: string;
  icon: typeof Sparkles;
  features: string[];
  purchasable: boolean;
}> = PLAN_TIERS.map((tier) => ({ ...tier, ...TIER_META[tier.id] }));

export function PlanSettings() {
  const { status, loading, refresh } = useSubscription();
  const current = status.effectiveTier;
  const remaining = daysRemaining(status.planPeriodEnd);

  return (
    <div className="pf-card" style={{ marginTop: 14 }}>
      <h2 className="pf-section-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles size={18} style={{ color: "var(--color-primary)" }} />
        <span>Plan &amp; Billing</span>
      </h2>

      {status.active && remaining !== null && remaining <= 3 && (
        <div
          role="alert"
          className="pf-notice"
          style={{
            marginBottom: 16,
            borderColor: "var(--border)",
            background: "var(--err-bg)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <AlertCircle size={16} style={{ color: "var(--color-error-text)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--color-text)" }}>
            Your subscription will expire in{" "}
            <strong style={{ color: "var(--color-error-text)" }}>
              {remaining} day{remaining === 1 ? "" : "s"}
            </strong>
            . Renew now to prevent any service interruption.
          </span>
        </div>
      )}

      {/* Current plan + expiry */}
      <div className="pf-section-sub" style={{ marginBottom: 16 }}>
        {loading ? (
          "Loading your plan…"
        ) : current === "free" ? (
          "You're on the Free plan. Upgrade to get more monthly platform generations."
        ) : (
          <>
            You're on{" "}
            <strong style={{ color: "var(--color-primary)", textTransform: "capitalize" }}>
              {current}
            </strong>
            {status.active && remaining !== null
              ? ` — ${remaining} day${remaining === 1 ? "" : "s"} remaining.`
              : " — your plan window has ended; renew to keep access."}
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = current === plan.id;
          return (
            <div
              key={plan.id}
              style={{
                border: isCurrent
                  ? "1.5px solid var(--color-primary)"
                  : "1px solid var(--color-border)",
                borderRadius: 12,
                padding: 16,
                background: isCurrent ? "var(--color-bg)" : "var(--color-surface)",
                boxShadow: isCurrent
                  ? "0 8px 24px rgba(194,65,12,0.06)"
                  : "0 2px 8px rgba(120,113,108,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon size={16} style={{ color: "var(--color-primary)" }} />
                <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{plan.name}</span>
                {isCurrent && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      padding: "2px 8px",
                      borderRadius: 99,
                      background: "var(--color-primary-xlight)",
                      color: "var(--color-primary)",
                      fontWeight: 600,
                    }}
                  >
                    Current
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--color-primary)",
                    fontFamily: "var(--font-display,'Lora',Georgia,serif)",
                  }}
                >
                  {plan.price}
                </span>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {plan.cadence}
                </span>
              </div>

              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {plan.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 6,
                      fontSize: 12,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    <CheckCircle2
                      size={13}
                      style={{ color: "var(--color-primary)", flexShrink: 0, marginTop: 1 }}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {plan.purchasable && !isCurrent && (
                <RazorpayCheckoutButton
                  plan={plan.id as "starter" | "pro"}
                  label={current === "free" ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                  description={`${plan.name} — ${plan.price}`}
                  onSuccess={() => {
                    void refresh();
                  }}
                />
              )}
              {plan.purchasable && isCurrent && status.active && (
                <RazorpayCheckoutButton
                  plan={plan.id as "starter" | "pro"}
                  label="Renew"
                  className="pf-btn ghost"
                  description={`Renew ${plan.name}`}
                  onSuccess={() => {
                    void refresh();
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
