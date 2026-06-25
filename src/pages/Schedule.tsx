import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { createScopedLogger } from "@/lib/logger";
import { ScheduleSkeleton } from "@/components/ScheduleSkeleton";
import { VirtualizedList } from "@/components/VirtualizedList";
import { WorkspacePage } from "@/components/layout/WorkspacePage";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarClock, CheckCircle2, Clipboard, ExternalLink, MoreHorizontal, RotateCcw, XCircle } from "lucide-react";
import { writeToClipboard, niceLabelFor } from "@/lib/platformCopy";
import { browserTimezone, fmtDateInTz, fmtTimeInTz, listTimezones, tzLabel, zonedToUtcIso } from "@/lib/timezones";
import { downloadScheduleCsv } from "@/lib/exportSchedule";
import { buildTrackingUrl } from "@/lib/utm";
import { useCancelScheduledPostMutation, useProfileQuery, useScheduleInfiniteQuery, useUpdateScheduledPostStatusMutation, useUpdateScheduledPostTimeMutation } from "@/hooks/useAppQueries";
import { resolveScheduleTimezone, saveScheduleTimezone } from "@/lib/schedulePreferences";
import "@/styles/pages.css";

type WorkflowStatus = "drafted" | "approved" | "published" | "failed";
type SortKey = "date-asc" | "date-desc" | "platform" | "status";
const PAGE_SIZE = 25;

type ScheduleCursor = { scheduled_at: string; id: string } | null;

interface ScheduledRow {
  id: string;
  calendar_id: string;
  post_day: number;
  platform: string | null;
  scheduled_at: string;
  status: string;
  workflow_status: WorkflowStatus;
  copy_text: string | null;
  post_snapshot: { title?: string; topic?: string; hashtags?: string } | null;
  published_at: string | null;
  failure_reason: string | null;
}

interface CalendarMeta {
  id: string;
  title: string;
  timezone: string | null;
  tracking_url: string | null;
}

interface SchedulePage {
  rows: ScheduledRow[];
  calendars: Record<string, CalendarMeta>;
  profileTz: string;
  nextCursor: ScheduleCursor;
}

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  drafted: "Drafted",
  approved: "Approved",
  published: "Published",
  failed: "Failed",
};

const STATUS_RANK: Record<WorkflowStatus, number> = {
  failed: 0, drafted: 1, approved: 2, published: 3,
};

export default function Schedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  const [calendars, setCalendars] = useState<Record<string, CalendarMeta>>({});
  const [profileTz, setProfileTz] = useState<string>("");
  const [viewTz, setViewTz] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("date-asc");
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [pendingCancel, setPendingCancel] = useState<ScheduledRow | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const tzList = listTimezones();
  const log = createScopedLogger('Schedule');
  const updateStatusMutation = useUpdateScheduledPostStatusMutation();
  const cancelScheduledPostMutation = useCancelScheduledPostMutation();
  const updateScheduledTimeMutation = useUpdateScheduledPostTimeMutation();

  const { data: scheduleData, isLoading: loading, error: scheduleError, fetchNextPage, hasNextPage, isFetchingNextPage } = useScheduleInfiniteQuery(user?.id, PAGE_SIZE);
  const { data: profileData } = useProfileQuery(user?.id);

  const mergedCalendars = useMemo(() => {
    if (!scheduleData) return {} as Record<string, CalendarMeta>;
    const merged: Record<string, CalendarMeta> = {};
    for (const page of scheduleData.pages) {
      for (const [id, meta] of Object.entries(page.calendars)) {
        if (!(id in merged)) merged[id] = meta;
      }
    }
    return merged;
  }, [scheduleData]);

  useEffect(() => {
    const tz = profileData?.default_timezone || "";
    setProfileTz(tz);
    setViewTz((current) => current || resolveScheduleTimezone(user?.id, tz, browserTimezone()));
  }, [profileData, user?.id]);

  useEffect(() => {
    if (!scheduleData) return;
    const pages = scheduleData.pages;
    setRows(pages.flatMap(page => page.rows) as ScheduledRow[]);
    setCalendars(mergedCalendars);
  }, [scheduleData, mergedCalendars]);

  useEffect(() => {
    saveScheduleTimezone(user?.id, viewTz);
  }, [user?.id, viewTz]);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void fetchNextPage();
      }
    }, { rootMargin: "400px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, rows.length]);

  useEffect(() => {
    if (scheduleError instanceof Error) toast.error(scheduleError.message);
  }, [scheduleError]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    if (sortBy === "date-asc") arr.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    else if (sortBy === "date-desc") arr.sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
    else if (sortBy === "platform") arr.sort((a, b) => (a.platform || "").localeCompare(b.platform || "") || a.scheduled_at.localeCompare(b.scheduled_at));
    else if (sortBy === "status") arr.sort((a, b) => STATUS_RANK[a.workflow_status] - STATUS_RANK[b.workflow_status] || a.scheduled_at.localeCompare(b.scheduled_at));
    return arr;
  }, [rows, sortBy]);

  // Group by date in viewTz (only for date-asc / date-desc).
  const grouped = useMemo(() => {
    if (sortBy !== "date-asc" && sortBy !== "date-desc") return null;
    const g = new Map<string, ScheduledRow[]>();
    for (const r of sorted) {
      const k = fmtDateInTz(r.scheduled_at, viewTz);
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(r);
    }
    return g;
  }, [sorted, sortBy, viewTz]);
  const summary = useMemo(() => ({
    total: rows.length,
    drafted: rows.filter((row) => row.workflow_status === "drafted").length,
    approved: rows.filter((row) => row.workflow_status === "approved").length,
    published: rows.filter((row) => row.workflow_status === "published").length,
  }), [rows]);

  async function setStatus(row: ScheduledRow, status: WorkflowStatus) {
    const log = createScopedLogger('Schedule-SetStatus');
    const patch: Record<string, unknown> = { workflow_status: status };
    if (status === "published") patch.published_at = new Date().toISOString();
    if (status !== "failed") patch.failure_reason = null;
    try {
      await updateStatusMutation.mutateAsync({ id: row.id, patch });
    } catch (error) {
      log.error(`Failed to set status`, error, { postId: row.id, newStatus: status });
      return toast.error(error instanceof Error ? error.message : "Failed to set status");
    }
    setRows(p => p.map(r => r.id === row.id ? { ...r, ...patch, workflow_status: status } as ScheduledRow : r));
    log.info(`Post status updated`, { postId: row.id, newStatus: status });
    toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
  }

  function requestCancelRow(row: ScheduledRow) {
    setPendingCancel(row);
  }

  async function confirmCancelRow(row: ScheduledRow) {
    const log = createScopedLogger('Schedule-Cancel');
    try {
      await cancelScheduledPostMutation.mutateAsync(row.id);
    } catch (error) {
      log.error(`Failed to cancel post`, error, { postId: row.id });
      return toast.error(error instanceof Error ? error.message : "Failed to cancel post");
    }
    setRows(p => p.filter(r => r.id !== row.id));
    setPendingCancel(null);
    log.info(`Post cancelled`, { postId: row.id });
    toast.success("Cancelled");
  }

  async function copyRow(row: ScheduledRow) {
    const text = row.copy_text || "";
    if (!text) return toast.error("No ready text — open the calendar to refresh.");
    const ok = await writeToClipboard(text);
    if (ok) toast.success(`Copied for ${niceLabelFor(row.platform)} ✓`);
    else toast.error("Could not copy");
  }

  function startEdit(row: ScheduledRow) {
    setEditId(row.id);
    setEditDate(fmtInTzDateInput(row.scheduled_at, viewTz));
    setEditTime(fmtInTzTimeInput(row.scheduled_at, viewTz));
  }

  async function saveEdit(row: ScheduledRow) {
    const log = createScopedLogger('Schedule-SaveEdit');
    if (!editDate || !editTime) return;
    const cal = calendars[row.calendar_id];
    const tz = cal?.timezone || profileTz || browserTimezone();
    const newIso = zonedToUtcIso(editDate, editTime, tz);
    try {
      await updateScheduledTimeMutation.mutateAsync({ id: row.id, scheduledAt: newIso });
    } catch (error) {
      log.error(`Failed to save edit`, error, { postId: row.id, newTime: newIso });
      return toast.error(error instanceof Error ? error.message : "Failed to save edit");
    }
    setRows(p => p.map(r => r.id === row.id ? { ...r, scheduled_at: newIso } : r));
    setEditId(null);
    log.info(`Post time updated`, { postId: row.id, newTime: newIso, timezone: tz });
    toast.success("Time updated");
  }

  function exportCsv() {
    const tz = viewTz;
    const enriched = sorted.map(r => {
      const cal = calendars[r.calendar_id];
      return {
        ...r,
        calendar_title: cal?.title || "",
        utm_link: buildTrackingUrl(cal?.tracking_url, r.platform, cal?.title),
      };
    });
    downloadScheduleCsv(enriched, tz, `schedule-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Exported ${enriched.length} rows ✓`);
  }

  return (
    <>
      <Helmet>
        <title>Publishing schedule queue — ContentForge</title>
        <meta name="description" content="Manage your publishing queue, review scheduled posts, edit posting times, select time zones, and export calendars." />
      </Helmet>
      <WorkspacePage size="wide">
        <div className="sc-head">
          <h1 className="sc-title">My <em>schedule</em></h1>
        </div>

        <div className="sc-summary" aria-label="Schedule summary">
          <div className="sc-summary-card">
            <div className="sc-summary-label">Scheduled</div>
            <div className="sc-summary-value">{summary.total}</div>
            <div className="sc-summary-sub">Rows currently in your queue.</div>
          </div>
          <div className="sc-summary-card">
            <div className="sc-summary-label">Drafted</div>
            <div className="sc-summary-value">{summary.drafted}</div>
            <div className="sc-summary-sub">Needs approval or a second look.</div>
          </div>
          <div className="sc-summary-card">
            <div className="sc-summary-label">Approved</div>
            <div className="sc-summary-value">{summary.approved}</div>
            <div className="sc-summary-sub">Ready to publish or reschedule.</div>
          </div>
          <div className="sc-summary-card">
            <div className="sc-summary-label">Published</div>
            <div className="sc-summary-value">{summary.published}</div>
            <div className="sc-summary-sub">Completed and archived in the schedule.</div>
          </div>
        </div>

        {!loading && rows.length > 0 && (
          <div className="sc-toolbar">
            <span className="sc-tool-label">Sort</span>
            <select className="sc-sel" aria-label="Sort schedule" value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)}>
              <option value="date-asc">Date · soonest first</option>
              <option value="date-desc">Date · latest first</option>
              <option value="platform">Platform</option>
              <option value="status">Status</option>
            </select>
            <span className="sc-tool-label" style={{ marginLeft: 8 }}>Timezone</span>
            <select className="sc-sel" aria-label="Schedule timezone" value={viewTz} onChange={e => setViewTz(e.target.value)} style={{ maxWidth: 240 }}>
              {tzList.map(tz => <option key={tz} value={tz}>{tzLabel(tz)}</option>)}
            </select>
            <button className="sc-csv-btn" onClick={exportCsv} disabled={sorted.length === 0}>↓ Export CSV</button>
          </div>
        )}

        {loading ? (
          <ScheduleSkeleton rows={5} />
        ) : rows.length === 0 ? (
          <div className="sc-empty">
            <div className="sc-empty-illus" aria-hidden="true">⌛</div>
            <div className="sc-empty-title">Nothing in the <em>queue</em> yet</div>
            <p className="sc-empty-sub">Open a calendar and click <strong style={{ color: "#c8f09a" }}>Schedule week</strong> to populate this view with draft and publish actions.</p>
            <Link to="/app" className="sc-empty-cta">Create a calendar</Link>
            <div style={{ marginTop: 12 }}>
              <Link to="/my-calendars" className="text-xs text-slate-500 hover:text-[#c8f09a] transition-colors underline">
                Or schedule an existing calendar →
              </Link>
            </div>
          </div>
        ) : grouped ? (
          [...grouped.entries()].map(([date, list]) => (
            <div key={date} className="sc-group">
              <h2 className="sc-group-h">{date}</h2>
              {list.map(row => renderRow(row))}
            </div>
          ))
        ) : (
          <div className="sc-group">
            <VirtualizedList
              items={sorted}
              renderItem={renderRow}
              height={600}
              estimatedItemHeight={100}
              ariaLabel="Scheduled posts list"
            />
          </div>
        )}

        {hasNextPage && (
          <div ref={loadMoreRef} style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
            <button className="sc-act" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? "Loading more…" : "Load more"}
            </button>
          </div>
        )}
      </WorkspacePage>
      {pendingCancel && (
        <ConfirmDialog
          title="Cancel this scheduled post?"
          message={`${pendingCancel.post_snapshot?.title || pendingCancel.post_snapshot?.topic || `Day ${pendingCancel.post_day}`} will be removed from the queue.`}
          onCancel={() => setPendingCancel(null)}
          onConfirm={async () => { setPendingCancel(null); await confirmCancelRow(pendingCancel); }}
        />
      )}
    </>
  );

  function renderRow(row: ScheduledRow) {
    const cal = calendars[row.calendar_id];
    const tz = viewTz;
    const isEditing = editId === row.id;
    return (
      <div key={row.id} className="sc-row">
        <div className="sc-time tabular-nums">
          <span>{fmtTimeInTz(row.scheduled_at, tz)}</span>
          {sortBy !== "date-asc" && sortBy !== "date-desc" && (
            <span className="sc-time-tz">{fmtDateInTz(row.scheduled_at, tz)}</span>
          )}
          <span className="sc-time-tz">{tz.split("/").pop()}</span>
        </div>
        <div className="sc-meta">
          <div className="sc-meta-title">{row.post_snapshot?.title || row.post_snapshot?.topic || `Day ${row.post_day}`}</div>
          <div className="sc-meta-sub">
            {row.platform && <span className="sc-tag">{row.platform}</span>}
            <span className={`sc-status ${row.workflow_status}`}>● {STATUS_LABEL[row.workflow_status]}</span>
            <span>Day {row.post_day}</span>
            {cal && <span>· {cal.title}</span>}
            {row.workflow_status === "failed" && row.failure_reason && (
              <span style={{ color: "#f09a9a" }}>· {row.failure_reason}</span>
            )}
          </div>
          {isEditing && (
            <div className="sc-edit">
              <span style={{ fontSize: 10, color: "#7a7a8e", letterSpacing: ".1em", textTransform: "uppercase" }}>Reschedule</span>
              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
              <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} />
              <button className="sc-act sc-act-p" onClick={() => saveEdit(row)}>Save</button>
              <button className="sc-act" onClick={() => setEditId(null)}>Cancel</button>
              <span style={{ fontSize: 10, color: "#5a5a72", marginLeft: 4 }}>
                in {(cal?.timezone || profileTz || browserTimezone())}
              </span>
            </div>
          )}
        </div>
        {row.workflow_status === "drafted" && (
          <button className="sc-act" onClick={() => void setStatus(row, "approved")}>
            Approve
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="sc-act sc-menu-trigger" aria-label={`Actions for day ${row.post_day}`}>
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="sc-menu-content">
            <DropdownMenuItem className="sc-menu-item" onSelect={() => void copyRow(row)}>
              <Clipboard size={14} aria-hidden="true" /> Copy post text
            </DropdownMenuItem>
            {!isEditing && (
              <DropdownMenuItem className="sc-menu-item" onSelect={() => startEdit(row)}>
                <CalendarClock size={14} aria-hidden="true" /> Reschedule
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="sc-menu-sep" />
            {row.workflow_status === "drafted" && (
              <DropdownMenuItem className="sc-menu-item" onSelect={() => void setStatus(row, "approved")}>
                <CheckCircle2 size={14} aria-hidden="true" /> Approve
              </DropdownMenuItem>
            )}
            {row.workflow_status === "approved" && (
              <DropdownMenuItem className="sc-menu-item" onSelect={() => void setStatus(row, "published")}>
                <CheckCircle2 size={14} aria-hidden="true" /> Mark published
              </DropdownMenuItem>
            )}
            {row.workflow_status === "published" && (
              <DropdownMenuItem className="sc-menu-item" onSelect={() => void setStatus(row, "approved")}>
                <RotateCcw size={14} aria-hidden="true" /> Re-open
              </DropdownMenuItem>
            )}
            {row.workflow_status !== "failed" && row.workflow_status !== "published" && (
              <DropdownMenuItem className="sc-menu-item danger" onSelect={() => void setStatus(row, "failed")}>
                <XCircle size={14} aria-hidden="true" /> Mark failed
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="sc-menu-sep" />
            <DropdownMenuItem className="sc-menu-item" onSelect={() => navigate(`/calendar/${row.calendar_id}`)}>
              <ExternalLink size={14} aria-hidden="true" /> Open calendar
            </DropdownMenuItem>
            <DropdownMenuItem className="sc-menu-item danger" onSelect={() => requestCancelRow(row)}>
              <XCircle size={14} aria-hidden="true" /> Cancel scheduled post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
}

// Helpers (kept inside file to avoid extra exports).
function fmtInTzDateInput(iso: string, tz: string): string {
  try {
    const dtf = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    return dtf.format(new Date(iso));
  } catch { return new Date(iso).toISOString().slice(0, 10); }
}
function fmtInTzTimeInput(iso: string, tz: string): string {
  try {
    const dtf = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
    return dtf.format(new Date(iso));
  } catch { return "08:00"; }
}
