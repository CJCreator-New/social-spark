/**
 * Analytics Service
 *
 * Centralized event tracking using PostHog (or can be swapped for Segment, Amplitude, etc).
 *
 * Usage:
 * ```typescript
 * import { analytics } from '@/lib/analytics';
 *
 * // Track a simple event
 * analytics.track('calendar_generated', {
 *   industry: 'SaaS',
 *   platform: 'LinkedIn',
 *   postCount: 7,
 * });
 *
 * // Track a timed event
 * const timer = analytics.startTimer('generation_time');
 * // ... do work ...
 * timer.end({ success: true });
 *
 * // Set user properties
 * analytics.setUserProperties({
 *   email: 'user@example.com',
 *   plan: 'pro',
 * });
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Analytics event with properties.
 */
export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
}

/**
 * User properties for identification and segmentation.
 */
export interface UserProperties {
  email?: string;
  userId?: string;
  plan?: string;
  createdAt?: string;
  timezone?: string;
  industry?: string;
  [key: string]: any;
}

/**
 * Timer for tracking event duration.
 */
export interface EventTimer {
  eventName: string;
  startTime: number;
  end(properties?: Record<string, any>): void;
}

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================

class AnalyticsService {
  private enabled = false;
  private posthogKey: string | null = null;
  private userId: string | null = null;

  /**
   * Initialize analytics with PostHog.
   * Should be called early in app initialization.
   *
   * @param posthogKey PostHog API key
   * @param userId Unique user identifier
   *
   * @example
   * ```typescript
   * // In main.tsx or App.tsx
   * import { analytics } from '@/lib/analytics';
   *
   * analytics.init('phc_xxxxx', user.id);
   * ```
   */
  async init(posthogKey: string, userId: string): Promise<void> {
    this.posthogKey = posthogKey;
    this.userId = userId;

    // Only initialize if we have a valid key
    if (!posthogKey) {
      console.warn("Analytics disabled: Missing PostHog key");
      return;
    }

    try {
      // Dynamically import PostHog
      const posthog = await this.loadPostHog();

      if (posthog) {
        posthog.init(posthogKey, {
          api_host: "https://app.posthog.com",
          loaded: (ph: any) => {
            ph.identify(userId);
            this.enabled = true;
          },
        });
      }
    } catch (err) {
      console.error("Failed to initialize PostHog:", err);
    }
  }

  /**
   * Track an analytics event.
   *
   * @param eventName Name of the event
   * @param properties Optional event properties/metadata
   *
   * @example
   * ```typescript
   * analytics.track('calendar_generated', {
   *   industry: 'SaaS',
   *   platform: 'LinkedIn',
   *   postCount: 7,
   *   generationTime: 45000, // milliseconds
   * });
   * ```
   */
  track(eventName: string, properties?: Record<string, any>): void {
    if (!this.enabled) {
      // Log to console if analytics not initialized
      console.debug(`[Analytics] ${eventName}`, properties);
      return;
    }

    try {
      // @ts-ignore - PostHog is loaded dynamically
      if (typeof window !== "undefined" && window.posthog) {
        // @ts-ignore
        window.posthog.capture(eventName, properties || {});
      }
    } catch (err) {
      console.error("Failed to track event:", err);
    }
  }

  /**
   * Set properties on the current user.
   * Used for segmentation and filtering in PostHog.
   *
   * @param properties User properties
   *
   * @example
   * ```typescript
   * analytics.setUserProperties({
   *   plan: 'pro',
   *   timezone: 'America/New_York',
   *   industry: 'SaaS',
   * });
   * ```
   */
  setUserProperties(properties: UserProperties): void {
    if (!this.enabled) {
      console.debug("[Analytics] Set user properties", properties);
      return;
    }

    try {
      // @ts-ignore
      if (typeof window !== "undefined" && window.posthog) {
        // @ts-ignore
        window.posthog.people.set(properties);
      }
    } catch (err) {
      console.error("Failed to set user properties:", err);
    }
  }

  /**
   * Start a timer to track event duration.
   *
   * @param eventName Name of the event to track
   * @returns Timer object with .end() method
   *
   * @example
   * ```typescript
   * const timer = analytics.startTimer('calendar_generation');
   *
   * // ... generate calendar ...
   *
   * timer.end({ success: true, postCount: 7 });
   * // Logs event with duration_ms property
   * ```
   */
  startTimer(eventName: string): EventTimer {
    const startTime = performance.now();

    return {
      eventName,
      startTime,
      end: (properties?: Record<string, any>) => {
        const durationMs = Math.round(performance.now() - startTime);
        this.track(eventName, {
          duration_ms: durationMs,
          ...properties,
        });
      },
    };
  }

  /**
   * Track when user completes a workflow step.
   * Useful for conversion funnels.
   *
   * @param step Step name (e.g., "form_step_1_complete", "calendar_generated", "posted_to_platform")
   * @param properties Additional properties
   */
  trackWorkflowStep(step: string, properties?: Record<string, any>): void {
    this.track(`workflow_${step}`, {
      step,
      timestamp: new Date().toISOString(),
      ...properties,
    });
  }

  /**
   * Track an error event for debugging and monitoring.
   *
   * @param error Error name or message
   * @param context Additional context about the error
   *
   * @example
   * ```typescript
   * try {
   *   await generateCalendar(formData);
   * } catch (err) {
   *   analytics.trackError('calendar_generation_failed', {
   *     industry: formData.industry,
   *     errorMessage: err.message,
   *   });
   * }
   * ```
   */
  trackError(error: string, context?: Record<string, any>): void {
    this.track("error_occurred", {
      error_name: error,
      error_context: context,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get the current PostHog instance.
   * Use only if you need direct access to PostHog API.
   *
   * @returns PostHog instance or null if not initialized
   */
  getPostHog(): any {
    if (typeof window !== "undefined") {
      // @ts-ignore
      return window.posthog || null;
    }
    return null;
  }

  /**
   * Check if analytics is currently enabled.
   *
   * @returns true if analytics is initialized and ready
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Dynamically load PostHog library from CDN.
   * @private
   */
  private async loadPostHog(): Promise<any> {
    if (typeof window === "undefined") return null;

    // Check if already loaded
    // @ts-ignore
    if (window.posthog) return window.posthog;

    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://cdn.posthog.com/array.js";
      script.async = true;
      script.onload = () => {
        // @ts-ignore
        resolve(window.posthog);
      };
      script.onerror = () => {
        console.error("Failed to load PostHog script");
        resolve(null);
      };
      document.head.appendChild(script);
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global singleton instance of the analytics service.
 *
 * Usage:
 * ```typescript
 * import { analytics } from '@/lib/analytics';
 *
 * // Initialize in App.tsx or main.tsx
 * await analytics.init(process.env.VITE_POSTHOG_KEY, user.id);
 *
 * // Track events throughout the app
 * analytics.track('calendar_generated', { postCount: 7 });
 * ```
 */
export const analytics = new AnalyticsService();

// ============================================================================
// PRESET EVENT NAMES (For consistency and discoverability)
// ============================================================================

/**
 * Preset event names used throughout the app.
 * Using these constants prevents typos and makes events discoverable.
 *
 * Usage:
 * ```typescript
 * import { ANALYTICS_EVENTS } from '@/lib/analytics';
 *
 * analytics.track(ANALYTICS_EVENTS.CALENDAR_GENERATED, {
 *   postCount: 7,
 * });
 * ```
 */
export const ANALYTICS_EVENTS = {
  // Generation events
  CALENDAR_GENERATION_STARTED: "calendar_generation_started",
  CALENDAR_GENERATION_COMPLETED: "calendar_generation_completed",
  CALENDAR_GENERATION_FAILED: "calendar_generation_failed",
  SINGLE_POST_GENERATION_STARTED: "single_post_generation_started",
  SINGLE_POST_GENERATION_COMPLETED: "single_post_generation_completed",
  SINGLE_POST_GENERATION_FAILED: "single_post_generation_failed",
  POST_REGENERATED: "post_regenerated",
  POST_TWEAK_APPLIED: "post_tweak_applied",

  // Scheduling events
  CALENDAR_SCHEDULED: "calendar_scheduled",
  CALENDAR_BULK_SCHEDULED: "calendar_bulk_scheduled",
  POST_PUBLISHED: "post_published",
  POST_PUBLISH_FAILED: "post_publish_failed",

  // Calendar management
  CALENDAR_CREATED: "calendar_created",
  CALENDAR_DELETED: "calendar_deleted",
  CALENDAR_BULK_DELETED: "calendar_bulk_deleted",
  CALENDAR_VIEWED: "calendar_viewed",
  CALENDAR_EXPORTED: "calendar_exported",

  // Draft events
  DRAFT_SAVED: "draft_saved",
  DRAFT_RESTORED: "draft_restored",
  DRAFT_VERSION_CREATED: "draft_version_created",

  // Template events
  TEMPLATE_SAVED: "template_saved",
  TEMPLATE_LOADED: "template_loaded",
  TEMPLATE_DELETED: "template_deleted",

  // Form events
  FORM_STEP_COMPLETED: "form_step_completed",
  FORM_SUBMITTED: "form_submitted",
  FORM_VALIDATION_ERROR: "form_validation_error",

  // Error events
  API_ERROR: "api_error",
  VALIDATION_ERROR: "validation_error",
  NETWORK_ERROR: "network_error",
  UNKNOWN_ERROR: "unknown_error",

  // User engagement
  EXPORT_CALENDAR: "export_calendar",
  COPY_POST: "copy_post",
  SHARE_POST: "share_post",
  PLATFORM_CONNECTED: "platform_connected",

  // Settings
  SETTINGS_CHANGED: "settings_changed",
  TIMEZONE_CHANGED: "timezone_changed",
} as const;

/**
 * Property names for common event metadata.
 * Ensures consistent property naming across events.
 *
 * Usage:
 * ```typescript
 * analytics.track(ANALYTICS_EVENTS.CALENDAR_GENERATED, {
 *   [ANALYTICS_PROPERTIES.POST_COUNT]: 7,
 *   [ANALYTICS_PROPERTIES.PLATFORM]: 'LinkedIn',
 *   [ANALYTICS_PROPERTIES.DURATION_MS]: 45000,
 * });
 * ```
 */
export const ANALYTICS_PROPERTIES = {
  // Timing
  DURATION_MS: "duration_ms",
  GENERATION_TIME_MS: "generation_time_ms",
  API_LATENCY_MS: "api_latency_ms",

  // Content properties
  POST_COUNT: "post_count",
  PLATFORM: "platform",
  INDUSTRY: "industry",
  CALENDAR_ID: "calendar_id",
  POST_DAY: "post_day",

  // Status
  SUCCESS: "success",
  ERROR_MESSAGE: "error_message",
  ERROR_CODE: "error_code",
  REASON: "reason",

  // User context
  USER_ID: "user_id",
  TIMEZONE: "timezone",
  PLAN: "plan",

  // Batch operations
  BATCH_SIZE: "batch_size",
  BATCH_SUCCESS_COUNT: "batch_success_count",
  BATCH_FAILURE_COUNT: "batch_failure_count",
} as const;
