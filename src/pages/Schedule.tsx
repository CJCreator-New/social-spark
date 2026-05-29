import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { createScopedLogger } from "@/lib/logger";
import { SkeletonList } from "@/components/SkeletonList";
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
import { useCancelScheduledPostMutation, useScheduleInfiniteQuery, useUpdateScheduledPostStatusMutation, useUpdateScheduledPostTimeMutation } from "@/hooks/useAppQueries";

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
  calendars: Map<string, CalendarMeta>;
  profileTz: string;
  nextCursor: ScheduleCursor;
}

const css = `
.sc-app { min-height:100vh; background:radial-gradient(circle at 18% 18%, rgba(216,255,121,0.08), transparent 24%), linear-gradient(180deg, #05060a 0%, #0a0d14 100%); color:#edeae3; font-family:'Sora',sans-serif; padding:52px 24px 100px; }
.sc-inner { max-width:880px; margin:0 auto; }
.sc-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:18px; gap:16px; flex-wrap:wrap; }
.sc-title { font-family:'Playfair Display',serif; font-size:32px; font-weight:400; margin:0; }
.sc-title em { font-style:italic; color:#c8f09a; }
.sc-back { font-size:12px; color:#7a7a8e; text-decoration:none; }
.sc-back:hover { color:#c8f09a; }
.sc-summary { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin:0 0 18px; }
.sc-summary-card { padding:14px 16px; border-radius:14px; background:#0d0f18; border:1px solid rgba(255,255,255,0.055); }
.sc-summary-label { font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; font-weight:500; }
.sc-summary-value { font-family:'Playfair Display',serif; font-size:24px; color:#edeae3; margin-top:4px; }
.sc-summary-sub { font-size:11px; color:#7a7a8e; margin-top:4px; line-height:1.4; }
.sc-empty { text-align:center; padding:60px 20px; color:#7a7a8e; font-size:14px; font-weight:300; border:1px dashed rgba(255,255,255,0.08); border-radius:16px; }
.sc-empty-illus { width:84px; height:84px; margin:0 auto 22px; border-radius:50%; background:radial-gradient(circle at 30% 30%, rgba(200,240,154,0.18), rgba(200,240,154,0.04) 65%, transparent 80%); border:1px solid rgba(200,240,154,0.18); display:flex; align-items:center; justify-content:center; font-size:34px; color:#c8f09a; }
.sc-empty-title { font-family:'Playfair Display',serif; font-size:22px; color:#edeae3; margin:0 0 8px; font-weight:400; }
.sc-empty-sub { font-size:13px; color:#7a7a8e; max-width:420px; margin:0 auto 22px; line-height:1.65; font-weight:300; }
.sc-empty-cta { display:inline-block; background:#c8f09a; color:#07080d; padding:11px 22px; border-radius:8px; font-size:13px; font-weight:500; text-decoration:none; font-family:'Sora',sans-serif; transition:transform .15s; }
.sc-empty-cta:hover { transform:translateY(-1px); }
.sc-toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:18px; padding:10px 14px; background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:12px; }
.sc-tool-label { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; font-weight:500; }
.sc-sel { background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:6px 10px; font-size:12px; color:#edeae3; font-family:'Sora',sans-serif; outline:none; cursor:pointer; }
.sc-sel:focus { border-color:rgba(200,240,154,0.4); }
.sc-csv-btn { margin-left:auto; background:rgba(200,240,154,.12); border:1px solid rgba(200,240,154,.32); color:#c8f09a; padding:7px 14px; border-radius:8px; font-size:12px; cursor:pointer; font-family:'Sora',sans-serif; font-weight:500; }
.sc-csv-btn:hover { background:rgba(200,240,154,.2); }
.sc-csv-btn:disabled { opacity:.5; cursor:not-allowed; }
.sc-group { margin-bottom:22px; }
.sc-group-h { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; font-weight:500; margin:0 0 10px; }
.sc-row { background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:12px; padding:14px 18px; display:flex; gap:14px; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; }
.sc-time { font-family:'Playfair Display',serif; font-size:18px; color:#c8f09a; min-width:88px; font-variant-numeric:tabular-nums; display:flex; flex-direction:column; gap:2px; }
.sc-time-tz { font-family:'Sora',sans-serif; font-size:9px; color:#5a5a72; letter-spacing:.06em; }
.sc-meta { flex:1; min-width:200px; }
.sc-meta-title { font-size:14px; color:#edeae3; margin:0 0 4px; }
.sc-meta-sub { font-size:11px; color:#7a7a8e; display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.sc-tag { display:inline-block; padding:2px 8px; border-radius:99px; background:rgba(200,240,154,0.1); color:#c8f09a; font-size:10px; letter-spacing:.04em; }
.sc-status { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:99px; font-size:10px; letter-spacing:.04em; border:1px solid; font-weight:500; }
.sc-status.drafted { color:#9a9aae; border-color:rgba(255,255,255,0.18); background:rgba(255,255,255,.02); }
.sc-status.approved { color:#9ab5f0; border-color:rgba(154,181,240,.32); background:rgba(154,181,240,.06); }
.sc-status.published { color:#c8f09a; border-color:rgba(200,240,154,.32); background:rgba(200,240,154,.06); }
.sc-status.failed { color:#f09a9a; border-color:rgba(240,154,154,.35); background:rgba(240,154,154,.08); }
.sc-act { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#7a7a8e; padding:6px 12px; border-radius:6px; font-size:11px; cursor:pointer; font-family:'Sora',sans-serif; transition:all .15s; }
.sc-act:hover { border-color:rgba(200,240,154,0.32); color:#c8f09a; }
.sc-act-p { background:rgba(200,240,154,.12); border-color:rgba(200,240,154,.32); color:#c8f09a; }
.sc-act-danger { color:#f09a9a; }
.sc-act-danger:hover { border-color:rgba(240,154,154,.35); color:#f09a9a; }
.sc-menu-trigger { width:34px; height:34px; padding:0; display:inline-flex; align-items:center; justify-content:center; }
.sc-menu-content { min-width:190px; background:#0d0f18; border:1px solid rgba(255,255,255,0.12); color:#edeae3; box-shadow:0 18px 44px rgba(0,0,0,.45); }
.sc-menu-item { display:flex; gap:9px; align-items:center; font-family:'Sora',sans-serif; font-size:12px; color:#edeae3; cursor:pointer; }
.sc-menu-item:focus { background:rgba(200,240,154,.12); color:#c8f09a; }
.sc-menu-item.danger { color:#f09a9a; }
.sc-menu-sep { background:rgba(255,255,255,0.08); }
.sc-edit { display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-top:8px; padding:8px; background:#07080d; border:1px solid rgba(255,255,255,0.08); border-radius:8px; width:100%; }
.sc-edit input { background:transparent; border:1px solid rgba(255,255,255,0.1); border-radius:5px; padding:5px 8px; font-size:12px; color:#edeae3; font-family:'Sora',sans-serif; outline:none; color-scheme:dark; }
.sc-edit input:focus { border-color:rgba(200,240,154,0.4); }
.sc-empty-line { font-size:11px; color:#5a5a72; padding:8px 0; }
`;

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
  const [calendars, setCalendars] = useState<Map<string, CalendarMeta>>(new Map());
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

  useEffect(() => {
    if (!scheduleData) return;
    const pages = scheduleData.pages;
    const firstPage = pages[0];
    setProfileTz(firstPage.profileTz);
    setViewTz(firstPage.profileTz);
    setRows(pages.flatMap(page => page.rows) as ScheduledRow[]);
    setCalendars(firstPage.calendars);
  }, [scheduleData]);

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
    const cal = calendars.get(row.calendar_id);
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
      const cal = calendars.get(r.calendar_id);
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
      <style>{css}</style>
      <WorkspacePage size="wide">
        <div className="sc-head">
          <h1 className="sc-title">My <em>schedule</em></h1>
          <div style={{ display: "flex", gap: 12 }}>
            <Link to="/my-calendars" className="sc-back">My calendars</Link>
            <Link to="/app" className="sc-back">← New calendar</Link>
          </div>
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
          <SkeletonList rows={5} />
        ) : rows.length === 0 ? (
          <div className="sc-empty">
            <div className="sc-empty-illus" aria-hidden="true">⌛</div>
            <div className="sc-empty-title">Nothing in the <em>queue</em> yet</div>
            <p className="sc-empty-sub">Open a calendar and click <strong style={{ color: "#c8f09a" }}>Schedule week</strong> to populate this view with draft and publish actions.</p>
            <Link to="/app" className="sc-empty-cta">Create a calendar</Link>
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
    const cal = calendars.get(row.calendar_id);
    const tz = viewTz;
    const isEditing = editId === row.id;
    return (
      <div key={row.id} className="sc-row">
        <div className="sc-time">
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
