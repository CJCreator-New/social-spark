// Pure helpers for pushing posts to an external scheduler (Buffer / Hootsuite).

/** Offset in minutes (local minus UTC) of an IANA zone at a given instant. */
function offsetMinutesAt(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

function formatOffset(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "+";
  const abs = Math.abs(totalMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${sign}${hh}:${mm}`;
}

/**
 * Build an ISO 8601 string with the correct offset for a wall-clock time in an
 * IANA time zone, e.g. ("2026-11-23", "09:00", "Asia/Kolkata") ->
 * "2026-11-23T09:00:00+05:30". Throws on malformed input or an unknown zone.
 */
export function buildScheduledAt(dayDate: string, time: string, timeZone: string): string {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayDate);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!d || !t) throw new Error("Invalid date or time.");
  const [y, mo, da] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [h, mi] = [Number(t[1]), Number(t[2])];
  if (h > 23 || mi > 59) throw new Error("Invalid time.");

  const wallAsUtc = Date.UTC(y, mo - 1, da, h, mi, 0);
  // Two passes so wall times near a daylight-saving change resolve correctly.
  const first = offsetMinutesAt(timeZone, new Date(wallAsUtc));
  const second = offsetMinutesAt(timeZone, new Date(wallAsUtc - first * 60000));

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d[1]}-${d[2]}-${d[3]}T${pad(h)}:${pad(mi)}:00${formatOffset(second)}`;
}

export interface SchedulerPushResponse {
  attempted?: number;
  succeeded?: number;
  failed?: number;
  errors?: Array<{ index: number; message: string }>;
}

/** Summarise the push-to-scheduler response from its real per-post counts. */
export function countSchedulerResults(
  results: SchedulerPushResponse | null | undefined,
  providerLabel = "the scheduler"
): { succeeded: number; failed: number; message: string } {
  const succeeded = Math.max(0, Number(results?.succeeded) || 0);
  const failed =
    results?.failed != null
      ? Math.max(0, Number(results.failed) || 0)
      : (results?.errors?.length ?? 0);
  const total = succeeded + failed;
  const message =
    failed === 0
      ? `${succeeded}/${total} posts pushed to ${providerLabel}`
      : `${succeeded}/${total} posts pushed to ${providerLabel}, ${failed} failed`;
  return { succeeded, failed, message };
}
