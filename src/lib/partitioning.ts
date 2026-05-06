/**
 * Database Partitioning Strategy
 *
 * Guidance for partitioning large PostgreSQL tables to improve query performance
 * at massive scale (100M+ rows). Useful for future scaling beyond 10K concurrent users.
 *
 * Partitioning Strategy:
 * 1. User-based partitioning: Split by user_id (most effective for multi-tenant)
 * 2. Time-based partitioning: Split by date/month (good for historical data)
 * 3. Hybrid approach: Combine user + time (best for calendars/posts)
 *
 * Current Status: Not implemented (premature for current scale)
 * Recommended trigger: When table reaches 50M+ rows or >500GB
 */

// ============================================================================
// PARTITION STRATEGY DOCUMENTATION
// ============================================================================

export const PARTITIONING_STRATEGY = {
  /**
   * Current scale: ~1M rows per table
   * Partitioning needed at: 50M+ rows
   * Timeline: 12-18 months away (if current growth continues)
   */
  timeline: {
    current: {
      calendars: '~500K rows',
      scheduled_posts: '~2M rows',
      user_profiles: '~50K rows',
    },
    partitioningNeeded: {
      calendars: '50M rows',
      scheduled_posts: '200M rows',
      user_profiles: '10M rows',
    },
    yearsUntilNeeded: 2,
  },

  /**
   * User-based partitioning (recommended for social-spark)
   */
  userPartitioning: {
    description:
      'Partition calendars and scheduled_posts by user_id to distribute data across partitions',
    advantages: [
      'Eliminates need to query all users when fetching user data',
      'Improves concurrent query performance',
      'Enables per-user backup/recovery',
      'Natural data isolation',
    ],
    disadvantages: [
      'Some queries (global analytics) still need to scan all partitions',
      'Partition pruning may not work for all queries',
    ],
    tablesToPartition: [
      'calendars (by user_id)',
      'scheduled_posts (by user_id)',
      'templates (by user_id)',
      'user_preferences (by user_id)',
    ],
  },

  /**
   * Time-based partitioning
   */
  timePartitioning: {
    description: 'Partition historical data by month/year',
    advantages: [
      'Clean archival strategy',
      'Easy to drop old partitions',
      'Good for time-series data',
    ],
    disadvantages: [
      'Queries across time ranges need to check multiple partitions',
      'Complex for user-specific time queries',
    ],
    tablesToPartition: [
      'api_metrics (by created_at, monthly)',
      'post_analytics (by created_at, monthly)',
      'error_logs (by timestamp, daily)',
    ],
  },

  /**
   * Hybrid approach (recommended)
   */
  hybridPartitioning: {
    description: 'Use user_id for user data, date for analytics',
    tables: {
      calendars: 'List partitions: user_id',
      scheduled_posts: 'List partitions: user_id',
      api_metrics: 'Range partitions: created_at (monthly)',
      post_analytics: 'Range partitions: created_at (monthly)',
    },
  },
};

// ============================================================================
// SQL MIGRATION FOR USER-BASED PARTITIONING
// ============================================================================

export const PARTITION_CALENDARS_SQL = `
-- Partition calendars table by user_id
-- This migration should only be run when table reaches 50M+ rows
-- Timeline: 2-3 years in the future

BEGIN;

-- Create partitioned table (new structure)
CREATE TABLE calendars_partitioned (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  platform TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY LIST (user_id);

-- Note: In practice, you'd need to:
-- 1. Create many partitions (one per 10K users, for example)
-- 2. Set up partition constraints
-- 3. Create indexes on each partition
-- 4. Migrate data using trigger-based approach
-- 5. Swap old table with new partitioned table

-- Example: Create partitions for user_id ranges
-- CREATE TABLE calendars_part_0000 
--   PARTITION OF calendars_partitioned
--   FOR VALUES IN (user_ids 0-10K);

-- Transfer data (this would be done in batches in production)
-- INSERT INTO calendars_partitioned
-- SELECT * FROM calendars
-- WHERE archived_at IS NULL;

-- Create indexes on each partition
-- CREATE INDEX idx_calendars_part_user_created
--   ON calendars_partitioned (user_id, created_at DESC);

-- Swap tables
-- ALTER TABLE calendars RENAME TO calendars_old;
-- ALTER TABLE calendars_partitioned RENAME TO calendars;

-- Drop old table after verification
-- DROP TABLE calendars_old;

COMMIT;
`;

export const PARTITION_SCHEDULED_POSTS_SQL = `
-- Partition scheduled_posts by user_id
-- Timeline: When table reaches 200M+ rows

BEGIN;

CREATE TABLE scheduled_posts_partitioned (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  calendar_id UUID NOT NULL,
  content TEXT NOT NULL,
  platforms JSONB,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'scheduled'::text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY LIST (user_id);

-- Follow same migration pattern as calendars_partitioned
-- Create partitions for each user_id range
-- Migrate data in batches
-- Create indexes on each partition
-- Swap tables

COMMIT;
`;

export const PARTITION_METRICS_SQL = `
-- Partition api_metrics by created_at (monthly)
-- Timeline: When table reaches 500M+ rows

BEGIN;

CREATE TABLE api_metrics_partitioned (
  id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  latency_ms INTEGER NOT NULL,
  user_id UUID,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (DATE_TRUNC('month', created_at));

-- Create partitions for each month
-- CREATE TABLE api_metrics_2026_01 
--   PARTITION OF api_metrics_partitioned
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- CREATE TABLE api_metrics_2026_02
--   PARTITION OF api_metrics_partitioned
--   FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Continue for each month...
-- Archive old partitions to separate storage

COMMIT;
`;

// ============================================================================
// PARTITIONING PERFORMANCE ANALYSIS
// ============================================================================

export const PERFORMANCE_PROJECTIONS = {
  /**
   * Query performance without partitioning
   */
  unpartitioned: {
    scenario: '200M scheduled_posts table',
    queries: {
      userCalendarPosts: {
        description: 'Get all posts for user',
        time: '2-3 seconds',
        reason: 'Full table scan with index on user_id',
      },
      globalAnalytics: {
        description: 'Get analytics across all users',
        time: '30-60 seconds',
        reason: 'Must aggregate across entire table',
      },
      rangeQuery: {
        description: 'Posts published in date range',
        time: '5-10 seconds',
        reason: 'Index on published_at helps but still large scan',
      },
    },
  },

  /**
   * Query performance with user-based partitioning
   */
  userPartitioned: {
    scenario: '200M scheduled_posts split by user (50K users)',
    tables: {
      perPartition: '4M rows per user partition',
      indexSize: 'Much smaller per-partition indexes',
    },
    queries: {
      userCalendarPosts: {
        description: 'Get all posts for user',
        time: '50-100ms',
        improvement: '20x-40x faster',
        reason: 'Only queries user partition (4M rows not 200M)',
      },
      globalAnalytics: {
        description: 'Get analytics across all users',
        time: '30-60 seconds (same)',
        improvement: 'No improvement (must still aggregate)',
        note: 'Use materialized views to optimize',
      },
      rangeQuery: {
        description: 'Posts published in date range',
        time: '500-1000ms',
        improvement: '5x-10x faster',
        reason: 'Partition pruning + smaller index scans',
      },
    },
  },

  /**
   * Hybrid partitioning performance
   */
  hybridPartitioned: {
    scenario: 'Users + time partitioning',
    examples: {
      userCurrentMonth: {
        description: 'User posts this month',
        time: '50ms',
        improvement: '100x faster',
      },
      userHistoricalRange: {
        description: 'User posts in date range',
        time: '200-300ms',
        improvement: '30x faster',
      },
      globalCurrentMonth: {
        description: 'All users posts this month',
        time: '5-10 seconds',
        improvement: '5x faster (fewer partitions to scan)',
      },
    },
  },
};

// ============================================================================
// IMPLEMENTATION CHECKLIST
// ============================================================================

export const PARTITIONING_CHECKLIST = [
  {
    phase: 'Planning',
    steps: [
      'Analyze table growth rate and projection',
      'Identify partition key (user_id vs date vs hybrid)',
      'Calculate partition count and size',
      'Plan migration downtime (if any)',
      'Design partition maintenance strategy',
    ],
  },
  {
    phase: 'Testing',
    steps: [
      'Create partitions on staging database',
      'Migrate sample data',
      'Test query performance improvements',
      'Test partition maintenance queries',
      'Load test with production data volume',
    ],
  },
  {
    phase: 'Migration',
    steps: [
      'Create new partitioned table structure',
      'Migrate data in batches (non-blocking)',
      'Validate data integrity',
      'Create indexes on all partitions',
      'Swap old table with partitioned table',
      'Update application queries if needed',
      'Monitor performance',
    ],
  },
  {
    phase: 'Maintenance',
    steps: [
      'Monitor partition sizes',
      'Archive old partitions',
      'Auto-create partitions for new ranges',
      'Monitor query performance',
      'Adjust partition strategy if needed',
    ],
  },
];

// ============================================================================
// WHEN TO PARTITION
// ============================================================================

export const PARTITION_TRIGGERS = {
  /**
   * Indicators that partitioning is needed
   */
  signs: [
    'Table exceeds 50GB in size',
    'Query performance degrades significantly (>2s for user-specific queries)',
    'Index maintenance becomes slow',
    'Table has 50M+ rows',
    'Backup/restore time exceeds 1 hour',
    'Replication lag becomes noticeable',
  ],

  /**
   * Reasons to delay partitioning
   */
  delays: [
    'Complexity: Partitioning adds operational complexity',
    'Not all queries benefit: Global queries still scan all partitions',
    'Maintenance: Requires careful planning and execution',
    'Application changes: Queries may need adjustment',
    'Current performance acceptable: Wait until pain point reached',
  ],

  /**
   * When partitioning is NOT needed
   */
  unnecessary: [
    'Table under 10GB (SSD storage is cheap)',
    'Query performance is acceptable',
    'No plans for massive scale',
    'Limited operational expertise',
    'Simpler optimization available (indexes, caching)',
  ],
};

// ============================================================================
// ALTERNATIVE SOLUTIONS (Before partitioning)
// ============================================================================

export const ALTERNATIVES_TO_PARTITIONING = {
  /**
   * Sharding: Application-level data distribution
   */
  sharding: {
    description: 'Distribute data across multiple database instances',
    advantages: [
      'Unlimited horizontal scaling',
      'Natural data isolation',
      'Can scale to billions of rows',
    ],
    disadvantages: [
      'Complex application logic',
      'Cross-shard queries difficult',
      'Data rebalancing is hard',
    ],
    timing: 'Consider when exceeding 1TB data',
  },

  /**
   * Archive old data
   */
  archiving: {
    description: 'Move historical data to separate archive tables',
    advantages: [
      'Keeps main table small',
      'Better query performance on current data',
      'Simple to implement',
    ],
    disadvantages: [
      'Historical queries slow',
      'Two-table strategy needed',
    ],
    timing: 'Implement as soon as possible',
  },

  /**
   * Materialized views
   */
  materializedViews: {
    description: 'Pre-compute aggregations and metrics',
    advantages: [
      'Eliminates expensive aggregations',
      'Simple queries become instant',
      'No partitioning needed',
    ],
    disadvantages: [
      'Storage overhead',
      'Refresh strategy needed',
    ],
    timing: 'Implement now for analytics',
  },

  /**
   * Read replicas
   */
  readReplicas: {
    description: 'Offload read queries to replica databases',
    advantages: [
      'Distributes query load',
      'Improves read performance',
      'High availability',
    ],
    disadvantages: [
      'Replication lag',
      'Write bottleneck remains',
    ],
    timing: 'Implement when needed for scale',
  },
};

// ============================================================================
// MONITORING & RECOMMENDATIONS
// ============================================================================

export function getPartitioningRecommendation(
  tableSize: number, // in rows
  tableStorageSize: number, // in GB
  queryLatency: number // in milliseconds
): {
  recommendation: string;
  urgency: 'low' | 'medium' | 'high';
  alternatives: string[];
} {
  if (tableSize < 10000000 && tableStorageSize < 10) {
    return {
      recommendation: 'Partitioning not needed yet. Focus on indexing and caching.',
      urgency: 'low',
      alternatives: ['Improve indexes', 'Implement caching', 'Query optimization'],
    };
  }

  if (tableSize < 50000000 && tableStorageSize < 50) {
    return {
      recommendation:
        'Partitioning upcoming. Start planning now. Implement materialized views.',
      urgency: 'medium',
      alternatives: [
        'Materialized views for analytics',
        'Archive old data',
        'Read replicas for scaling',
      ],
    };
  }

  return {
    recommendation: 'Start partitioning implementation. Consult DBA.',
    urgency: 'high',
    alternatives: ['Implement sharding', 'Multi-database setup', 'DBA consultation'],
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { PerformanceProjection } from './types';
export {
  PARTITIONING_STRATEGY,
  PARTITION_CALENDARS_SQL,
  PARTITION_SCHEDULED_POSTS_SQL,
  PARTITION_METRICS_SQL,
  PERFORMANCE_PROJECTIONS,
  PARTITIONING_CHECKLIST,
  PARTITION_TRIGGERS,
  ALTERNATIVES_TO_PARTITIONING,
};
