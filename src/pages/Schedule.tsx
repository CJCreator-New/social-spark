import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { writeToClipboard, niceLabelFor } from "@/lib/platformCopy";

interface ScheduledRow {
  id: string;
  calendar_id: string;
  post_day: number;
  platform: string | null;
  scheduled_at: string;
  status: string;
  copy_text: string | null;
  post_snapshot: { title?: string; topic?: string } | null;
}

const css = `
.sc-app { min-height:100vh; background:#07080d; color:#edeae3; font-family:'Sora',sans-serif; padding:52px 24px 100px; }
.sc-inner { max-width:760px; margin:0 auto; }
.sc-head { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; gap:16px; flex-wrap:wrap; }
.sc-title { font-family:'Playfair Display',serif; font-size:32px; font-weight:400; margin:0; }
.sc-title em { font-style:italic; color:#c8f09a; }
.sc-back { font-size:12px; color:#7a7a8e; text-decoration:none; }
.sc-back:hover { color:#c8f09a; }
.sc-empty { text-align:center; padding:60px 20px; color:#7a7a8e; font-size:14px; font-weight:300; border:1px dashed rgba(255,255,255,0.08); border-radius:16px; }
.sc-group { margin-bottom:22px; }
.sc-group-h { font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; font-weight:500; margin:0 0 10px; }
.sc-row { background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:12px; padding:16px 18px; display:flex; gap:14px; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; }
.sc-time { font-family:'Playfair Display',serif; font-size:18px; color:#c8f09a; min-width:88px; font-variant-numeric:tabular-nums; }
.sc-meta { flex:1; min-width:200px; }
.sc-meta-title { font-size:14px; color:#edeae3; margin:0 0 4px; }
.sc-meta-sub { font-size:11px; color:#7a7a8e; }
.sc-tag { display:inline-block; padding:2px 8px; border-radius:99px; background:rgba(200,240,154,0.1); color:#c8f09a; font-size:10px; margin-right:6px; letter-spacing:.04em; }
.sc-act { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#7a7a8e; padding:6px 12px; border-radius:6px; font-size:11px; cursor:pointer; font-family:'Sora',sans-serif; transition:all .15s; }
.sc-act:hover { border-color:rgba(200,240,154,0.32); color:#c8f09a; }
.sc-act-p { background:rgba(200,240,154,.12); border-color:rgba(200,240,154,.32); color:#c8f09a; }
`;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default function Schedule() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ScheduledRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("scheduled_posts")
      .select("id, calendar_id, post_day, platform, scheduled_at, status, copy_text, post_snapshot")
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setRows((data as ScheduledRow[]) || []);
        setLoading(false);
      });
  }, [user]);

  async function cancel(row: ScheduledRow) {
    const { error } = await supabase.from("scheduled_posts").update({ status: "cancelled" }).eq("id", row.id);
    if (error) return toast.error(error.message);
    setRows(p => p.filter(r => r.id !== row.id));
    toast.success("Cancelled");
  }

  async function copy(row: ScheduledRow) {
    const text = row.copy_text || "";
    if (!text) return toast.error("No ready text — open the calendar to refresh.");
    const ok = await writeToClipboard(text);
    if (ok) toast.success(`Copied for ${niceLabelFor(row.platform)} ✓`);
    else toast.error("Could not copy");
  }

  // Group by date
  const groups = new Map<string, ScheduledRow[]>();
  for (const r of rows) {
    const key = fmtDate(r.scheduled_at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  return (
    <>
      <style>{css}</style>
      <div className="sc-app">
        <div className="sc-inner">
          <div className="sc-head">
            <h1 className="sc-title">My <em>schedule</em></h1>
            <div style={{ display: "flex", gap: 12 }}>
              <Link to="/my-calendars" className="sc-back">My calendars</Link>
              <Link to="/" className="sc-back">← New calendar</Link>
            </div>
          </div>

          {loading ? (
            <div className="sc-empty">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="sc-empty">
              No scheduled posts yet. Open a calendar and click <strong style={{ color: "#c8f09a" }}>Schedule week</strong>.
            </div>
          ) : (
            [...groups.entries()].map(([date, list]) => (
              <div key={date} className="sc-group">
                <h2 className="sc-group-h">{date}</h2>
                {list.map(row => (
                  <div key={row.id} className="sc-row">
                    <div className="sc-time">{fmtTime(row.scheduled_at)}</div>
                    <div className="sc-meta">
                      <div className="sc-meta-title">{row.post_snapshot?.title || row.post_snapshot?.topic || `Day ${row.post_day}`}</div>
                      <div className="sc-meta-sub">
                        {row.platform && <span className="sc-tag">{row.platform}</span>}
                        Day {row.post_day}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="sc-act sc-act-p" onClick={() => copy(row)}>Copy ready text</button>
                      <button className="sc-act" onClick={() => navigate(`/calendar/${row.calendar_id}`)}>Open calendar</button>
                      <button className="sc-act" onClick={() => cancel(row)}>Cancel</button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
