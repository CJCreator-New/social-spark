/**
 * Admin Dashboard
 *
 * Real-time monitoring dashboard for app health, performance, and usage.
 * Shows statistics, performance metrics, errors, and analytics.
 *
 * Access: /admin (admin users only)
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AlertCircle, Activity, TrendingUp, Users, Calendar, Zap } from 'lucide-react';
import { fetchAdminStats, AdminStats } from '@/lib/admin';
import { SkeletonList } from '@/components/SkeletonList';

// ============================================================================
// ADMIN DASHBOARD COMPONENT
// ============================================================================

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch stats on mount and periodically
  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const data = await fetchAdminStats();
        setStats(data);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load admin stats');
      } finally {
        setLoading(false);
      }
    };

    loadStats();

    // Refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="w-full space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-gray-500">Real-time monitoring and analytics</p>
        </div>
        <Button
          size="sm"
          onClick={() => window.location.reload()}
        >
          Refresh
        </Button>
      </div>

      {/* Last Updated */}
      <div className="text-sm text-gray-500">
        Last updated: {lastUpdated.toLocaleTimeString()} • Auto-refreshes every 30s
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
            {Object.keys(stats.usage.platformDistribution).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(stats.usage.platformDistribution).map(([name, value]) => ({
                      name,
                      value,
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name} (${value})`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'].map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500">No platform data available</p>
            )}
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
