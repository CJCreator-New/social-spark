import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2, CreditCard } from "lucide-react";
import { startRazorpayCheckout, type CheckoutParams, type PaidPlan } from "@/lib/razorpayCheckout";

interface RazorpayCheckoutButtonProps {
  /** Which plan to purchase. Server derives the price. */
  plan: PaidPlan;
  name?: string;
  description?: string;
  prefill?: CheckoutParams["prefill"];
  label?: string;
  className?: string;
  onSuccess?: (tier: PaidPlan, periodEnd: string | null) => void;
  onDismiss?: () => void;
  onFailure?: (error: string) => void;
}

export function RazorpayCheckoutButton({
  plan,
  name,
  description,
  prefill,
  label = "Pay now",
  className = "pf-btn",
  onSuccess,
  onDismiss,
  onFailure,
}: RazorpayCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await startRazorpayCheckout({ plan, name, description, prefill });
      if (result.status === "success") {
        toast.success("Payment successful!");
        onSuccess?.(result.tier, result.periodEnd);
      } else if (result.status === "dismissed") {
        toast.info("Payment cancelled.");
        onDismiss?.();
      } else {
        toast.error(result.error);
        onFailure?.(result.error);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment could not be started.";
      toast.error(msg);
      onFailure?.(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      disabled={loading}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
    >
      {loading ? <Loader2 className="animate-spin" size={14} /> : <CreditCard size={14} />}
      <span>{loading ? "Processing…" : label}</span>
    </button>
  );
}
