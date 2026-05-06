/**
 * Admin Utilities
 *
 * Lightweight stats from real tables. Heavy metrics tables (api_metrics,
 * query_performance, rate_limit_counters, admin_users) are not provisioned —
 * those fields return zero/empty placeholders.
 */

import { supabase } from '@/integrations/supabase/client';

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

export async function fetchAdminStats(): Promise<AdminStats> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const platformDistribution: Record<string, number> = {};
  const industryDistribution: Record<string, number> = {};
  let activeToday = 0;
  let activeWeek = 0;
  let calToday = 0;
  let calWeek = 0;
  let totalCalendars = 0;

  try {
    const { count: cToday } = await supabase
      .from('saved_calendars')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', today.toISOString());
    calToday = cToday || 0;

    const { count: cWeek } = await supabase
      .from('saved_calendars')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', weekAgo.toISOString());
    calWeek = cWeek || 0;

    const { data: usersToday } = await supabase
      .from('saved_calendars')
      .select('user_id')
      .gt('created_at', today.toISOString());
    activeToday = new Set((usersToday || []).map((r) => r.user_id)).size;

    const { data: usersWeek } = await supabase
      .from('saved_calendars')
      .select('user_id')
      .gt('created_at', weekAgo.toISOString());
    activeWeek = new Set((usersWeek || []).map((r) => r.user_id)).size;

    const { data: calendars, count } = await supabase
      .from('saved_calendars')
      .select('platform, industry', { count: 'exact' });
    totalCalendars = count || 0;
    (calendars || []).forEach((c) => {
      if (c.platform) platformDistribution[c.platform] = (platformDistribution[c.platform] || 0) + 1;
      if (c.industry) industryDistribution[c.industry] = (industryDistribution[c.industry] || 0) + 1;
    });
  } catch (err) {
    console.error('Failed to fetch admin stats:', err);
  }

  return {
    overview: {
      activeUsersToday: activeToday,
      activeUsersWeek: activeWeek,
      calendarsGeneratedToday: calToday,
      calendarsGeneratedWeek: calWeek,
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
      platformDistribution,
      industryDistribution,
      avgSessionDuration: 0,
      totalCalendarsCreated: totalCalendars,
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
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  return !!data;
}
