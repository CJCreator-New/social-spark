/**
 * Admin Dashboard
 *
 * Real-time monitoring dashboard for app health, performance, and usage.
 * Shows statistics, performance metrics, errors, and analytics.
 *
 * Access: /admin (admin users only)
 */

import { useEffect, useState, lazy, Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Activity, TrendingUp, Users, Calendar, Zap, Key } from 'lucide-react';
import { fetchAdminStats, AdminStats } from '@/lib/admin';
import { SkeletonList } from '@/components/SkeletonList';
import telemetry from '@/lib/telemetry';
import { supabase } from '@/integrations/supabase/client';

interface ApiKeyStatusRow {
  user_id: string;
  api_provider: string | null;
  use_own_key: boolean;
  has_own_key: boolean;
  updated_at: string;
}

interface AuditLogRow {
  id: string;
  user_id: string;
  action: string;
  provider: string | null;
  source: string | null;
  ip_address: string | null;
  created_at: string;
}

const AdminCharts = lazy(() => import("./admin/AdminCharts"));


// ============================================================================
// ADMIN DASHBOARD COMPONENT
// ============================================================================

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [apiKeyStatuses, setApiKeyStatuses] = useState<ApiKeyStatusRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);

  // Fetch stats on mount and periodically
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const data = await fetchAdminStats();
        setStats(data);
        setLastUpdated(new Date());
        setError(null);
        telemetry.sendEvent('admin_dashboard_loaded', {
          activeUsersToday: data.overview.activeUsersToday,
          calendarsGeneratedToday: data.overview.calendarsGeneratedToday,
          apiSuccessRate: data.overview.apiSuccessRate,
          apiErrorRate: data.overview.apiErrorRate,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load admin stats');
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    // Fetch API key metadata from admin view (no raw keys)
    const loadApiKeyData = async () => {
      try {
        const { data: statuses } = await supabase
          .from('admin_user_key_status' as any)
          .select('*');
        if (statuses) setApiKeyStatuses(statuses as unknown as ApiKeyStatusRow[]);

        const { data: logs } = await supabase
          .from('api_key_audit_log' as any)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);
        if (logs) setAuditLogs(logs as unknown as AuditLogRow[]);
      } catch (err) {
        console.error('Failed to load API key admin data:', err);
      }
    };
    loadApiKeyData();

    // Refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    telemetry.sendEvent('admin_dashboard_refresh_clicked');
    window.location.reload();
  };

  if (loading) {
    return <SkeletonList rows={4} />;
  }

  if (!stats) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load admin dashboard</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="relative w-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_28%)]" />
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-lime-400/10 blur-3xl" />
      <div className="absolute right-0 top-32 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8">
      {/* Header */}
      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20">
          <p className="text-[10px] uppercase tracking-[0.28em] text-lime-300">System dashboard</p>
          <h1 className="mt-3 font-serif text-3xl font-normal text-white md:text-4xl">Monitor the studio without losing the story.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Track how the product is behaving, spot error spikes, and read the platform mix at a glance.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="outline">Auto-refresh 30s</Badge>
            <Badge variant="outline">Telemetry on</Badge>
            <Badge variant="outline">Errors {stats.errors.total24h} / 24h</Badge>
            <Badge variant="outline">Success {stats.overview.apiSuccessRate}%</Badge>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">Last updated</p>
              <p className="mt-2 font-serif text-2xl font-normal text-white">{lastUpdated.toLocaleTimeString()}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">Auto-refreshes every 30 seconds.</p>
            </div>
            <Button size="sm" onClick={handleRefresh}>
              Refresh
            </Button>
          </div>
          {error && (
            <Alert variant="destructive" className="mt-5 border-red-500/20 bg-red-500/10 text-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Overview Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          title="Active Users (Today)"
          value={stats.overview.activeUsersToday}
          change={`${stats.overview.activeUsersWeek} this week`}
        />
        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          title="Calendars Generated (Today)"
          value={stats.overview.calendarsGeneratedToday}
          change={`${stats.overview.calendarsGeneratedWeek} this week`}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          title="API Success Rate"
          value={`${stats.overview.apiSuccessRate}%`}
          status={stats.overview.apiSuccessRate > 99 ? 'good' : stats.overview.apiSuccessRate > 95 ? 'warning' : 'error'}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          title="API Error Rate"
          value={`${stats.overview.apiErrorRate}%`}
          status={stats.overview.apiErrorRate < 1 ? 'good' : stats.overview.apiErrorRate < 5 ? 'warning' : 'error'}
        />
      </div>

      {/* Performance Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>API latency and response times</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MetricRow
              label="Avg API Latency"
              value={`${stats.performance.avgApiLatency}ms`}
              benchmark="< 500ms target"
              status={stats.performance.avgApiLatency < 500 ? 'good' : 'warning'}
            />
            <MetricRow
              label="P95 API Latency"
              value={`${stats.performance.p95ApiLatency}ms`}
              benchmark="< 1000ms target"
              status={stats.performance.p95ApiLatency < 1000 ? 'good' : 'warning'}
            />
            <MetricRow
              label="Avg Generation Time"
              value={`${stats.performance.avgGenerationTime}ms`}
              benchmark="< 2000ms target"
              status={stats.performance.avgGenerationTime < 2000 ? 'good' : 'warning'}
            />
            <MetricRow
              label="P95 Generation Time"
              value={`${stats.performance.p95GenerationTime}ms`}
              benchmark="< 5000ms target"
              status={stats.performance.p95GenerationTime < 5000 ? 'good' : 'warning'}
            />
            <MetricRow
              label="Avg DB Query Time"
              value={`${stats.performance.databaseQueryAvgTime}ms`}
              benchmark="< 100ms target"
              status={stats.performance.databaseQueryAvgTime < 100 ? 'good' : 'warning'}
            />
          </CardContent>
        </Card>

        {/* Errors Section */}
        <Card>
          <CardHeader>
            <CardTitle>Errors (Last 24h)</CardTitle>
            <CardDescription>Error tracking and breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-3xl font-bold">{stats.errors.total24h}</div>
              <p className="text-sm text-gray-500">Total errors in last 24 hours</p>
            </div>

            {stats.errors.topErrors.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Top Errors</p>
                {stats.errors.topErrors.slice(0, 5).map((error, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm">{error.error}</span>
                    <Badge variant="outline">{error.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No errors in last 24 hours ✓</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Usage Analytics Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Platform Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Usage</CardTitle>
            <CardDescription>Distribution across social platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<p className="py-8 text-center text-sm text-gray-500">Loading charts...</p>}>
              <AdminCharts platformDistribution={stats.usage.platformDistribution} />
            </Suspense>
          </CardContent>
        </Card>

        {/* Industry Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Industry Distribution</CardTitle>
            <CardDescription>Most active industries</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.entries(stats.usage.industryDistribution).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(stats.usage.industryDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([industry, count]) => (
                    <div key={industry} className="flex items-center justify-between">
                      <span className="text-sm">{industry}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-40 bg-gray-200 rounded">
                          <div
                            className="h-full bg-blue-500 rounded"
                            style={{
                              width: `${(count / Math.max(...Object.values(stats.usage.industryDistribution))) * 100}%`,
                            }}
                          />
                        </div>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500">No industry data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rate Limiting Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Limiting (Last 24h)</CardTitle>
          <CardDescription>API rate limit monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-gray-500">Active Rate Limit Keys</p>
              <p className="text-2xl font-bold">{stats.rateLimit.activeKeys}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Requests</p>
              <p className="text-2xl font-bold">{stats.rateLimit.totalRequests24h}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Denied Requests</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{stats.rateLimit.deniedRequests24h}</p>
                <Badge
                  variant={stats.rateLimit.deniedRequests24h < 10 ? 'default' : 'destructive'}
                >
                  {stats.rateLimit.deniedRequests24h > 0
                    ? `${((stats.rateLimit.deniedRequests24h / stats.rateLimit.totalRequests24h) * 100).toFixed(2)}%`
                    : '0%'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Section */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            System Health Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            ✓ API success rate: <strong>{stats.overview.apiSuccessRate}%</strong>
          </p>
          <p className="text-sm">
            ✓ Avg API latency: <strong>{stats.performance.avgApiLatency}ms</strong>
          </p>
          <p className="text-sm">
            ✓ Errors in last 24h: <strong>{stats.errors.total24h}</strong>
          </p>
          <p className="text-sm">
            ✓ Total calendars created: <strong>{stats.usage.totalCalendarsCreated}</strong>
          </p>
          <p className="text-sm">
            ✓ Active users (today): <strong>{stats.overview.activeUsersToday}</strong>
          </p>
        </CardContent>
      </Card>

      {/* User Fallback API Keys Section */}
      <Card className="border-l-4 border-l-lime-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            User Fallback API Keys
          </CardTitle>
          <CardDescription>
            Key status metadata per user — no raw keys are shown. Audit log of last 50 events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeyStatuses.length === 0 ? (
            <p className="text-sm text-gray-500">No users have configured a fallback key.</p>
          ) : (
            <div className="space-y-3">
              {apiKeyStatuses.slice(0, 20).map((row) => {
                const userLogs = auditLogs.filter(l => l.user_id === row.user_id).slice(0, 5);
                return (
                  <div key={row.user_id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-400">{row.user_id.slice(0, 8)}…</span>
                        {row.has_own_key ? (
                          <Badge variant="outline" className="text-lime-400 border-lime-400/40 text-[10px]">Key set</Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-500 text-[10px]">No key</Badge>
                        )}
                        {row.use_own_key && (
                          <Badge variant="outline" className="text-sky-400 border-sky-400/40 text-[10px]">Fallback ON</Badge>
                        )}
                        {row.api_provider && (
                          <Badge variant="outline" className="text-[10px]">{row.api_provider}</Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-600">
                        Updated {new Date(row.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    {userLogs.length > 0 && (
                      <div className="space-y-1">
                        {userLogs.map((log) => (
                          <div key={log.id} className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                log.action === 'saved' ? 'bg-lime-400' :
                                log.action === 'deleted' ? 'bg-red-400' :
                                log.action === 'used' ? 'bg-sky-400' : 'bg-yellow-400'
                              }`}
                            />
                            <span className="capitalize font-medium">{log.action}</span>
                            {log.provider && <span className="text-slate-600">· {log.provider}</span>}
                            {log.source && <span className="text-slate-600">· via {log.source}</span>}
                            <span className="ml-auto text-slate-700">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  change?: string;
  status?: 'good' | 'warning' | 'error';
}

function StatCard({ icon, title, value, change, status }: StatCardProps) {
  const statusColors = {
    good: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    error: 'text-red-600 bg-red-50 border-red-200',
    default: 'text-gray-600 bg-gray-50 border-gray-200',
  };

  const borderColor = status ? statusColors[status] : statusColors.default;

  return (
    <Card className={`border ${borderColor}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {change && <p className="text-xs text-gray-500 mt-1">{change}</p>}
          </div>
          <div className="text-gray-400">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricRowProps {
  label: string;
  value: string;
  benchmark: string;
  status: 'good' | 'warning';
}

function MetricRow({ label, value, benchmark, status }: MetricRowProps) {
  const textColor = status === 'good' ? 'text-green-600' : 'text-yellow-600';

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500">{benchmark}</p>
      </div>
      <p className={`text-lg font-bold ${textColor}`}>{value}</p>
    </div>
  );
}
