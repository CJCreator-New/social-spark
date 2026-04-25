// CSV export for scheduled posts.
import { fmtDateInTz, fmtTimeInTz } from "./timezones";

export interface ScheduledRowLike {
  scheduled_at: string;
  platform: string | null;
  copy_text: string | null;
  workflow_status?: string | null;
  post_snapshot?: { title?: string; topic?: string; hashtags?: string } | null;
  utm_link?: string;
  calendar_title?: string;
}

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s === "") return "";
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: ScheduledRowLike[], tz: string): string {
  const header = [
    "Date", "Time", "Timezone", "Platform", "Status", "Calendar", "Title", "Caption", "Hashtags", "UTM link",
  ];
  const lines: string[] = [header.join(",")];
  for (const r of rows) {
    const date = fmtDateInTz(r.scheduled_at, tz);
    const time = fmtTimeInTz(r.scheduled_at, tz);
    const title = r.post_snapshot?.title || r.post_snapshot?.topic || "";
    const tags = r.post_snapshot?.hashtags || "";
    lines.push([
      csvEscape(date),
      csvEscape(time),
      csvEscape(tz),
      csvEscape(r.platform || ""),
      csvEscape(r.workflow_status || ""),
      csvEscape(r.calendar_title || ""),
      csvEscape(title),
      csvEscape(r.copy_text || ""),
      csvEscape(tags),
      csvEscape(r.utm_link || ""),
    ].join(","));
  }
  return lines.join("\r\n");
}

export function downloadScheduleCsv(rows: ScheduledRowLike[], tz: string, filename = "schedule.csv") {
  const csv = rowsToCsv(rows, tz);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
