/**
 * Supabase Connection Pooling Configuration
 *
 * Configures optimal connection pool settings for Supabase PostgreSQL backend.
 * Connection pooling improves performance by reusing database connections
 * instead of creating new ones for each request.
 *
 * Configuration Guide:
 * https://supabase.com/docs/guides/platform/postgres-extensions#connection-pooling
 *
 * Pool Modes:
 * - Session: One connection per client session (default, simplest)
 * - Transaction: One connection per transaction (better for high load)
 * - Statement: One connection per statement (highest performance but most restrictive)
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

export interface PoolConfig {
  /**
   * Pool mode
   * - 'session': Default, one connection per client session
   * - 'transaction': One connection per transaction (recommended for scaling)
   * - 'statement': One connection per statement (highest performance)
   */
  mode: 'session' | 'transaction' | 'statement';

  /**
   * Maximum connections in pool
   */
  maxConnections: number;

  /**
   * Minimum idle connections to maintain
   */
  minIdleConnections: number;

  /**
   * Connection idle timeout in seconds
   */
  idleTimeout: number;

  /**
   * Maximum connection lifetime in seconds
   */
  maxConnectionLifetime: number;

  /**
   * Connection timeout in milliseconds
   */
  connectionTimeout: number;

  /**
   * Enable connection pooling
   */
  enabled: boolean;
}

export interface PoolMetrics {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalConnections: number;
  utilizationPercent: number;
  averageWaitTime: number;
}

// ============================================================================
// PREDEFINED CONFIGURATIONS
// ============================================================================

/**
 * Configuration presets for different scales
 */
export const POOL_PRESETS = {
  /**
   * Development environment - minimal connections
   */
  development: {
    mode: 'session' as const,
    maxConnections: 5,
    minIdleConnections: 1,
    idleTimeout: 60,
    maxConnectionLifetime: 600,
    connectionTimeout: 5000,
    enabled: true,
  },

  /**
   * Small production - up to 100 concurrent users
   */
  smallProduction: {
    mode: 'transaction' as const,
    maxConnections: 20,
    minIdleConnections: 5,
    idleTimeout: 120,
    maxConnectionLifetime: 1800,
    connectionTimeout: 10000,
    enabled: true,
  },

  /**
   * Medium production - 100-1000 concurrent users
   */
  mediumProduction: {
    mode: 'transaction' as const,
    maxConnections: 50,
    minIdleConnections: 10,
    idleTimeout: 180,
    maxConnectionLifetime: 3600,
    connectionTimeout: 15000,
    enabled: true,
  },

  /**
   * Large production - 1000-5000 concurrent users
   * Current target for social-spark
   */
  largeProduction: {
    mode: 'transaction' as const,
    maxConnections: 100,
    minIdleConnections: 25,
    idleTimeout: 300,
    maxConnectionLifetime: 3600,
    connectionTimeout: 20000,
    enabled: true,
  },

  /**
   * Enterprise - 5000+ concurrent users
   */
  enterprise: {
    mode: 'statement' as const,
    maxConnections: 200,
    minIdleConnections: 50,
    idleTimeout: 600,
    maxConnectionLifetime: 7200,
    connectionTimeout: 30000,
    enabled: true,
  },
};

// ============================================================================
// CONNECTION POOL MANAGER
// ============================================================================

class ConnectionPoolManager {
  private config: PoolConfig;
  private metrics: PoolMetrics = {
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    totalConnections: 0,
    utilizationPercent: 0,
    averageWaitTime: 0,
  };
  private connectionTimes: number[] = [];

  constructor(config: PoolConfig) {
    this.config = config;
    this.initializeMetricsTracking();
  }

  /**
   * Initialize metrics tracking
   */
  private initializeMetricsTracking(): void {
    // Track connection pool metrics every 30 seconds
    setInterval(() => this.updateMetrics(), 30000);
  }

  /**
   * Update pool metrics
   */
  private updateMetrics(): void {
    // In a real implementation, these would come from Supabase
    // For now, we calculate based on connection attempts
    this.metrics.totalConnections = this.config.maxConnections;
    this.metrics.utilizationPercent = Math.round(
      (this.metrics.activeConnections / this.config.maxConnections) * 100
    );

    if (this.connectionTimes.length > 0) {
      this.metrics.averageWaitTime = Math.round(
        this.connectionTimes.reduce((a, b) => a + b, 0) / this.connectionTimes.length
      );
    }

    // Keep only recent connection times (last hour)
    const oneHourAgo = Date.now() - 3600000;
    this.connectionTimes = this.connectionTimes.filter(
      time => time > oneHourAgo
    ) as any;
  }

  /**
   * Get current pool configuration
   */
  getConfig(): PoolConfig {
    return { ...this.config };
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get connection pool URL for Supabase
   * Format: postgresql://user:password@host:port/database?sslmode=require
   */
  getConnectionUrl(baseUrl: string): string {
    const poolParams = this.getPoolParams();
    return `${baseUrl}?${poolParams}`;
  }

  /**
   * Get pool parameters as query string
   */
  private getPoolParams(): string {
    const params = new URLSearchParams();
    params.append('sslmode', 'require');
    params.append('pool_mode', this.config.mode);
    params.append('max_client_conn', String(this.config.maxConnections));
    params.append('idle_in_transaction_session_timeout', String(this.config.idleTimeout * 1000));
    return params.toString();
  }

  /**
   * Check if pool utilization is healthy
   */
  isHealthy(): boolean {
    const metrics = this.getMetrics();
    
    // Consider healthy if utilization is below 80%
    if (metrics.utilizationPercent > 80) {
      console.warn(
        `⚠ Connection pool utilization high: ${metrics.utilizationPercent}%`
      );
      return false;
    }

    // Consider healthy if waiting requests are minimal
    if (metrics.waitingRequests > this.config.maxConnections / 2) {
      console.warn(
        `⚠ High number of waiting requests: ${metrics.waitingRequests}`
      );
      return false;
    }

    return true;
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getMetrics();

    if (metrics.utilizationPercent > 80) {
      recommendations.push(
        `Consider increasing max_connections (currently ${this.config.maxConnections})`
      );
    }

    if (metrics.averageWaitTime > 1000) {
      recommendations.push(
        `High average connection wait time (${metrics.averageWaitTime}ms). Consider switching to 'statement' pool mode.`
      );
    }

    if (metrics.waitingRequests > this.config.maxConnections / 2) {
      recommendations.push(
        `Many waiting requests. Consider optimizing queries or increasing max_connections.`
      );
    }

    if (this.config.mode === 'session' && metrics.utilizationPercent > 50) {
      recommendations.push(
        `Current pool mode is 'session'. Consider switching to 'transaction' for better scalability.`
      );
    }

    return recommendations;
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(newConfig: Partial<PoolConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Connection pool configuration updated:', this.config);
  }

  /**
   * Get suggested configuration for current load
   */
  getSuggestedConfig(): PoolConfig {
    const metrics = this.getMetrics();

    // If utilization is high, suggest increasing connections
    if (metrics.utilizationPercent > 80) {
      return {
        ...this.config,
        maxConnections: this.config.maxConnections * 1.5,
      };
    }

    // If many requests waiting, suggest transaction mode
    if (metrics.waitingRequests > 10) {
      return {
        ...this.config,
        mode: 'transaction' as const,
      };
    }

    // If very high load and many requests, suggest statement mode
    if (metrics.utilizationPercent > 90 && metrics.waitingRequests > 50) {
      return {
        ...this.config,
        mode: 'statement' as const,
        maxConnections: Math.min(
          this.config.maxConnections * 2,
          200
        ),
      };
    }

    return this.config;
  }
}

// ============================================================================
// SUPABASE POOL CONFIGURATION
// ============================================================================

/**
 * Get optimal pool configuration based on environment and load
 */
export function getOptimalPoolConfig(environment: 'development' | 'production', scale: 'small' | 'medium' | 'large' | 'enterprise' = 'medium'): PoolConfig {
  if (environment === 'development') {
    return POOL_PRESETS.development;
  }

  switch (scale) {
    case 'small':
      return POOL_PRESETS.smallProduction;
    case 'medium':
      return POOL_PRESETS.mediumProduction;
    case 'large':
      return POOL_PRESETS.largeProduction;
    case 'enterprise':
      return POOL_PRESETS.enterprise;
    default:
      return POOL_PRESETS.mediumProduction;
  }
}

/**
 * Initialize connection pool with optimal settings
 * Call this during app initialization
 */
export function initializeConnectionPool(
  config?: Partial<PoolConfig>
): ConnectionPoolManager {
  const environment = import.meta.env.MODE === 'production' ? 'production' : 'development';
  const baseConfig = getOptimalPoolConfig(environment, 'large'); // social-spark is at 'large' scale

  const finalConfig: PoolConfig = {
    ...baseConfig,
    ...config,
  };

  const poolManager = new ConnectionPoolManager(finalConfig);

  console.log('Connection pool initialized:', {
    mode: finalConfig.mode,
    maxConnections: finalConfig.maxConnections,
    environment,
  });

  return poolManager;
}

// ============================================================================
// MONITORING & LOGGING
// ============================================================================

/**
 * Log pool health status
 */
export function logPoolHealth(manager: ConnectionPoolManager): void {
  const metrics = manager.getMetrics();
  const recommendations = manager.getRecommendations();

  console.group('📊 Connection Pool Health');
  console.log(`Active: ${metrics.activeConnections}/${metrics.totalConnections}`);
  console.log(`Idle: ${metrics.idleConnections}`);
  console.log(`Waiting: ${metrics.waitingRequests}`);
  console.log(`Utilization: ${metrics.utilizationPercent}%`);
  console.log(`Avg Wait: ${metrics.averageWaitTime}ms`);
  console.log(`Health: ${manager.isHealthy() ? '✅ Healthy' : '⚠ Warning'}`);

  if (recommendations.length > 0) {
    console.log('\nRecommendations:');
    recommendations.forEach(rec => console.log(`  • ${rec}`));
  }

  console.groupEnd();
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { PoolConfig, PoolMetrics };
export { ConnectionPoolManager, POOL_PRESETS };

// Create and export default pool manager instance
const defaultPoolManager = initializeConnectionPool();
export { defaultPoolManager as poolManager };
