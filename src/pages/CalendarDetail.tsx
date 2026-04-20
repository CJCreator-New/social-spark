import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadMd, downloadPdf } from "@/lib/exportCalendar";
import {
  downloadIcs,
  parseLocalDate,
  nextMonday,
  toDateInputValue,
  dateForDow,
  shortDateLabel,
} from "@/lib/calendarSchedule";

interface Post {
  day: number; dow: string; topic: string; format: string;
  title: string; hook: string; body: string; cta: string; hashtags: string; rationale: string;
}

interface FormPayload {
  industry?: string;
  platform?: string;
  coreIdea?: string;
  audiences?: string[];
  voice?: string;
  style?: string;
  goals?: string[];
  format?: string;
  cta?: string;
  length?: string;
  structure?: string;
  extra?: string;
  weekStart?: string;
}

type TweakKind = "shorter" | "punchier" | "add-stat" | "remove-emoji" | "more-personal";

const css = `
.cd-app { min-height:100vh; background:#07080d; color:#edeae3; font-family:'Sora',sans-serif; padding:40px 24px 100px; }
.cd-inner { max-width:760px; margin:0 auto; }
.cd-back { font-size:12px; color:#7a7a8e; text-decoration:none; }
.cd-back:hover { color:#c8f09a; }
.cd-title { font-family:'Playfair Display',serif; font-size:28px; font-weight:400; margin:14px 0 6px; }
.cd-meta { font-size:12px; color:#7a7a8e; margin-bottom:24px; }
.cd-strip { display:grid; grid-template-columns:repeat(7,1fr); gap:5px; margin-bottom:18px; }
.cd-tab { padding:10px 4px; border-radius:8px; border:1px solid rgba(255,255,255,0.055); text-align:center; cursor:pointer; background:#0d0f18; font-family:'Sora',sans-serif; color:inherit; width:100%; transition:border-color .15s; }
.cd-tab:hover { border-color:rgba(255,255,255,0.12); }
.cd-tab.on { background:rgba(200,240,154,0.12); border-color:rgba(200,240,154,0.32); }
.cd-tab:focus-visible { outline:2px solid rgba(200,240,154,0.7); outline-offset:2px; }
.cd-tab-dow { font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:#6a6a82; }
.cd-tab.on .cd-tab-dow { color:rgba(200,240,154,0.55); }
.cd-tab-n { font-family:'Playfair Display',serif; font-size:17px; color:#7a7a8e; margin-top:2px; }
.cd-tab.on .cd-tab-n { color:#c8f09a; }
.cd-export-row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:18px; justify-content:flex-end; }
.cd-export-btn { padding:7px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#9a9aae; font-size:12px; cursor:pointer; font-family:'Sora',sans-serif; transition:all .15s; }
.cd-export-btn:hover { border-color:rgba(200,240,154,0.32); color:#c8f09a; }
.cd-export-btn:focus-visible { outline:2px solid rgba(200,240,154,0.7); outline-offset:2px; }
.cd-card { background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:16px; padding:26px; }
.cd-ptitle { font-family:'Playfair Display',serif; font-size:21px; font-weight:400; line-height:1.35; margin-bottom:18px; }
.cd-blabel { font-size:9px; letter-spacing:.15em; text-transform:uppercase; color:#3a3a50; margin:16px 0 7px; font-weight:500; display:flex; justify-content:space-between; align-items:center; }
.cd-blabel-count { color:#7a7a8e; font-weight:400; letter-spacing:.06em; text-transform:none; font-size:10px; }
.cd-hook { border-left:2px solid rgba(200,240,154,0.28); padding:10px 15px; background:rgba(200,240,154,0.025); border-radius:0 6px 6px 0; font-family:'Playfair Display',serif; font-size:14px; font-style:italic; color:#7a7a8e; line-height:1.65; white-space:pre-line; }
.cd-body { font-size:13px; color:#686880; line-height:1.85; white-space:pre-line; font-weight:300; }
.cd-cta { background:rgba(200,240,154,0.06); border:1px solid rgba(200,240,154,0.1); border-radius:8px; padding:13px 15px; font-size:13px; color:rgba(200,240,154,0.75); line-height:1.6; font-weight:300; }
.cd-tags { font-size:12px; color:rgba(200,240,154,0.38); line-height:2; font-weight:300; }
.cd-actions { display:flex; gap:8px; margin-top:22px; padding-top:18px; border-top:1px solid rgba(255,255,255,0.05); flex-wrap:wrap; }
.cd-btn { padding:9px 16px; border-radius:8px; font-size:12px; font-weight:500; cursor:pointer; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#edeae3; font-family:'Sora',sans-serif; }
.cd-btn:hover { border-color:rgba(200,240,154,0.32); }
.cd-btn-p { background:#c8f09a; color:#07080d; border-color:#c8f09a; }
.cd-btn-p:disabled { opacity:.5; cursor:not-allowed; }
.cd-btn:disabled { opacity:.5; cursor:not-allowed; }
.cd-edit-input { width:100%; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:11px 13px; font-size:14px; color:#edeae3; font-family:'Playfair Display',serif; outline:none; box-sizing:border-box; margin-bottom:10px; }
.cd-edit-input:focus { border-color:rgba(200,240,154,0.28); }
.cd-edit-area { width:100%; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:11px 13px; font-size:13px; color:#edeae3; font-family:'Sora',sans-serif; font-weight:300; outline:none; box-sizing:border-box; resize:vertical; line-height:1.65; }
.cd-edit-area:focus { border-color:rgba(200,240,154,0.28); }
`;

function wordCount(s: string): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export default function CalendarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState("");
  const [meta, setMeta] = useState("");
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Post | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [formPayload, setFormPayload] = useState<FormPayload>({});
  const [platform, setPlatform] = useState<string>("");
  const [industryLabel, setIndustryLabel] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    supabase.from("saved_calendars").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error || !data) { toast.error("Calendar not found"); navigate("/my-calendars"); return; }
      setPosts((data.posts as unknown as Post[]) || []);
      setTitle(data.title);
      setPlatform(data.platform || "");
      setIndustryLabel(data.industry_label || "");
      setFormPayload((data.form_payload as unknown as FormPayload) || {});
      setMeta(`${data.industry_label || ""} · ${data.platform || ""} · ${new Date(data.created_at).toLocaleDateString()}`);
      setLoading(false);
    });
  }, [id, navigate]);

  function startEdit() {
    setDraft({ ...posts[active] });
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  async function saveEdit() {
    if (!draft || !id) return;
    setSaving(true);
    const updated = posts.map((p, i) => i === active ? draft : p);
    const { error } = await supabase.from("saved_calendars")
      .update({ posts: updated as unknown as never })
      .eq("id", id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setPosts(updated);
    setEditing(false);
    setDraft(null);
    toast.success("Post updated");
  }

  async function regenerateDay() {
    if (!id || regenerating || editing) return;
    const target = posts[active];
    if (!target) return;
    setRegenerating(true);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/regenerate-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${session?.access_token || SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          industry: formPayload.industry || "",
          industryLabel,
          platform: platform || formPayload.platform || "LinkedIn",
          coreIdea: formPayload.coreIdea || title,
          audiences: formPayload.audiences || [],
          voice: formPayload.voice || "",
          style: formPayload.style || "",
          goals: formPayload.goals || [],
          format: formPayload.format || "Balanced mix",
          cta: formPayload.cta || "Share & repost bait",
          length: formPayload.length || "medium",
          structure: formPayload.structure || "mixed",
          extra: formPayload.extra || "",
          post: target,
          siblings: posts,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error || !data?.post) {
        toast.error(data?.error || `Regenerate failed (${res.status}).`);
        return;
      }
      const updated = posts.map((p, i) => (i === active ? (data.post as Post) : p));
      const { error: updErr } = await supabase.from("saved_calendars")
        .update({ posts: updated as unknown as never })
        .eq("id", id);
      if (updErr) {
        toast.error(updErr.message);
        return;
      }
      setPosts(updated);
      toast.success(`Day ${target.day} regenerated`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegenerating(false);
    }
  }

  const p = posts[active];
  const bodyWords = useMemo(() => wordCount(draft?.body || ""), [draft?.body]);
  const hookWords = useMemo(() => wordCount(draft?.hook || ""), [draft?.hook]);
  const titleChars = (draft?.title || "").length;
  const ctaChars = (draft?.cta || "").length;
  const lengthTarget = formPayload.length;
  const targetHint =
    lengthTarget === "short" ? "target 80–120" :
    lengthTarget === "long" ? "target 280–380" :
    lengthTarget === "mixed" ? "varies (80–380)" :
    "target 160–230";

  if (loading) return <div className="cd-app"><div className="cd-inner">Loading…</div></div>;

  return (
    <>
      <style>{css}</style>
      <div className="cd-app">
        <div className="cd-inner">
          <Link to="/my-calendars" className="cd-back">← Back to my calendars</Link>
          <h1 className="cd-title">{title}</h1>
          <div className="cd-meta">{meta}</div>

          <div className="cd-strip" role="tablist" aria-label="Days of the week">
            {posts.map((post, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                disabled={editing}
                className={`cd-tab ${i === active ? "on" : ""}`}
                onClick={() => { if (!editing) setActive(i); }}
              >
                <div className="cd-tab-dow">{post.dow}</div>
                <div className="cd-tab-n">{i + 1}</div>
              </button>
            ))}
          </div>

          <div className="cd-export-row" aria-label="Export options">
            <button
              type="button"
              className="cd-export-btn"
              onClick={() => downloadMd({ title, industryLabel, platform, coreIdea: formPayload.coreIdea }, posts)}
            >
              ↓ .md
            </button>
            <button
              type="button"
              className="cd-export-btn"
              onClick={() => downloadPdf({ title, industryLabel, platform, coreIdea: formPayload.coreIdea }, posts)}
            >
              ↓ .pdf
            </button>
          </div>

          {p && !editing && (
            <div className="cd-card">
              <div className="cd-ptitle">{p.title}</div>
              <div className="cd-blabel"><span>Hook</span></div>
              <div className="cd-hook">{p.hook}</div>
              <div className="cd-blabel"><span>Post body</span></div>
              <div className="cd-body">{p.body}</div>
              <div className="cd-blabel"><span>CTA</span></div>
              <div className="cd-cta">{p.cta}</div>
              <div className="cd-blabel"><span>Hashtags</span></div>
              <div className="cd-tags">{p.hashtags}</div>
              <div className="cd-actions">
                <button className="cd-btn cd-btn-p" onClick={startEdit} disabled={regenerating}>Edit this post</button>
                <button
                  className="cd-btn"
                  onClick={regenerateDay}
                  disabled={regenerating}
                  title="Re-roll this day without touching the other six"
                >
                  {regenerating ? "Regenerating…" : "↻ Regenerate this day"}
                </button>
              </div>
            </div>
          )}

          {p && editing && draft && (
            <div className="cd-card">
              <div className="cd-blabel"><span>Day · Day-of-week</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input
                  className="cd-edit-input"
                  type="number"
                  min={1}
                  max={7}
                  value={draft.day}
                  onChange={e => setDraft({ ...draft, day: Number(e.target.value) || draft.day })}
                  style={{ marginBottom: 0, fontFamily: "Sora, sans-serif", fontSize: 13 }}
                />
                <select
                  className="cd-edit-input"
                  value={draft.dow}
                  onChange={e => setDraft({ ...draft, dow: e.target.value })}
                  style={{ marginBottom: 0, fontFamily: "Sora, sans-serif", fontSize: 13, appearance: "auto" }}
                >
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="cd-blabel"><span>Topic</span></div>
              <input className="cd-edit-input" style={{ fontFamily: "Sora, sans-serif", fontSize: 13 }} value={draft.topic} onChange={e => setDraft({ ...draft, topic: e.target.value })} />

              <div className="cd-blabel"><span>Format</span></div>
              <input className="cd-edit-input" style={{ fontFamily: "Sora, sans-serif", fontSize: 13 }} value={draft.format} onChange={e => setDraft({ ...draft, format: e.target.value })} />

              <div className="cd-blabel">
                <span>Title</span>
                <span className="cd-blabel-count">{titleChars} chars</span>
              </div>
              <input className="cd-edit-input" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />

              <div className="cd-blabel">
                <span>Hook</span>
                <span className="cd-blabel-count">{hookWords} words</span>
              </div>
              <textarea className="cd-edit-area" rows={3} value={draft.hook} onChange={e => setDraft({ ...draft, hook: e.target.value })} />

              <div className="cd-blabel">
                <span>Post body</span>
                <span className="cd-blabel-count">{bodyWords} words · {targetHint}</span>
              </div>
              <textarea className="cd-edit-area" rows={10} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} />

              <div className="cd-blabel">
                <span>CTA</span>
                <span className="cd-blabel-count">{ctaChars} chars</span>
              </div>
              <textarea className="cd-edit-area" rows={2} value={draft.cta} onChange={e => setDraft({ ...draft, cta: e.target.value })} />

              <div className="cd-blabel"><span>Hashtags</span></div>
              <textarea className="cd-edit-area" rows={2} value={draft.hashtags} onChange={e => setDraft({ ...draft, hashtags: e.target.value })} />

              <div className="cd-blabel"><span>Why this works (rationale)</span></div>
              <textarea className="cd-edit-area" rows={3} value={draft.rationale} onChange={e => setDraft({ ...draft, rationale: e.target.value })} />

              <div className="cd-actions">
                <button className="cd-btn cd-btn-p" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
                <button className="cd-btn" onClick={cancelEdit} disabled={saving}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
