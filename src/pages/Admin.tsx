/**
 * Admin Dashboard
 *
 * Real-time monitoring dashboard for app health, performance, and usage.
 * Shows statistics, performance metrics, errors, and analytics.
 *
 * Access: /admin (admin users only)
 */

import { useEffect, useState, lazy, Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Activity, TrendingUp, Users, Calendar, Zap, Key } from "lucide-react";
import { fetchAdminStats, AdminStats } from "@/lib/admin";
import { SkeletonList } from "@/components/SkeletonList";
import { ErrorState } from "@/components/ErrorState";
import telemetry from "@/lib/telemetry";
import { supabase } from "@/integrations/supabase/client";

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

interface PaymentRow {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  tier_granted: string | null;
  period_end: string | null;
  created_at: string;
  is_comp: boolean;
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
  const [apiKeyDataLoading, setApiKeyDataLoading] = useState(true);
  const [apiKeyDataError, setApiKeyDataError] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [compUserId, setCompUserId] = useState("");
  const [compTier, setCompTier] = useState<"starter" | "pro" | "free">("starter");
  const [compBusy, setCompBusy] = useState(false);

  // Fetch stats on mount and periodically
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const data = await fetchAdminStats();
        setStats(data);
        setLastUpdated(new Date());
        setError(null);
        telemetry.sendEvent("admin_dashboard_loaded", {
          activeUsersToday: data.overview.activeUsersToday,
          calendarsGeneratedToday: data.overview.calendarsGeneratedToday,
          apiSuccessRate: data.overview.apiSuccessRate,
          apiErrorRate: data.overview.apiErrorRate,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin stats");
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    // Fetch API key metadata from admin view (no raw keys)
    const loadApiKeyData = async () => {
      setApiKeyDataLoading(true);
      try {
        const { data: statuses, error: statusesError } = await supabase
          .from("admin_user_key_status" as any)
          .select("*");
        if (statusesError) throw statusesError;
        if (statuses) setApiKeyStatuses(statuses as unknown as ApiKeyStatusRow[]);

        const { data: logs, error: logsError } = await supabase
          .from("api_key_audit_log" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        if (logsError) throw logsError;
        if (logs) setAuditLogs(logs as unknown as AuditLogRow[]);
        setApiKeyDataError(null);
      } catch (err) {
        console.error("Failed to load API key admin data:", err);
        setApiKeyDataError(err instanceof Error ? err.message : "Failed to load API key data");
      } finally {
        setApiKeyDataLoading(false);
      }
    };
    loadApiKeyData();

    // Fetch payments ledger (admin RLS allows reading all)
    const loadPayments = async () => {
      setPaymentsLoading(true);
      try {
        const { data: rows, error: rowsError } = await supabase
          .from("admin_payments" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (rowsError) throw rowsError;
        if (rows) setPayments(rows as unknown as PaymentRow[]);
        setPaymentsError(null);
      } catch (err) {
        console.error("Failed to load payments:", err);
        setPaymentsError(err instanceof Error ? err.message : "Failed to load payments");
      } finally {
        setPaymentsLoading(false);
      }
    };
    loadPayments();

    // Refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    telemetry.sendEvent("admin_dashboard_refresh_clicked");
    window.location.reload();
  };

  const handleCompGrant = async () => {
    const target = compUserId.trim();
    if (!target) return;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(target)) {
      toast.error("Please enter a valid UUID for the User ID.");
      return;
    }
    setCompBusy(true);
    try {
      // Quota mirrors the server plan catalogue: starter 1000, pro 300.
      const quota = compTier === "pro" ? 300 : compTier === "starter" ? 1000 : 10;
      const { error } = await supabase.rpc("admin_grant_tier" as any, {
        p_target_user: target,
        p_tier: compTier,
        p_quota_limit: quota,
        p_days: 30,
      });
      if (error) throw error;
      // Refresh the payments list to reflect the new comp row.
      const { data: rows } = await supabase
        .from("admin_payments" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (rows) setPayments(rows as unknown as PaymentRow[]);
      setCompUserId("");
      toast.success("Tier successfully granted.");
    } catch (err) {
      console.error("Comp grant failed:", err);
      setError(err instanceof Error ? err.message : "Comp grant failed");
    } finally {
      setCompBusy(false);
    }
  };

  if (loading) {
    return <SkeletonList rows={4} />;
  }

  if (!stats) {
    return <ErrorState title="Failed to load admin dashboard" onRetry={handleRefresh} />;
  }

  return (
    <div className="relative w-full overflow-hidden bg-design-bg text-stone-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(194,65,12,0.035),transparent_28%)]" />
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-6 py-8">
        {/* Header */}
        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(120,113,108,0.06),0_1px_3px_rgba(120,113,108,0.02)]">
            <p className="text-[10px] uppercase tracking-[0.18em] text-design-primary">
              System dashboard
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold text-stone-900 md:text-4xl">
              Monitor the studio without losing the story.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500">
              Track how the product is behaving, spot error spikes, and read the platform mix at a
              glance.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="outline">Auto-refresh 30s</Badge>
              <Badge variant="outline">Telemetry on</Badge>
              <Badge variant="outline">Errors {stats.errors.total24h} / 24h</Badge>
              <Badge variant="outline">Success {stats.overview.apiSuccessRate}%</Badge>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-[0_10px_30px_rgba(120,113,108,0.06),0_1px_3px_rgba(120,113,108,0.02)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-stone-500">
                  Last updated
                </p>
                <p className="mt-2 font-display text-2xl font-bold text-stone-900">
                  {lastUpdated.toLocaleTimeString()}
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  Auto-refreshes every 30 seconds.
                </p>
              </div>
              <Button size="sm" onClick={handleRefresh}>
                Refresh
              </Button>
            </div>
            {error && (
              <Alert
                variant="destructive"
                className="mt-5 border-red-500/20 bg-red-500/10 text-red-50"
              >
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
            status={
              stats.overview.apiSuccessRate > 99
                ? "good"
                : stats.overview.apiSuccessRate > 95
                  ? "warning"
                  : "error"
            }
          />
          <StatCard
            icon={<TrendingUp className="h-4 w-4" />}
            title="API Error Rate"
            value={`${stats.overview.apiErrorRate}%`}
            status={
              stats.overview.apiErrorRate < 1
                ? "good"
                : stats.overview.apiErrorRate < 5
                  ? "warning"
                  : "error"
            }
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
                status={stats.performance.avgApiLatency < 500 ? "good" : "warning"}
              />
              <MetricRow
                label="P95 API Latency"
                value={`${stats.performance.p95ApiLatency}ms`}
                benchmark="< 1000ms target"
                status={stats.performance.p95ApiLatency < 1000 ? "good" : "warning"}
              />
              <MetricRow
                label="Avg Generation Time"
                value={`${stats.performance.avgGenerationTime}ms`}
                benchmark="< 2000ms target"
                status={stats.performance.avgGenerationTime < 2000 ? "good" : "warning"}
              />
              <MetricRow
                label="P95 Generation Time"
                value={`${stats.performance.p95GenerationTime}ms`}
                benchmark="< 5000ms target"
                status={stats.performance.p95GenerationTime < 5000 ? "good" : "warning"}
              />
              <MetricRow
                label="Avg DB Query Time"
                value={`${stats.performance.databaseQueryAvgTime}ms`}
                benchmark="< 100ms target"
                status={stats.performance.databaseQueryAvgTime < 100 ? "good" : "warning"}
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
              <Suspense
                fallback={
                  <p className="py-8 text-center text-sm text-gray-500">Loading charts...</p>
                }
              >
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
                          <div className="h-2 w-40 bg-muted rounded">
                            <div
                              className="h-full bg-primary rounded"
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
                    variant={stats.rateLimit.deniedRequests24h < 10 ? "default" : "destructive"}
                  >
                    {stats.rateLimit.deniedRequests24h > 0
                      ? `${((stats.rateLimit.deniedRequests24h / stats.rateLimit.totalRequests24h) * 100).toFixed(2)}%`
                      : "0%"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Section */}
        <Card>
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

        {/* Payments & Subscriptions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Payments &amp; Subscriptions
            </CardTitle>
            <CardDescription>
              Paid &amp; comped tier grants (last 100). Use the form to comp a tier to a beta user
              without payment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Comp grant form */}
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-stone-200 bg-design-bg p-3">
              <div className="flex flex-col gap-1">
                <label
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  htmlFor="comp-user"
                >
                  User ID (UUID)
                </label>
                <input
                  id="comp-user"
                  value={compUserId}
                  onChange={(e) => setCompUserId(e.target.value)}
                  placeholder="a0000000-0000-…"
                  className="w-72 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-mono text-stone-700"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  className="text-[10px] uppercase tracking-wide text-slate-500"
                  htmlFor="comp-tier"
                >
                  Tier
                </label>
                <select
                  id="comp-tier"
                  value={compTier}
                  onChange={(e) => setCompTier(e.target.value as "starter" | "pro" | "free")}
                  className="rounded-md border border-stone-200 bg-white px-2 py-1 text-xs text-stone-700"
                >
                  <option value="starter">Starter (30d)</option>
                  <option value="pro">Pro (30d)</option>
                  <option value="free">Free (revoke)</option>
                </select>
              </div>
              <Button size="sm" onClick={handleCompGrant} disabled={compBusy || !compUserId.trim()}>
                {compBusy ? "Granting…" : "Comp grant"}
              </Button>
            </div>

            {paymentsLoading ? (
              <SkeletonList rows={3} />
            ) : paymentsError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{paymentsError}</AlertDescription>
              </Alert>
            ) : payments.length === 0 ? (
              <p className="text-sm text-gray-500">No payments yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between flex-wrap gap-2 rounded-xl border border-stone-200 bg-design-bg p-3 text-xs"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-slate-400">{p.user_id.slice(0, 8)}…</span>
                      {p.tier_granted && (
                        <Badge
                          variant="outline"
                          className="text-emerald-700 border-emerald-700/40 text-[10px] capitalize"
                        >
                          {p.tier_granted}
                        </Badge>
                      )}
                      {p.is_comp ? (
                        <Badge
                          variant="outline"
                          className="text-sky-700 border-sky-700/40 text-[10px]"
                        >
                          Comp
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          ₹{(p.amount / 100).toFixed(0)}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${p.status === "paid" ? "text-emerald-700 border-emerald-700/40" : "text-slate-500"}`}
                      >
                        {p.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-slate-600">
                      {p.period_end && (
                        <span>until {new Date(p.period_end).toLocaleDateString()}</span>
                      )}
                      <span>{new Date(p.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* User Fallback API Keys Section */}
        <Card>
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
            {apiKeyDataLoading ? (
              <SkeletonList rows={3} />
            ) : apiKeyDataError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{apiKeyDataError}</AlertDescription>
              </Alert>
            ) : apiKeyStatuses.length === 0 ? (
              <p className="text-sm text-gray-500">No users have configured a fallback key.</p>
            ) : (
              <div className="space-y-3">
                {apiKeyStatuses.slice(0, 20).map((row) => {
                  const userLogs = auditLogs.filter((l) => l.user_id === row.user_id).slice(0, 5);
                  return (
                    <div
                      key={row.user_id}
                      className="rounded-xl border border-stone-200 bg-design-bg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-400">
                            {row.user_id.slice(0, 8)}…
                          </span>
                          {row.has_own_key ? (
                            <Badge
                              variant="outline"
                              className="text-emerald-700 border-emerald-700/40 text-[10px]"
                            >
                              Key set
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 text-[10px]">
                              No key
                            </Badge>
                          )}
                          {row.use_own_key && (
                            <Badge
                              variant="outline"
                              className="text-sky-700 border-sky-700/40 text-[10px]"
                            >
                              Fallback ON
                            </Badge>
                          )}
                          {row.api_provider && (
                            <Badge variant="outline" className="text-[10px]">
                              {row.api_provider}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-600">
                          Updated {new Date(row.updated_at).toLocaleDateString()}
                        </span>
                      </div>
                      {userLogs.length > 0 && (
                        <div className="space-y-1">
                          {userLogs.map((log) => (
                            <div
                              key={log.id}
                              className="flex items-center gap-2 text-[11px] text-slate-500"
                            >
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${
                                  log.action === "saved"
                                    ? "bg-lime-400"
                                    : log.action === "deleted"
                                      ? "bg-red-400"
                                      : log.action === "used"
                                        ? "bg-sky-400"
                                        : "bg-yellow-400"
                                }`}
                              />
                              <span className="capitalize font-medium">{log.action}</span>
                              {log.provider && (
                                <span className="text-slate-600">· {log.provider}</span>
                              )}
                              {log.source && (
                                <span className="text-slate-600">· via {log.source}</span>
                              )}
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
  status?: "good" | "warning" | "error";
}

function StatCard({ icon, title, value, change, status }: StatCardProps) {
  const statusColors = {
    good: "text-green-700 bg-green-50 border-green-100",
    warning: "text-amber-700 bg-amber-50 border-amber-100",
    error: "text-red-700 bg-red-50 border-red-100",
    default: "text-stone-600 bg-design-bg border-stone-200",
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
  status: "good" | "warning";
}

function MetricRow({ label, value, benchmark, status }: MetricRowProps) {
  const textColor = status === "good" ? "text-green-700" : "text-amber-700";

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
