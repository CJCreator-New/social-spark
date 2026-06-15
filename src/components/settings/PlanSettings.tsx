import { CheckCircle2, Sparkles, Zap, Crown } from "lucide-react";
import { RazorpayCheckoutButton } from "@/components/RazorpayCheckoutButton";
import { useSubscription } from "@/hooks/useSubscription";
import { daysRemaining, type Tier } from "@/lib/subscription";

/**
 * Display-only plan catalogue. Prices are ENFORCED server-side in
 * supabase/functions/_shared/plans.ts — these values are for presentation and
 * must be kept in sync with that source of truth.
 */
const PLANS: Array<{
  id: Tier;
  name: string;
  price: string;
  cadence: string;
  icon: typeof Sparkles;
  features: string[];
  purchasable: boolean;
}> = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    cadence: "",
    icon: Sparkles,
    features: ["10 generations", "Platform AI", "Calendar + single posts"],
    purchasable: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "₹199",
    cadence: "/ 30 days",
    icon: Zap,
    features: ["Use your own API key (BYOK)", "Up to 1,000 generations", "You control AI costs"],
    purchasable: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹499",
    cadence: "/ 30 days",
    icon: Crown,
    features: ["300 platform generations / mo", "Premium features", "BYOK supported"],
    purchasable: true,
  },
];

export function PlanSettings() {
  const { status, loading, refresh } = useSubscription();
  const current = status.effectiveTier;
  const remaining = daysRemaining(status.planPeriodEnd);

  return (
    <div className="pf-card" style={{ marginTop: 14 }}>
      <h2 className="pf-section-h" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Sparkles size={18} style={{ color: "#c8f09a" }} />
        <span>Plan &amp; Billing</span>
      </h2>

      {/* Current plan + expiry */}
      <div className="pf-section-sub" style={{ marginBottom: 16 }}>
        {loading ? (
          "Loading your plan…"
        ) : current === "free" ? (
          "You're on the Free plan. Upgrade to use your own API key or get more generations."
        ) : (
          <>
            You're on <strong style={{ color: "#c8f09a", textTransform: "capitalize" }}>{current}</strong>
            {status.active && remaining !== null
              ? ` — ${remaining} day${remaining === 1 ? "" : "s"} remaining.`
              : " — your plan window has ended; renew to keep access."}
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isCurrent = current === plan.id;
          return (
            <div
              key={plan.id}
              style={{
                border: isCurrent ? "1px solid rgba(200,240,154,0.4)" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 16,
                background: isCurrent ? "rgba(200,240,154,0.04)" : "rgba(255,255,255,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon size={16} style={{ color: "#c8f09a" }} />
                <span style={{ fontWeight: 600, color: "#edeae3" }}>{plan.name}</span>
                {isCurrent && (
                  <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(200,240,154,0.12)", color: "#c8f09a" }}>
                    Current
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: "#edeae3" }}>{plan.price}</span>
                <span style={{ fontSize: 12, color: "#7a7a8e" }}>{plan.cadence}</span>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#9a9aae" }}>
                    <CheckCircle2 size={13} style={{ color: "#c8f09a", flexShrink: 0, marginTop: 1 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {plan.purchasable && !isCurrent && (
                <RazorpayCheckoutButton
                  plan={plan.id as "starter" | "pro"}
                  label={current === "free" ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                  description={`${plan.name} — ${plan.price}`}
                  onSuccess={() => { void refresh(); }}
                />
              )}
              {plan.purchasable && isCurrent && status.active && (
                <RazorpayCheckoutButton
                  plan={plan.id as "starter" | "pro"}
                  label="Renew"
                  className="pf-btn ghost"
                  description={`Renew ${plan.name}`}
                  onSuccess={() => { void refresh(); }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
