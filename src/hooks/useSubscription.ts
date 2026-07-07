import { useCallback, useEffect, useState } from "react";
import { getSubscriptionStatus, FREE_STATUS, type SubscriptionStatus } from "@/lib/subscription";

export interface UseSubscriptionResult {
  status: SubscriptionStatus;
  loading: boolean;
  /**
   * Set when the last refresh() failed to load subscription status. `status`
   * still falls back to FREE_STATUS in this case — check `error` to
   * distinguish "genuinely free" from "failed to load" before treating the
   * user as free tier.
   */
  error: Error | null;
  isPro: boolean;
  isStarter: boolean;
  canUseOwnKey: boolean;
  refresh: () => Promise<void>;
}

/**
 * Reads the user's tier/quota state. Call `refresh()` after a successful
 * checkout to reflect a newly granted tier without a page reload.
 */
export function useSubscription(): UseSubscriptionResult {
  const [status, setStatus] = useState<SubscriptionStatus>(FREE_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getSubscriptionStatus();
      setStatus(next);
      setError(null);
    } catch (e) {
      setStatus(FREE_STATUS);
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    status,
    loading,
    error,
    isPro: status.effectiveTier === "pro",
    isStarter: status.effectiveTier === "starter",
    canUseOwnKey: status.canUseOwnKey,
    refresh,
  };
}
