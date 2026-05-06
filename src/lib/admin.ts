/**
 * Admin Utilities
 *
 * Data fetching and processing for admin dashboard.
 * Provides aggregated statistics, performance metrics, and user insights.
 */

import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// ADMIN DATA FETCHING
// ============================================================================

/**
 * Fetch comprehensive admin statistics.
 *
 * @returns Admin statistics object with all metrics
 */
export async function fetchAdminStats(): Promise<AdminStats> {
  const [overview, performance, errors, usage, rateLimit] = await Promise.all([
    fetchOverviewStats(),
    fetchPerformanceStats(),
    fetchErrorStats(),
    fetchUsageStats(),
    fetchRateLimitStats(),
  ]);

  return {
    overview,
    performance,
    errors,
    usage,
    rateLimit,
  };
}

/**
 * Fetch overview statistics (users, calendars, success rate).
 */
async function fetchOverviewStats(): Promise<AdminStats['overview']> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Get unique users today
    const { count: activeToday } = await supabase
      .from('calendars')
      .select('user_id', { count: 'exact' })
      .gt('created_at', today.toISOString());

    // Get unique users this week
    const { count: activeWeek } = await supabase
      .from('calendars')
      .select('user_id', { count: 'exact' })
      .gt('created_at', weekAgo.toISOString());

    // Get calendars created today
    const { count: calendarsToday } = await supabase
      .from('calendars')
      .select('id', { count: 'exact' })
      .gt('created_at', today.toISOString());

    // Get calendars created this week
    const { count: calendarsWeek } = await supabase
      .from('calendars')
      .select('id', { count: 'exact' })
      .gt('created_at', weekAgo.toISOString());

    // Get API success rate from metrics
    const { data: metrics } = await supabase
      .from('api_metrics')
      .select('success')
      .gt('timestamp', today.toISOString());

    const totalMetrics = metrics?.length || 1;
    const successMetrics = metrics?.filter((m) => m.success).length || 0;
    const successRate = (successMetrics / totalMetrics) * 100;

    return {
      activeUsersToday: activeToday || 0,
      activeUsersWeek: activeWeek || 0,
      calendarsGeneratedToday: calendarsToday || 0,
      calendarsGeneratedWeek: calendarsWeek || 0,
      apiSuccessRate: Math.round(successRate * 100) / 100,
      apiErrorRate: Math.round((100 - successRate) * 100) / 100,
    };
  } catch (err) {
    console.error('Failed to fetch overview stats:', err);
    return {
      activeUsersToday: 0,
      activeUsersWeek: 0,
      calendarsGeneratedToday: 0,
      calendarsGeneratedWeek: 0,
      apiSuccessRate: 0,
      apiErrorRate: 0,
    };
  }
}

/**
 * Fetch performance metrics (latency, generation times).
 */
async function fetchPerformanceStats(): Promise<AdminStats['performance']> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get performance data from api_metrics
    const { data: metrics } = await supabase
      .from('api_metrics')
      .select('latency_ms')
      .gt('timestamp', today.toISOString());

    if (!metrics || metrics.length === 0) {
      return {
        avgGenerationTime: 0,
        p95GenerationTime: 0,
        avgApiLatency: 0,
        p95ApiLatency: 0,
        databaseQueryAvgTime: 0,
      };
    }

    const latencies = metrics.map((m) => m.latency_ms).sort((a, b) => a - b);
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Index = Math.floor(latencies.length * 0.95);

    // Get query performance data
    const { data: queryMetrics } = await supabase
      .from('query_performance')
      .select('execution_time_ms')
      .gt('timestamp', today.toISOString());

    const dbQueryAvg =
      queryMetrics && queryMetrics.length > 0
        ? queryMetrics.reduce((a, b) => a + b.execution_time_ms, 0) / queryMetrics.length
        : 0;

    return {
      avgGenerationTime: Math.round(avg),
      p95GenerationTime: latencies[p95Index] || 0,
      avgApiLatency: Math.round(avg),
      p95ApiLatency: latencies[p95Index] || 0,
      databaseQueryAvgTime: Math.round(dbQueryAvg),
    };
  } catch (err) {
    console.error('Failed to fetch performance stats:', err);
    return {
      avgGenerationTime: 0,
      p95GenerationTime: 0,
      avgApiLatency: 0,
      p95ApiLatency: 0,
      databaseQueryAvgTime: 0,
    };
  }
}

/**
 * Fetch error statistics.
 */
async function fetchErrorStats(): Promise<AdminStats['errors']> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get errors from api_metrics
    const { data: errors, count: totalErrors } = await supabase
      .from('api_metrics')
      .select('error_code', { count: 'exact' })
      .eq('success', false)
      .gt('timestamp', today.toISOString());

    const byType: Record<string, number> = {};

    if (errors) {
      errors.forEach((e) => {
        const errorCode = e.error_code || 'unknown';
        byType[errorCode] = (byType[errorCode] || 0) + 1;
      });
    }

    // Get top errors
    const topErrors = Object.entries(byType)
      .map(([error, count]) => ({
        error,
        count,
        lastOccurred: new Date().toISOString(), // In real implementation, track this
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total24h: totalErrors || 0,
      byType,
      topErrors,
    };
  } catch (err) {
    console.error('Failed to fetch error stats:', err);
    return {
      total24h: 0,
      byType: {},
      topErrors: [],
    };
  }
}

/**
 * Fetch usage statistics (platforms, industries).
 */
async function fetchUsageStats(): Promise<AdminStats['usage']> {
  try {
    // Get calendars to analyze usage
    const { data: calendars, count: totalCalendars } = await supabase
      .from('calendars')
      .select('platform, industry', { count: 'exact' });

    const platformDistribution: Record<string, number> = {};
    const industryDistribution: Record<string, number> = {};

    if (calendars) {
      calendars.forEach((cal) => {
        if (cal.platform) {
          platformDistribution[cal.platform] = (platformDistribution[cal.platform] || 0) + 1;
        }
        if (cal.industry) {
          industryDistribution[cal.industry] = (industryDistribution[cal.industry] || 0) + 1;
        }
      });
    }

    return {
      platformDistribution,
      industryDistribution,
      avgSessionDuration: 12 * 60, // Placeholder: 12 minutes
      totalCalendarsCreated: totalCalendars || 0,
    };
  } catch (err) {
    console.error('Failed to fetch usage stats:', err);
    return {
      platformDistribution: {},
      industryDistribution: {},
      avgSessionDuration: 0,
      totalCalendarsCreated: 0,
    };
  }
}

/**
 * Fetch rate limit statistics.
 */
async function fetchRateLimitStats(): Promise<AdminStats['rateLimit']> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get rate limit data
    const { data: limits, count: totalKeys } = await supabase
      .from('rate_limit_counters')
      .select('key, success', { count: 'exact' })
      .gt('created_at', today.toISOString());

    let deniedCount = 0;

    if (limits) {
      deniedCount = limits.filter((l) => !l.success).length;
    }

    // Top limited users (placeholder)
    const topLimitedUsers: Array<{ userId: string; requestsBlocked: number }> = [];

    return {
      activeKeys: totalKeys || 0,
      totalRequests24h: limits?.length || 0,
      deniedRequests24h: deniedCount,
      topLimitedUsers,
    };
  } catch (err) {
    console.error('Failed to fetch rate limit stats:', err);
    return {
      activeKeys: 0,
      totalRequests24h: 0,
      deniedRequests24h: 0,
      topLimitedUsers: [],
    };
  }
}

// ============================================================================
// ADMIN PERMISSIONS
// ============================================================================

/**
 * Check if user is admin.
 * In real implementation, would check database role or auth metadata.
 *
 * @param userId User ID to check
 * @returns true if user is admin
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    // Placeholder: check admin table or auth metadata
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    return !!adminUser;
  } catch (err) {
    return false;
  }
}

/**
 * Make a user an admin.
 * Requires authenticated session with admin privileges.
 *
 * @param userId User ID to promote
 */
export async function promoteToAdmin(userId: string): Promise<void> {
  await supabase.from('admin_users').insert({
    user_id: userId,
  });
}

/**
 * Remove admin privileges from a user.
 *
 * @param userId User ID to demote
 */
export async function removeAdmin(userId: string): Promise<void> {
  await supabase.from('admin_users').delete().eq('user_id', userId);
}
