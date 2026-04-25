// Timezone helpers — IANA names + safe converters that don't depend on browser locale.

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

export function listTimezones(): string[] {
  // @ts-expect-error supportedValuesOf is widely supported now
  const native = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") as string[] : null;
  return native && native.length ? native : COMMON_TZ_FALLBACK;
}

export function browserTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
}

/** Returns "+HH:MM" / "-HH:MM" offset of a given IANA tz at a given instant. */
export function tzOffsetString(tz: string, at: Date = new Date()): string {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
    const parts = dtf.formatToParts(at);
    const tzn = parts.find(p => p.type === "timeZoneName")?.value || "";
    const m = /GMT([+-]\d{1,2})(?::(\d{2}))?/.exec(tzn);
    if (!m) return "+00:00";
    const h = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    const sign = h < 0 ? "-" : "+";
    return `${sign}${String(Math.abs(h)).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  } catch { return "+00:00"; }
}

/** Build a UTC ISO Date for a wall-clock date (YYYY-MM-DD) + time (HH:MM) interpreted in `tz`. */
export function zonedToUtcIso(dateStr: string, time: string, tz: string): string {
  const [yyyy, mo, dd] = dateStr.split("-").map(n => parseInt(n, 10));
  const [hh, mm] = (time || "09:00").split(":").map(n => parseInt(n, 10));
  // Trial UTC instant assuming offset is X — refine using actual tz offset at that wall time.
  const trial = Date.UTC(yyyy, (mo || 1) - 1, dd || 1, hh || 0, mm || 0, 0);
  // Determine offset at the trial instant (in that tz).
  const off = tzOffsetString(tz, new Date(trial));
  const sign = off.startsWith("-") ? -1 : 1;
  const [oh, om] = off.slice(1).split(":").map(n => parseInt(n, 10));
  const offsetMin = sign * (oh * 60 + om);
  // The wall time in `tz` corresponds to UTC = wall - offset.
  const utcMs = trial - offsetMin * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/** Format an ISO/UTC timestamp in a target tz (date/time strings). */
export function fmtInTz(iso: string, tz: string, opts?: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: tz, ...(opts || {}) }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export function fmtDateInTz(iso: string, tz: string): string {
  return fmtInTz(iso, tz, { weekday: "long", month: "short", day: "numeric" });
}

export function fmtTimeInTz(iso: string, tz: string): string {
  return fmtInTz(iso, tz, { hour: "2-digit", minute: "2-digit" });
}

/** Short tz label e.g. "America/New_York (UTC-04:00)". */
export function tzLabel(tz: string): string {
  return `${tz} (UTC${tzOffsetString(tz)})`;
}
