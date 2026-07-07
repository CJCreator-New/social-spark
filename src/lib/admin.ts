/**
 * Admin Utilities
 *
 * Lightweight stats from real tables. Heavy metrics tables (api_metrics,
 * query_performance, rate_limit_counters, admin_users) are not provisioned —
 * those fields return zero/empty placeholders.
 */

import { supabase } from "@/integrations/supabase/client";

export interface AdminStats {
  overview: {
    activeUsersToday: number;
    activeUsersWeek: number;
    calendarsGeneratedToday: number;
    calendarsGeneratedWeek: number;
    apiSuccessRate: number;
    apiErrorRate: number;
  };
  performance: {
    avgGenerationTime: number;
    p95GenerationTime: number;
    avgApiLatency: number;
    p95ApiLatency: number;
    databaseQueryAvgTime: number;
  };
  errors: {
    total24h: number;
    byType: Record<string, number>;
    topErrors: Array<{ error: string; count: number; lastOccurred: string }>;
  };
  usage: {
    platformDistribution: Record<string, number>;
    industryDistribution: Record<string, number>;
    avgSessionDuration: number;
    totalCalendarsCreated: number;
  };
  rateLimit: {
    activeKeys: number;
    totalRequests24h: number;
    deniedRequests24h: number;
    topLimitedUsers: Array<{ userId: string; requestsBlocked: number }>;
  };
}

interface AdminCalendarStatsRpcResult {
  calendarsToday: number;
  calendarsWeek: number;
  activeUsersToday: number;
  activeUsersWeek: number;
  totalCalendars: number;
  platformDistribution: Record<string, number>;
  industryDistribution: Record<string, number>;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  // saved_calendars RLS scopes rows to auth.uid() = user_id with no admin-bypass
  // policy, so this must go through an admin-gated SECURITY DEFINER RPC rather
  // than querying the table directly — otherwise an admin only ever sees their
  // own calendars, silently, with no indication the numbers are wrong.
  const { data, error } = await supabase.rpc("admin_calendar_stats" as any);
  if (error) throw error;
  const result = data as unknown as AdminCalendarStatsRpcResult;

  return {
    overview: {
      activeUsersToday: result.activeUsersToday,
      activeUsersWeek: result.activeUsersWeek,
      calendarsGeneratedToday: result.calendarsToday,
      calendarsGeneratedWeek: result.calendarsWeek,
      apiSuccessRate: 100,
      apiErrorRate: 0,
    },
    performance: {
      avgGenerationTime: 0,
      p95GenerationTime: 0,
      avgApiLatency: 0,
      p95ApiLatency: 0,
      databaseQueryAvgTime: 0,
    },
    errors: { total24h: 0, byType: {}, topErrors: [] },
    usage: {
      platformDistribution: result.platformDistribution || {},
      industryDistribution: result.industryDistribution || {},
      avgSessionDuration: 0,
      totalCalendarsCreated: result.totalCalendars,
    },
    rateLimit: {
      activeKeys: 0,
      totalRequests24h: 0,
      deniedRequests24h: 0,
      topLimitedUsers: [],
    },
  };
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}
