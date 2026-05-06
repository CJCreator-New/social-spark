/**
 * Performance Monitoring Service
 *
 * Tracks API latency, error rates, database query times, and other performance metrics.
 * Stores metrics in Supabase for historical analysis and reporting.
 *
 * Integration points:
 * - API calls (via fetch interceptor)
 * - Database queries (via Supabase client)
 * - Error tracking (global error handler)
 * - Metrics export (Datadog, New Relic, etc)
 *
 * Usage:
 *   import { performanceMonitor } from '@/lib/monitoring';
 *
 *   // Track API call
 *   performanceMonitor.recordApiCall('/api/calendars', 'GET', 200, 125, userId);
 *
 *   // Track database query
 *   performanceMonitor.recordDatabaseQuery('calendars', 'SELECT', 45, true);
 *
 *   // Track error
 *   performanceMonitor.recordError('ValidationError', 'Invalid input', 'profile');
 *
 *   // Get current metrics
 *   const stats = performanceMonitor.getMetrics();
 */

import { supabase } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface ApiMetric {
  id?: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  status_code: number;
  latency_ms: number;
  user_id?: string;
  timestamp?: Date;
  error?: string;
}

export interface DatabaseMetric {
  id?: string;
  table_name: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  duration_ms: number;
  success: boolean;
  error?: string;
  timestamp?: Date;
}

export interface ErrorMetric {
  id?: string;
  error_type: string;
  message: string;
  context?: string;
  stack_trace?: string;
  user_id?: string;
  timestamp?: Date;
}

export interface PerformanceMetrics {
  period: {
    start: Date;
    end: Date;
  };
  api: {
    totalRequests: number;
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    successRate: number;
    topEndpoints: Array<{ endpoint: string; count: number; avgLatency: number }>;
  };
  database: {
    totalQueries: number;
    avgDuration: number;
    p95Duration: number;
    errorRate: number;
    successRate: number;
    topTables: Array<{ table: string; count: number; avgDuration: number }>;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    recent: ErrorMetric[];
  };
}

// ============================================================================
// PERFORMANCE MONITORING SERVICE
// ============================================================================

class PerformanceMonitoringService {
  private apiMetrics: ApiMetric[] = [];
  private dbMetrics: DatabaseMetric[] = [];
  private errorMetrics: ErrorMetric[] = [];
  private batchSize = 50; // Send metrics to DB when batch reaches this size
  private flushInterval = 60000; // Flush metrics every 60 seconds
  private lastFlush = Date.now();

  constructor() {
    // Periodically flush metrics to database
    setInterval(() => this.flush(), this.flushInterval);
  }

  /**
   * Record an API call metric
   */
  recordApiCall(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    statusCode: number,
    latencyMs: number,
    userId?: string,
    error?: string
  ): void {
    const metric: ApiMetric = {
      endpoint,
      method,
      status_code: statusCode,
      latency_ms: latencyMs,
      user_id: userId,
      timestamp: new Date(),
      error,
    };

    this.apiMetrics.push(metric);

    // Auto-flush if batch size reached
    if (this.apiMetrics.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Record a database query metric
   */
  recordDatabaseQuery(
    tableName: string,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    durationMs: number,
    success: boolean,
    error?: string
  ): void {
    const metric: DatabaseMetric = {
      table_name: tableName,
      operation,
      duration_ms: durationMs,
      success,
      error,
      timestamp: new Date(),
    };

    this.dbMetrics.push(metric);

    // Auto-flush if batch size reached
    if (this.dbMetrics.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Record an error event
   */
  recordError(
    errorType: string,
    message: string,
    context?: string,
    stackTrace?: string,
    userId?: string
  ): void {
    const metric: ErrorMetric = {
      error_type: errorType,
      message,
      context,
      stack_trace: stackTrace,
      user_id: userId,
      timestamp: new Date(),
    };

    this.errorMetrics.push(metric);

    // Auto-flush errors immediately (they're important)
    if (this.errorMetrics.length >= 10) {
      this.flush();
    }
  }

  /**
   * Flush accumulated metrics to Supabase
   */
  async flush(): Promise<void> {
    try {
      if (this.apiMetrics.length === 0 && this.dbMetrics.length === 0 && this.errorMetrics.length === 0) {
        return;
      }

      // Send API metrics
      if (this.apiMetrics.length > 0) {
        await supabase.from('api_metrics').insert(this.apiMetrics).throwOnError();
        this.apiMetrics = [];
      }

      // Send database metrics
      if (this.dbMetrics.length > 0) {
        await supabase.from('query_performance').insert(this.dbMetrics).throwOnError();
        this.dbMetrics = [];
      }

      // Send error metrics
      if (this.errorMetrics.length > 0) {
        await supabase.from('error_logs').insert(this.errorMetrics).throwOnError();
        this.errorMetrics = [];
      }

      this.lastFlush = Date.now();
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      // Keep metrics in memory for retry on next flush
    }
  }

  /**
   * Get current performance metrics (in-memory only, not from DB)
   */
  getMetrics(): PerformanceMetrics {
    const allMetrics = [...this.apiMetrics];
    const allDbMetrics = [...this.dbMetrics];
    const allErrorMetrics = [...this.errorMetrics];

    // Calculate API metrics
    const apiLatencies = allMetrics.map(m => m.latency_ms).sort((a, b) => a - b);
    const apiSuccessful = allMetrics.filter(m => m.status_code < 400);
    const apiErrors = allMetrics.filter(m => m.status_code >= 400);

    // Calculate database metrics
    const dbDurations = allDbMetrics.map(m => m.duration_ms).sort((a, b) => a - b);
    const dbSuccessful = allDbMetrics.filter(m => m.success);
    const dbFailed = allDbMetrics.filter(m => !m.success);

    // Group API metrics by endpoint
    const endpointGroups = new Map<string, ApiMetric[]>();
    allMetrics.forEach(m => {
      if (!endpointGroups.has(m.endpoint)) {
        endpointGroups.set(m.endpoint, []);
      }
      endpointGroups.get(m.endpoint)!.push(m);
    });

    // Group database metrics by table
    const tableGroups = new Map<string, DatabaseMetric[]>();
    allDbMetrics.forEach(m => {
      if (!tableGroups.has(m.table_name)) {
        tableGroups.set(m.table_name, []);
      }
      tableGroups.get(m.table_name)!.push(m);
    });

    // Group errors by type
    const errorsByType: Record<string, number> = {};
    allErrorMetrics.forEach(e => {
      errorsByType[e.error_type] = (errorsByType[e.error_type] || 0) + 1;
    });

    return {
      period: {
        start: new Date(Date.now() - 3600000), // Last hour
        end: new Date(),
      },
      api: {
        totalRequests: allMetrics.length,
        avgLatency: apiLatencies.length > 0 ? Math.round(apiLatencies.reduce((a, b) => a + b, 0) / apiLatencies.length) : 0,
        p95Latency: apiLatencies.length > 0 ? apiLatencies[Math.floor(apiLatencies.length * 0.95)] : 0,
        p99Latency: apiLatencies.length > 0 ? apiLatencies[Math.floor(apiLatencies.length * 0.99)] : 0,
        errorRate: allMetrics.length > 0 ? Math.round((apiErrors.length / allMetrics.length) * 100) : 0,
        successRate: allMetrics.length > 0 ? Math.round((apiSuccessful.length / allMetrics.length) * 100) : 100,
        topEndpoints: Array.from(endpointGroups.entries())
          .map(([endpoint, metrics]) => ({
            endpoint,
            count: metrics.length,
            avgLatency: Math.round(metrics.reduce((a, b) => a + b.latency_ms, 0) / metrics.length),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      },
      database: {
        totalQueries: allDbMetrics.length,
        avgDuration: dbDurations.length > 0 ? Math.round(dbDurations.reduce((a, b) => a + b, 0) / dbDurations.length) : 0,
        p95Duration: dbDurations.length > 0 ? dbDurations[Math.floor(dbDurations.length * 0.95)] : 0,
        errorRate: allDbMetrics.length > 0 ? Math.round((dbFailed.length / allDbMetrics.length) * 100) : 0,
        successRate: allDbMetrics.length > 0 ? Math.round((dbSuccessful.length / allDbMetrics.length) * 100) : 100,
        topTables: Array.from(tableGroups.entries())
          .map(([table, metrics]) => ({
            table,
            count: metrics.length,
            avgDuration: Math.round(metrics.reduce((a, b) => a + b.duration_ms, 0) / metrics.length),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      },
      errors: {
        total: allErrorMetrics.length,
        byType: errorsByType,
        recent: allErrorMetrics.slice(-10),
      },
    };
  }

  /**
   * Get time since last flush
   */
  getTimeSinceLastFlush(): number {
    return Date.now() - this.lastFlush;
  }

  /**
   * Clear all in-memory metrics (useful for testing)
   */
  clear(): void {
    this.apiMetrics = [];
    this.dbMetrics = [];
    this.errorMetrics = [];
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitoringService();

// ============================================================================
// FETCH INTERCEPTOR
// ============================================================================

/**
 * Intercept fetch calls to automatically record API metrics
 * Call this in your app initialization
 */
export function initializeFetchInterceptor(): void {
  const originalFetch = window.fetch;

  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const startTime = performance.now();
    const [resource] = args;
    const method = (args[1]?.method as string) || 'GET';

    try {
      const response = await originalFetch.apply(this, args);
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      // Extract endpoint from URL
      const url = typeof resource === 'string' ? resource : resource.url;
      const endpoint = new URL(url, window.location.origin).pathname;

      // Record metric
      performanceMonitor.recordApiCall(
        endpoint,
        method as any,
        response.status,
        latencyMs
      );

      return response;
    } catch (error) {
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      const url = typeof resource === 'string' ? resource : resource.url;
      const endpoint = new URL(url, window.location.origin).pathname;

      performanceMonitor.recordApiCall(
        endpoint,
        method as any,
        0,
        latencyMs,
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  };
}

// ============================================================================
// DATADOG INTEGRATION
// ============================================================================

export interface DatadogConfig {
  apiKey: string;
  site: 'datadoghq.com' | 'datadoghq.eu';
  service: string;
  environment: string;
}

/**
 * Export metrics to Datadog
 */
export async function exportToDatadog(config: DatadogConfig): Promise<void> {
  try {
    const metrics = performanceMonitor.getMetrics();
    const timestamp = Math.floor(Date.now() / 1000);

    const payload = {
      series: [
        {
          metric: 'social_spark.api.latency.avg',
          points: [[timestamp, metrics.api.avgLatency]],
          type: 'gauge',
          tags: [`service:${config.service}`, `env:${config.environment}`],
        },
        {
          metric: 'social_spark.api.latency.p95',
          points: [[timestamp, metrics.api.p95Latency]],
          type: 'gauge',
          tags: [`service:${config.service}`, `env:${config.environment}`],
        },
        {
          metric: 'social_spark.api.success_rate',
          points: [[timestamp, metrics.api.successRate]],
          type: 'gauge',
          tags: [`service:${config.service}`, `env:${config.environment}`],
        },
        {
          metric: 'social_spark.database.duration.avg',
          points: [[timestamp, metrics.database.avgDuration]],
          type: 'gauge',
          tags: [`service:${config.service}`, `env:${config.environment}`],
        },
        {
          metric: 'social_spark.errors.total',
          points: [[timestamp, metrics.errors.total]],
          type: 'gauge',
          tags: [`service:${config.service}`, `env:${config.environment}`],
        },
      ],
    };

    const response = await fetch(
      `https://api.${config.site}/api/v1/series`,
      {
        method: 'POST',
        headers: {
          'DD-API-KEY': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      console.warn('Failed to export metrics to Datadog:', response.statusText);
    }
  } catch (error) {
    console.error('Error exporting to Datadog:', error);
  }
}

// ============================================================================
// NEW RELIC INTEGRATION
// ============================================================================

export interface NewRelicConfig {
  licenseKey: string;
  accountId: string;
  apiEndpoint?: string;
}

/**
 * Export metrics to New Relic
 */
export async function exportToNewRelic(config: NewRelicConfig): Promise<void> {
  try {
    const metrics = performanceMonitor.getMetrics();
    const endpoint = config.apiEndpoint || 'https://api.newrelic.com/v1/accounts/' + config.accountId + '/metrics';

    const payload = {
      metrics: [
        {
          name: 'social_spark.api.latency.avg',
          type: 'gauge',
          value: metrics.api.avgLatency,
          timestamp: Date.now(),
          tags: {
            'app.name': 'social-spark',
          },
        },
        {
          name: 'social_spark.api.success_rate',
          type: 'gauge',
          value: metrics.api.successRate,
          timestamp: Date.now(),
          tags: {
            'app.name': 'social-spark',
          },
        },
        {
          name: 'social_spark.database.duration.avg',
          type: 'gauge',
          value: metrics.database.avgDuration,
          timestamp: Date.now(),
          tags: {
            'app.name': 'social-spark',
          },
        },
      ],
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'X-License-Key': config.licenseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn('Failed to export metrics to New Relic:', response.statusText);
    }
  } catch (error) {
    console.error('Error exporting to New Relic:', error);
  }
}
