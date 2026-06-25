// Helpers for per-day dates + .ics export.
import { zonedToUtcIso } from "./timezones";
import { suggestedTimeForDay } from "./postingTimes";

const DOW_TO_OFFSET: Record<string, number> = {
  Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
};

const DOW_LABEL: Record<string, string> = {
  Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
  Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

/** Parse a YYYY-MM-DD string into a Date in local time (no TZ surprises). */
export function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Format Date → YYYY-MM-DD in local time (for <input type="date" />). */
export function toDateInputValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Default week start = next Monday at local midnight. */
export function nextMonday(from = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const dow = d.getDay(); // Sun=0, Mon=1, ...
  const offset = (8 - (dow === 0 ? 7 : dow)) % 7 || 7;
  d.setDate(d.getDate() + offset);
  return d;
}

/** Given a week-start Monday and a post.dow ("Mon"/"Tue"/...), return that real Date. */
export function dateForDow(weekStart: Date, dow: string): Date {
  const offset = DOW_TO_OFFSET[dow] ?? 0;
  const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  d.setDate(d.getDate() + offset);
  return d;
}

/** Pretty short label e.g. "Mon · Apr 22". */
export function shortDateLabel(d: Date): string {
  const dow = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
  const mon = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
  return `${dow} · ${mon} ${d.getDate()}`;
}

export function fullDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

/** Parse "HH:MM" → { hours, minutes }. Defaults to 9:00. */
export function parseTime(t: string | null | undefined): { hours: number; minutes: number } {
  if (!t) return { hours: 9, minutes: 0 };
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return { hours: 9, minutes: 0 };
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return { hours: h, minutes: min };
}

/** Build a JS Date for a post slot (combining week start + dow + HH:MM). */
export function postDateTime(weekStart: Date, dow: string, time: string): Date {
  const base = dateForDow(weekStart, dow);
  const { hours, minutes } = parseTime(time);
  base.setHours(hours, minutes, 0, 0);
  return base;
}

// ─── ICS EXPORT ───────────────────────────────────────────────────────────────

export interface IcsPost {
  day: number;
  dow: string;
  topic: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
  platform?: string;
}

export type Post = IcsPost;

interface IcsOptions {
  calendarTitle: string;
  weekStart: Date;
  /** Per-post times keyed by post.day (1..7), e.g. {"1":"09:00"}. */
  postTimes: Record<string, string>;
  /** Default post duration in minutes. */
  durationMin?: number;
  /** Optional platform label for the event title prefix. */
  platform?: string;
  /** IANA timezone (e.g. "America/New_York"). When set, times are emitted as UTC instants. */
  timezone?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Format a Date as an ICS local time DTSTART/DTEND value (floating, no TZ). */
function toIcsLocal(d: Date): string {
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    "00"
  );
}

function toIcsUtcStamp(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Escape per RFC 5545 — newlines become \n, commas/semicolons/backslashes are escaped. */
function icsEscape(s: string): string {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** Fold long lines at 75 octets per RFC 5545. */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + 73);
    out.push((i === 0 ? "" : " ") + chunk);
    i += 73;
  }
  return out.join("\r\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function fileSlug(s: string) {
  return (s || "calendar").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "calendar";
}

export function downloadIcs(opts: IcsOptions, posts: IcsPost[]) {
  const { calendarTitle, weekStart, postTimes, durationMin = 30, platform, timezone } = opts;
  const stamp = toIcsUtcStamp(new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ContentForge//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calendarTitle)}`,
  ];

  const useTz = !!timezone;

  for (const p of posts) {
    const time = postTimes[String(p.day)] || suggestedTimeForDay(p.day, platform);
    const dayOffset = (p.day && typeof p.day === "number") ? p.day - 1 : 0;
    const localStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + dayOffset);
    const { hours, minutes } = parseTime(time);
    localStart.setHours(hours, minutes, 0, 0);

    let dtStart: string;
    let dtEnd: string;
    if (useTz && timezone) {
      const slotDate = toDateInputValue(localStart);
      const startUtc = new Date(zonedToUtcIso(slotDate, time, timezone));
      const endUtc = new Date(startUtc.getTime() + durationMin * 60 * 1000);
      dtStart = `DTSTART:${toIcsUtcStamp(startUtc)}`;
      dtEnd = `DTEND:${toIcsUtcStamp(endUtc)}`;
    } else {
      // Use floating time (no timezone) - will use importer's local time
      const end = new Date(localStart.getTime() + durationMin * 60 * 1000);
      dtStart = `DTSTART:${toIcsLocal(localStart)}`;
      dtEnd = `DTEND:${toIcsLocal(end)}`;
    }
    const uid = `cf-${fileSlug(calendarTitle)}-d${p.day}-${localStart.getTime()}@contentforge`;

    const summary = platform
      ? `[${platform}] Day ${p.day} — ${p.title || p.topic}`
      : `Day ${p.day} — ${p.title || p.topic}`;

    const descParts: string[] = [];
    if (p.hook) descParts.push(`HOOK\n${p.hook}`);
    if (p.body) descParts.push(`POST\n${p.body}`);
    if (p.cta) descParts.push(`CTA\n${p.cta}`);
    if (p.hashtags) descParts.push(`HASHTAGS\n${p.hashtags}`);
    const description = descParts.join("\n\n");

    lines.push(
      "BEGIN:VEVENT",
      foldLine(`UID:${uid}`),
      `DTSTAMP:${stamp}`,
      dtStart,
      dtEnd,
      foldLine(`SUMMARY:${icsEscape(summary)}`),
      foldLine(`DESCRIPTION:${icsEscape(description)}`),
      foldLine(`CATEGORIES:${icsEscape(p.topic || "")}`),
      "BEGIN:VALARM",
      "TRIGGER:-PT15M",
      "ACTION:DISPLAY",
      foldLine(`DESCRIPTION:${icsEscape(`Time to post: ${p.title || p.topic}`)}`),
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  const text = lines.join("\r\n") + "\r\n";
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  triggerDownload(blob, `${fileSlug(calendarTitle)}.ics`);
}

export { DOW_LABEL };
