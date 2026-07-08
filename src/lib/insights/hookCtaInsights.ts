/**
 * Client wrapper for the `user_hook_cta_insights` RPC (see
 * supabase/migrations/20260709010000_telemetry_hook_cta_insights_rpc.sql).
 *
 * The RPC is SECURITY DEFINER and self-scoped to auth.uid() internally — it can
 * only ever return the calling user's own telemetry counts. Never throws: any
 * RPC error (including "Not authorized" for logged-out callers) resolves to a
 * well-formed, zeroed shape so callers never need their own error handling for
 * the common case (per this repo's AI Graceful Fallback rule).
 */

import { supabase } from "@/integrations/supabase/client";

export interface HookCtaInsights {
  hookRegenerateCount: number;
  ctaRegenerateCount: number;
  ctaSuggestionAppliedCount: number;
  postsKept: number;
  postsRegeneratedAgain: number;
  byPlatform: Record<string, number>;
}

interface UserHookCtaInsightsRpcResult {
  hookRegenerateClicked?: number;
  ctaRegenerateClicked?: number;
  ctaSuggestionApplied?: number;
  postKept?: number;
  postRegeneratedAgain?: number;
  byPlatform?: Record<string, number>;
}

export function emptyHookCtaInsights(): HookCtaInsights {
  return {
    hookRegenerateCount: 0,
    ctaRegenerateCount: 0,
    ctaSuggestionAppliedCount: 0,
    postsKept: 0,
    postsRegeneratedAgain: 0,
    byPlatform: {},
  };
}

export async function fetchHookCtaInsights(daysBack = 30): Promise<HookCtaInsights> {
  try {
    const { data, error } = await supabase.rpc("user_hook_cta_insights" as any, {
      days_back: daysBack,
    } as any);
    if (error || !data) {
      return emptyHookCtaInsights();
    }
    const result = data as unknown as UserHookCtaInsightsRpcResult;
    return {
      hookRegenerateCount: result.hookRegenerateClicked ?? 0,
      ctaRegenerateCount: result.ctaRegenerateClicked ?? 0,
      ctaSuggestionAppliedCount: result.ctaSuggestionApplied ?? 0,
      postsKept: result.postKept ?? 0,
      postsRegeneratedAgain: result.postRegeneratedAgain ?? 0,
      byPlatform: result.byPlatform ?? {},
    };
  } catch {
    // Never throw — telemetry insights are an enhancement, not a blocker.
    return emptyHookCtaInsights();
  }
}
