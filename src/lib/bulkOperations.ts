/**
 * Bulk Operations Service
 *
 * Provides utilities for bulk operations like scheduling multiple calendars,
 * deleting multiple calendars, and applying tweaks to multiple posts.
 *
 * Usage:
 * ```typescript
 * import { bulkScheduleCalendars, bulkDeleteCalendars } from '@/lib/bulkOperations';
 *
 * // Bulk schedule
 * const results = await bulkScheduleCalendars(calendarIds, {
 *   scheduledFor: '2025-06-15T09:00:00Z',
 * });
 *
 * // Bulk delete
 * await bulkDeleteCalendars(calendarIds);
 * ```
 */

import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of a bulk operation on a single calendar.
 */
export interface BulkOperationResult {
  calendarId: string;
  success: boolean;
  error?: string;
}

/**
 * Scheduled post data for bulk scheduling.
 */
export interface ScheduledPostData {
  calendar_id: string;
  post_day: number;
  scheduled_for: string;
  status: "scheduled" | "draft" | "published";
}

// ============================================================================
// BULK SCHEDULING
// ============================================================================

/**
 * Options for bulk scheduling operation.
 */
interface BulkScheduleOptions {
  /** ISO timestamp when posts should be scheduled for */
  scheduledFor: string;
  /** Optional timezone for the scheduled time */
  timezone?: string;
}

/**
 * Bulk schedule multiple calendars.
 * Creates scheduled_posts entries for all posts in the calendars.
 *
 * @param calendarIds Array of calendar IDs to schedule
 * @param options Scheduling options
 * @returns Array of results for each calendar
 *
 * @example
 * ```typescript
 * const results = await bulkScheduleCalendars(['cal-1', 'cal-2'], {
 *   scheduledFor: '2025-06-15T09:00:00Z',
 * });
 *
 * const successful = results.filter(r => r.success).length;
 * console.log(`Scheduled ${successful}/${results.length} calendars`);
 * ```
 */
export async function bulkScheduleCalendars(
  calendarIds: string[],
  options: BulkScheduleOptions
): Promise<BulkOperationResult[]> {
  const results: BulkOperationResult[] = [];

  for (const calendarId of calendarIds) {
    try {
      // Fetch the calendar posts
      const { data: calendar, error: fetchError } = await supabase
        .from("calendars")
        .select("posts")
        .eq("id", calendarId)
        .single();

      if (fetchError) {
        results.push({
          calendarId,
          success: false,
          error: `Failed to fetch calendar: ${fetchError.message}`,
        });
        continue;
      }

      const posts = Array.isArray(calendar?.posts) ? calendar.posts : [];

      // Create scheduled_posts for each post
      const scheduledPosts: ScheduledPostData[] = posts.map((post: any, index: number) => {
        const baseDate = new Date(options.scheduledFor);
        // Space out posts by 1-2 hours
        const spacingMs = (1 + Math.random()) * 60 * 60 * 1000; // 1-2 hours
        const scheduledDate = new Date(baseDate.getTime() + index * spacingMs);

        return {
          calendar_id: calendarId,
          post_day: post.day || index + 1,
          scheduled_for: scheduledDate.toISOString(),
          status: "scheduled",
        };
      });

      // Insert scheduled posts
      const { error: insertError } = await supabase.from("scheduled_posts").insert(scheduledPosts);

      if (insertError) {
        results.push({
          calendarId,
          success: false,
          error: `Failed to schedule posts: ${insertError.message}`,
        });
        continue;
      }

      results.push({
        calendarId,
        success: true,
      });
    } catch (err) {
      results.push({
        calendarId,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}

// ============================================================================
// BULK DELETION
// ============================================================================

/**
 * Options for bulk delete operation.
 */
interface BulkDeleteOptions {
  /** Whether to also delete scheduled posts for these calendars */
  deleteScheduledPosts?: boolean;
}

/**
 * Bulk delete multiple calendars.
 * Also deletes associated scheduled_posts if option is set.
 *
 * @param calendarIds Array of calendar IDs to delete
 * @param options Deletion options
 * @returns Array of results for each calendar
 *
 * @example
 * ```typescript
 * const results = await bulkDeleteCalendars(['cal-1', 'cal-2'], {
 *   deleteScheduledPosts: true,
 * });
 *
 * console.log(`Deleted ${results.filter(r => r.success).length} calendars`);
 * ```
 */
export async function bulkDeleteCalendars(
  calendarIds: string[],
  options: BulkDeleteOptions = { deleteScheduledPosts: true }
): Promise<BulkOperationResult[]> {
  const results: BulkOperationResult[] = [];

  for (const calendarId of calendarIds) {
    try {
      // Delete scheduled posts first if option is set
      if (options.deleteScheduledPosts) {
        const { error: scheduledError } = await supabase
          .from("scheduled_posts")
          .delete()
          .eq("calendar_id", calendarId);

        if (scheduledError) {
          results.push({
            calendarId,
            success: false,
            error: `Failed to delete scheduled posts: ${scheduledError.message}`,
          });
          continue;
        }
      }

      // Delete the calendar itself
      const { error: deleteError } = await supabase.from("calendars").delete().eq("id", calendarId);

      if (deleteError) {
        results.push({
          calendarId,
          success: false,
          error: `Failed to delete calendar: ${deleteError.message}`,
        });
        continue;
      }

      results.push({
        calendarId,
        success: true,
      });
    } catch (err) {
      results.push({
        calendarId,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}

// ============================================================================
// BULK TWEAKS
// ============================================================================

/**
 * Tweak types that can be applied in bulk.
 */
export type BulkTweakType = "shorter" | "punchier" | "add-stat" | "remove-emoji" | "more-personal";

/**
 * Options for bulk tweak operation.
 */
interface BulkTweakOptions {
  /** Type of tweak to apply */
  tweak: BulkTweakType;
  /** Only apply to these post days (1-7). If omitted, applies to all */
  postDays?: number[];
  /** Which calendar IDs to apply tweaks to */
  calendarIds: string[];
}

/**
 * Result of applying tweaks to posts in bulk.
 */
export interface BulkTweakResult {
  calendarId: string;
  postDay: number;
  success: boolean;
  error?: string;
}

/**
 * Bulk apply tweaks to multiple posts.
 * Regenerates posts with the specified tweak applied.
 *
 * @param options Bulk tweak options
 * @returns Array of results for each post that was tweaked
 *
 * @example
 * ```typescript
 * const results = await bulkApplyTweaks({
 *   tweak: 'shorter',
 *   postDays: [1, 2, 3], // Only tweak Mon, Tue, Wed
 *   calendarIds: ['cal-1', 'cal-2'],
 * });
 *
 * const successful = results.filter(r => r.success).length;
 * console.log(`Tweaked ${successful}/${results.length} posts`);
 * ```
 */
export async function bulkApplyTweaks(options: BulkTweakOptions): Promise<BulkTweakResult[]> {
  const results: BulkTweakResult[] = [];

  for (const calendarId of options.calendarIds) {
    try {
      // Fetch the calendar
      const { data: calendar, error: fetchError } = await supabase
        .from("calendars")
        .select("*")
        .eq("id", calendarId)
        .single();

      if (fetchError) {
        // Add result for first post day to indicate failure
        results.push({
          calendarId,
          postDay: options.postDays?.[0] || 1,
          success: false,
          error: `Failed to fetch calendar: ${fetchError.message}`,
        });
        continue;
      }

      const posts = Array.isArray(calendar?.posts) ? calendar.posts : [];
      const daysToTweak = options.postDays || posts.map((p: any) => p.day || 1);

      // For each post day to tweak
      for (const postDay of daysToTweak) {
        const post = posts.find((p: any) => p.day === postDay);

        if (!post) {
          results.push({
            calendarId,
            postDay,
            success: false,
            error: `Post for day ${postDay} not found`,
          });
          continue;
        }

        try {
          // Call regenerate-post edge function with tweak
          const response = await fetch(
            "https://xxxxx.supabase.co/functions/v1/regenerate-post", // Replace with actual URL
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
              },
              body: JSON.stringify({
                ...calendar, // Include all form data
                post,
                siblings: posts.filter((p: any) => p.day !== postDay),
                tweak: options.tweak,
              }),
            }
          );

          if (!response.ok) {
            const error = await response.json();
            results.push({
              calendarId,
              postDay,
              success: false,
              error: error.error || `HTTP ${response.status}`,
            });
            continue;
          }

          const { post: tweakedPost } = await response.json();

          // Update the post in the calendar
          const updatedPosts = posts.map((p: any) => (p.day === postDay ? tweakedPost : p));

          const { error: updateError } = await supabase
            .from("calendars")
            .update({ posts: updatedPosts })
            .eq("id", calendarId);

          if (updateError) {
            results.push({
              calendarId,
              postDay,
              success: false,
              error: `Failed to save tweaked post: ${updateError.message}`,
            });
            continue;
          }

          results.push({
            calendarId,
            postDay,
            success: true,
          });
        } catch (err) {
          results.push({
            calendarId,
            postDay,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    } catch (err) {
      results.push({
        calendarId,
        postDay: options.postDays?.[0] || 1,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parse bulk operation results and return summary statistics.
 *
 * @param results Array of operation results
 * @returns Summary with counts and error details
 *
 * @example
 * ```typescript
 * const results = await bulkScheduleCalendars(ids, options);
 * const summary = summarizeBulkResults(results);
 * console.log(`Success: ${summary.successCount}/${summary.totalCount}`);
 * console.log(`Errors: ${summary.errors.join(', ')}`);
 * ```
 */
export function summarizeBulkResults(results: BulkOperationResult[]): {
  successCount: number;
  failureCount: number;
  totalCount: number;
  errors: string[];
} {
  const errors = results.filter((r) => !r.success).map((r) => r.error || "Unknown error");

  return {
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
    totalCount: results.length,
    errors,
  };
}
