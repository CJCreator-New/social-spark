import { sendEvent } from "@/lib/telemetry";
import { isEnabled } from "@/lib/featureFlags";

/**
 * Closed set of product-funnel events. Payloads are restricted to numbers,
 * booleans and short enum-like strings on a fixed per-event allow-list, so no
 * post content, user text, emails, names or keys can ever be sent.
 */
export type AnalyticsEventName =
  | "wizard_started"
  | "calendar_generated"
  | "schedule_clicked"
  | "post_scheduled"
  | "upgrade_viewed"
  | "checkout_started"
  | "checkout_completed"
  | "nps_shown"
  | "nps_submitted";

export type AnalyticsPropValue = number | boolean | string;
export type AnalyticsProps = Record<string, AnalyticsPropValue | undefined>;

export const MAX_STRING_PROP_LENGTH = 40;

export const EVENT_PROP_ALLOW_LIST: Record<AnalyticsEventName, readonly string[]> = {
  wizard_started: ["surface"],
  calendar_generated: ["platform", "platform_count", "post_count", "duration_ms", "mode"],
  schedule_clicked: ["surface", "platform", "post_count"],
  post_scheduled: ["surface", "platform", "post_count", "ms_since_generated"],
  upgrade_viewed: ["surface", "tier", "required_tier"],
  checkout_started: ["plan", "tier"],
  checkout_completed: ["plan", "tier"],
  nps_shown: [],
  nps_submitted: ["score"],
};

/** Drops any key not on the event's allow-list and any string over 40 chars. */
export function sanitizeEventProps(
  name: AnalyticsEventName,
  props: AnalyticsProps | undefined
): Record<string, AnalyticsPropValue> {
  const out: Record<string, AnalyticsPropValue> = {};
  const allowed = EVENT_PROP_ALLOW_LIST[name];
  if (!allowed || !props) return out;
  for (const key of allowed) {
    const value = props[key];
    if (typeof value === "number") {
      if (Number.isFinite(value)) out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    } else if (typeof value === "string") {
      if (value.length <= MAX_STRING_PROP_LENGTH) out[key] = value;
    }
  }
  return out;
}

/** Fire-and-forget. Never throws; respects the enable_telemetry flag. */
export function trackAnalyticsEvent(name: AnalyticsEventName, props?: AnalyticsProps): void {
  try {
    if (!isEnabled("enable_telemetry")) return;
    const result = sendEvent(name, sanitizeEventProps(name, props)) as unknown;
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      (result as Promise<unknown>).catch(() => {});
    }
  } catch {
    // Telemetry must never break the product.
  }
}

const GENERATED_AT_KEY = "ss:analytics:calendar_generated_at:v1";

/** Remember when the last calendar was generated, for time-to-schedule. */
export function markCalendarGenerated(): void {
  try {
    window.sessionStorage.setItem(GENERATED_AT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Milliseconds since the last generated calendar this session, if known. */
export function msSinceCalendarGenerated(): number | undefined {
  try {
    const raw = window.sessionStorage.getItem(GENERATED_AT_KEY);
    const t = raw ? Number(raw) : NaN;
    return Number.isFinite(t) ? Math.max(0, Date.now() - t) : undefined;
  } catch {
    return undefined;
  }
}
