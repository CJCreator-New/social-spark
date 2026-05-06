// Timezone helpers — IANA names + safe converters that don't depend on browser locale.
// Uses Intl API for robust cross-browser DST and offset handling.

/**
 * Fallback list of common timezones if Intl.supportedValuesOf is unavailable.
 * Covers major business regions and timezones commonly used for scheduling.
 */
const COMMON_TZ_FALLBACK = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Toronto",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Athens",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Perth",
  "Australia/Sydney",
  "Pacific/Auckland",
];

/**
 * Get list of supported timezones.
 * Tries Intl.supportedValuesOf first (modern browsers), falls back to curated list.
 * @returns Array of IANA timezone identifiers
 */
export function listTimezones(): string[] {
  // @ts-expect-error supportedValuesOf is widely supported now (ES2023)
  const native = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") as string[] : null;
  return native && native.length ? native : COMMON_TZ_FALLBACK;
}

/**
 * Get the browser's current timezone (user's system setting).
 * Safe fallback to UTC if detection fails.
 * @returns IANA timezone identifier (e.g., "America/New_York")
 */
export function browserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Get UTC offset string for a timezone at a given instant.
 * Automatically accounts for DST at that time.
 * @param tz IANA timezone identifier
 * @param at Date/time to check offset (defaults to now)
 * @returns Offset string like "+05:30", "-04:00", or "+00:00" if unable to parse
 */
export function tzOffsetString(tz: string, at: Date = new Date()): string {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    });
    const parts = dtf.formatToParts(at);
    const tzn = parts.find(p => p.type === "timeZoneName")?.value || "";

    // Parse "GMT+05:30" or "GMT-04:00" or similar
    const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(tzn);
    if (!m) {
      return "+00:00"; // Fallback if offset can't be parsed
    }

    const h = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    const sign = h < 0 ? "-" : "+";
    return `${sign}${String(Math.abs(h)).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  } catch {
    return "+00:00";
  }
}

/**
 * Check if a timezone identifier is valid.
 * @param tz Timezone to validate
 * @returns true if tz is in the supported timezones list
 */
export function isValidTimezone(tz: string): boolean {
  return listTimezones().includes(tz);
}

/**
 * Build a UTC ISO timestamp from a wall-clock date/time in a target timezone.
 * Handles DST by using a trial-and-error refinement with Intl offset detection.
 * 
 * Use this when a user picks a date/time in their local TZ and you need UTC for storage.
 * 
 * @param dateStr ISO date string (YYYY-MM-DD)
 * @param time Wall-clock time (HH:MM or HH:MM:SS)
 * @param tz IANA timezone identifier
 * @returns ISO 8601 UTC timestamp string
 * 
 * @example
 * // User in NY picks 9:00 AM on Jan 15, 2025
 * zonedToUtcIso("2025-01-15", "09:00", "America/New_York")
 * // Returns "2025-01-15T14:00:00.000Z" (UTC, accounting for EST = UTC-5)
 */
export function zonedToUtcIso(dateStr: string, time: string, tz: string): string {
  // Parse date components
  const parts = (dateStr || "").split("-");
  const yyyy = parseInt(parts[0], 10) || new Date().getUTCFullYear();
  const mo = parseInt(parts[1], 10) || 1;
  const dd = parseInt(parts[2], 10) || 1;

  // Validate and parse time components
  const timeParts = (time || "09:00").split(":");
  const hh = parseInt(timeParts[0], 10) || 0;
  const mm = parseInt(timeParts[1], 10) || 0;
  const ss = parseInt(timeParts[2], 10) || 0;

  // Create trial UTC instant (assuming offset is 0, then refine)
  const trial = Date.UTC(yyyy, mo - 1, dd, hh, mm, ss);

  // Get the actual offset at this wall time in the target tz
  const offsetStr = tzOffsetString(tz, new Date(trial));
  const sign = offsetStr.startsWith("-") ? -1 : 1;
  const [oh, om] = offsetStr.slice(1).split(":").map(n => parseInt(n, 10));
  const offsetMin = sign * ((oh || 0) * 60 + (om || 0));

  // Wall time in tz = UTC time + offset, so UTC = wall - offset
  const utcMs = trial - offsetMin * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/**
 * Format a UTC ISO timestamp as local date/time in a target timezone.
 * @param iso ISO 8601 UTC timestamp
 * @param tz IANA timezone identifier
 * @param opts Intl.DateTimeFormatOptions (e.g., { weekday: "long", month: "short" })
 * @returns Formatted string in the target timezone
 */
export function fmtInTz(iso: string, tz: string, opts?: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      ...(opts || {}),
    }).format(new Date(iso));
  } catch {
    // Fallback to browser locale if Intl fails
    return new Date(iso).toLocaleString();
  }
}

/**
 * Format a UTC timestamp as a readable date in a target timezone.
 * @param iso ISO 8601 UTC timestamp
 * @param tz IANA timezone identifier
 * @returns Formatted date string (e.g., "Wednesday, Jan 15")
 */
export function fmtDateInTz(iso: string, tz: string): string {
  return fmtInTz(iso, tz, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a UTC timestamp as a time in a target timezone.
 * @param iso ISO 8601 UTC timestamp
 * @param tz IANA timezone identifier
 * @returns Formatted time string (e.g., "09:30 AM")
 */
export function fmtTimeInTz(iso: string, tz: string): string {
  return fmtInTz(iso, tz, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Get a human-readable label for a timezone with its current UTC offset.
 * @param tz IANA timezone identifier
 * @returns Label like "America/New_York (UTC-04:00)"
 */
export function tzLabel(tz: string): string {
  const offset = tzOffsetString(tz);
  return `${tz} (UTC${offset})`;
}
