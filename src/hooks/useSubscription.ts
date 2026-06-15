import { useCallback, useEffect, useState } from "react";
import { getSubscriptionStatus, FREE_STATUS, type SubscriptionStatus } from "@/lib/subscription";

export interface UseSubscriptionResult {
  status: SubscriptionStatus;
  loading: boolean;
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getSubscriptionStatus();
      setStatus(next);
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
    isPro: status.effectiveTier === "pro",
    isStarter: status.effectiveTier === "starter",
    canUseOwnKey: status.canUseOwnKey,
    refresh,
  };
}
