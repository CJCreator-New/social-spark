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
import { formatForPlatform, writeToClipboard, resolvePlatform, niceLabelFor, buildRawMarkdown, PLATFORM_LABELS } from "@/lib/platformCopy";

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
  bannedWords?: string[];
  requiredWords?: string[];
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
.cd-tab-date { font-size:9px; color:#5a5a72; font-weight:300; margin-top:2px; }
.cd-tab.on .cd-tab-date { color:rgba(200,240,154,0.45); }
.cd-date-pill { display:inline-block; padding:3px 10px; border-radius:99px; background:rgba(200,240,154,0.06); border:1px solid rgba(200,240,154,0.18); color:rgba(200,240,154,0.78); font-size:11px; margin-left:8px; }
.cd-time-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:14px 0 4px; }
.cd-time-label { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; font-weight:500; }
.cd-time-input { background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:6px 9px; font-size:12px; color:#edeae3; font-family:'Sora',sans-serif; outline:none; color-scheme:dark; width:100px; }
.cd-time-input:focus { border-color:rgba(200,240,154,0.28); }
.cd-tweak-wrap { position:relative; display:inline-block; }
.cd-tweak-menu { position:absolute; top:calc(100% + 4px); right:0; z-index:200; background:#181a26; border:1px solid rgba(255,255,255,0.1); border-radius:10px; overflow:hidden; min-width:170px; box-shadow:0 6px 24px rgba(0,0,0,.45); }
.cd-tweak-opt { padding:9px 13px; font-size:12px; color:#7a7a8e; cursor:pointer; font-family:'Sora',sans-serif; font-weight:300; border:none; background:transparent; width:100%; text-align:left; display:block; }
.cd-tweak-opt:hover { background:rgba(200,240,154,0.06); color:#c8f09a; }
.cd-fav-btn { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#7a7a8e; padding:6px 12px; border-radius:6px; font-size:12px; cursor:pointer; font-family:'Sora',sans-serif; transition:all .15s; }
.cd-fav-btn.on { color:#c8f09a; border-color:rgba(200,240,154,0.32); background:rgba(200,240,154,0.06); }
.cd-fav-btn:hover { border-color:rgba(200,240,154,0.32); }
.cd-budget { display:inline-flex; align-items:center; gap:5px; font-size:10px; letter-spacing:.04em; padding:3px 9px; border-radius:99px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,.02); color:#7a7a8e; font-family:'Sora',sans-serif; font-weight:400; font-variant-numeric:tabular-nums; white-space:nowrap; }
.cd-budget.warn { color:#f0d49a; border-color:rgba(240,212,154,.32); background:rgba(240,212,154,.06); }
.cd-budget.over { color:#f09a9a; border-color:rgba(240,154,154,.35); background:rgba(240,154,154,.08); }
.cd-budget-dot { width:5px; height:5px; border-radius:50%; background:currentColor; opacity:.7; }
.cd-pin-btn { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#7a7a8e; width:30px; height:30px; border-radius:50%; cursor:pointer; font-size:14px; display:inline-flex; align-items:center; justify-content:center; transition:all .15s; flex-shrink:0; }
.cd-pin-btn.on { background:rgba(200,240,154,.12); border-color:rgba(200,240,154,.42); color:#c8f09a; }
.cd-pin-btn:hover { border-color:rgba(200,240,154,.32); color:#c8f09a; }
.cd-tab.locked::after { content:'📌'; position:absolute; top:3px; right:4px; font-size:9px; line-height:1; }
.cd-tab { position:relative; }
.cd-reformat-bar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:12px; padding:10px 14px; margin-bottom:14px; }
.cd-reformat-label { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; font-weight:500; }
.cd-reformat-sel { background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:6px 28px 6px 10px; font-size:12px; color:#edeae3; font-family:'Sora',sans-serif; outline:none; appearance:none; cursor:pointer; background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 11 11' fill='none' stroke='%237a7a8e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M2.5 4l3 3 3-3'/></svg>"); background-repeat:no-repeat; background-position:right 9px center; }
.cd-reformat-btn { background:rgba(200,240,154,.12); border:1px solid rgba(200,240,154,.28); color:#c8f09a; padding:6px 14px; border-radius:6px; font-size:12px; cursor:pointer; font-family:'Sora',sans-serif; font-weight:500; }
.cd-reformat-btn:disabled { opacity:.5; cursor:not-allowed; }
.cd-copy-split { position:relative; display:inline-flex; }
.cd-copy-split-main { border-top-right-radius:0; border-bottom-right-radius:0; border-right-width:0; }
.cd-copy-caret { padding:0 10px; border-radius:0 8px 8px 0; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#9a9aae; cursor:pointer; font-family:'Sora',sans-serif; display:inline-flex; align-items:center; transition:all .15s; }
.cd-copy-caret:hover { border-color:rgba(200,240,154,.32); color:#c8f09a; }
.cd-copy-menu { position:absolute; top:calc(100% + 4px); right:0; z-index:200; background:#181a26; border:1px solid rgba(255,255,255,0.1); border-radius:10px; overflow:hidden; min-width:200px; box-shadow:0 6px 24px rgba(0,0,0,.45); }
.cd-copy-menu-opt { padding:9px 13px; font-size:12px; color:#7a7a8e; cursor:pointer; font-family:'Sora',sans-serif; font-weight:300; border:none; background:transparent; width:100%; text-align:left; display:block; }
.cd-copy-menu-opt:hover { background:rgba(200,240,154,.06); color:#c8f09a; }
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
  const [weekStart, setWeekStart] = useState<string>(toDateInputValue(nextMonday()));
  const [postTimes, setPostTimes] = useState<Record<string, string>>({});
  const [isFavorite, setIsFavorite] = useState(false);
  const [tweakOpen, setTweakOpen] = useState(false);
  const tweakRef = useRef<HTMLDivElement>(null);
  const [lockedDays, setLockedDays] = useState<Set<number>>(new Set());
  const [reformatTarget, setReformatTarget] = useState<string>("");
  const [reformatting, setReformatting] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tweakOpen) return;
    const h = (e: MouseEvent) => {
      if (tweakRef.current && !tweakRef.current.contains(e.target as Node)) setTweakOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [tweakOpen]);

  useEffect(() => {
    if (!copyMenuOpen) return;
    const h = (e: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) setCopyMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [copyMenuOpen]);

  function toggleLock(day: number) {
    setLockedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  }

  async function reformatAllForPlatform(targetPlatform: string) {
    if (!targetPlatform || targetPlatform === platform || reformatting || regenerating) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in required"); return; }
    const ok = window.confirm(`Reformat all 7 posts for ${niceLabelFor(targetPlatform)}? Saves as a NEW calendar — this one stays untouched.`);
    if (!ok) return;
    setReformatting(true);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const next: Post[] = [...posts];
      for (let i = 0; i < posts.length; i++) {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/regenerate-post`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session?.access_token || SUPABASE_KEY}` },
          body: JSON.stringify({
            industry: formPayload.industry || "", industryLabel, platform: targetPlatform,
            coreIdea: formPayload.coreIdea || title, audiences: formPayload.audiences || [],
            voice: formPayload.voice || "", style: formPayload.style || "", goals: formPayload.goals || [],
            format: formPayload.format || "Balanced mix", cta: formPayload.cta || "Share & repost bait",
            length: formPayload.length || "medium", structure: formPayload.structure || "mixed",
            extra: formPayload.extra || "", bannedWords: formPayload.bannedWords || [], requiredWords: formPayload.requiredWords || [],
            post: posts[i], siblings: next,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.post) next[i] = data.post;
      }
      const newTitle = `${title} — ${targetPlatform}`;
      const newForm = { ...formPayload, platform: targetPlatform };
      const { data: ins, error: insErr } = await supabase.from("saved_calendars").insert([{
        user_id: user.id, title: newTitle, industry: formPayload.industry || null,
        industry_label: industryLabel || null, platform: targetPlatform, core_idea: formPayload.coreIdea || null,
        form_payload: newForm as never, posts: next as never, week_start_date: weekStart || null,
        post_times: postTimes as never,
      }]).select("id").single();
      if (insErr) { toast.error(insErr.message); return; }
      toast.success(`Reformatted for ${niceLabelFor(targetPlatform)} ✓`);
      navigate(`/calendar/${ins.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reformat failed");
    } finally {
      setReformatting(false);
      setReformatTarget("");
    }
  }

  useEffect(() => {
    if (!id) return;
    supabase.from("saved_calendars").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error || !data) { toast.error("Calendar not found"); navigate("/my-calendars"); return; }
      const loadedPosts = (data.posts as unknown as Post[]) || [];
      setPosts(loadedPosts);
      setTitle(data.title);
      setPlatform(data.platform || "");
      setIndustryLabel(data.industry_label || "");
      setFormPayload((data.form_payload as unknown as FormPayload) || {});
      setIsFavorite(!!(data as { is_favorite?: boolean }).is_favorite);
      const fp = (data.form_payload as { weekStart?: string } | null);
      const ws = (data as { week_start_date?: string | null }).week_start_date
        || fp?.weekStart
        || toDateInputValue(nextMonday());
      setWeekStart(ws);
      const storedTimes = (data as { post_times?: Record<string, string> | null }).post_times;
      if (storedTimes && typeof storedTimes === "object") {
        setPostTimes(storedTimes);
      } else {
        const seed: Record<string, string> = {};
        for (const p of loadedPosts) seed[String(p.day)] = "09:00";
        setPostTimes(seed);
      }
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

  async function regenerateDay(tweak?: TweakKind) {
    if (!id || regenerating || editing) return;
    const target = posts[active];
    if (!target) return;
    setRegenerating(true);
    setTweakOpen(false);
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
          bannedWords: formPayload.bannedWords || [],
          requiredWords: formPayload.requiredWords || [],
          post: target,
          siblings: posts,
          tweak,
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
      const tweakLabel = tweak ? ` (${tweak.replace("-", " ")})` : "";
      toast.success(`Day ${target.day} regenerated${tweakLabel}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegenerating(false);
    }
  }

  async function updatePostTime(day: number, time: string) {
    const next = { ...postTimes, [String(day)]: time };
    setPostTimes(next);
    if (!id) return;
    const { error } = await supabase.from("saved_calendars")
      .update({ post_times: next as never })
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  async function updateWeekStart(value: string) {
    setWeekStart(value);
    if (!id) return;
    const { error } = await supabase.from("saved_calendars")
      .update({ week_start_date: value || null })
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  async function toggleFavorite() {
    if (!id) return;
    const next = !isFavorite;
    setIsFavorite(next);
    const { error } = await supabase.from("saved_calendars")
      .update({ is_favorite: next })
      .eq("id", id);
    if (error) {
      setIsFavorite(!next);
      toast.error(error.message);
    }
  }

  function exportIcs() {
    const ws = parseLocalDate(weekStart) || nextMonday();
    downloadIcs({ calendarTitle: title, weekStart: ws, postTimes, platform }, posts);
  }

  const weekStartDate = useMemo(() => parseLocalDate(weekStart) || nextMonday(), [weekStart]);

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Link to="/my-calendars" className="cd-back">← Back to my calendars</Link>
            <button
              type="button"
              className={`cd-fav-btn ${isFavorite ? "on" : ""}`}
              onClick={toggleFavorite}
              aria-pressed={isFavorite}
              title={isFavorite ? "Unstar" : "Star"}
            >
              {isFavorite ? "★ Starred" : "☆ Star"}
            </button>
          </div>
          <h1 className="cd-title">{title}</h1>
          <div className="cd-meta">{meta}</div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <span style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "#7a7a8e" }}>Week starting</span>
            <input
              type="date"
              value={weekStart}
              onChange={e => updateWeekStart(e.target.value)}
              style={{ background: "#07080d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#edeae3", fontFamily: "Sora, sans-serif", outline: "none", colorScheme: "dark" }}
            />
            <span style={{ fontSize: 11, color: "#7a7a8e" }}>Day 1 = {shortDateLabel(weekStartDate)}</span>
          </div>

          <div className="cd-reformat-bar">
            <span className="cd-reformat-label">Reformat for</span>
            <select
              className="cd-reformat-sel"
              value={reformatTarget}
              onChange={(e) => setReformatTarget(e.target.value)}
              disabled={reformatting || regenerating}
            >
              <option value="">Another platform…</option>
              {(["LinkedIn","Twitter/X","Instagram","Facebook","Newsletter","Blog"] as const)
                .filter(p => p !== platform)
                .map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
              type="button"
              className="cd-reformat-btn"
              disabled={!reformatTarget || reformatting || regenerating}
              onClick={() => reformatAllForPlatform(reformatTarget)}
              title="Re-runs all 7; saved as a new calendar"
            >
              {reformatting ? "Reformatting all 7…" : "Reformat all 7 →"}
            </button>
          </div>

          <div className="cd-strip" role="tablist" aria-label="Days of the week">
            {posts.map((post, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                disabled={editing}
                className={`cd-tab ${i === active ? "on" : ""} ${lockedDays.has(post.day) ? "locked" : ""}`}
                onClick={() => { if (!editing) setActive(i); }}
              >
                <div className="cd-tab-dow">{post.dow}</div>
                <div className="cd-tab-n">{i + 1}</div>
                <div className="cd-tab-date">{shortDateLabel(dateForDow(weekStartDate, post.dow)).split(" · ")[1]}</div>
              </button>
            ))}
          </div>

          <div className="cd-export-row" aria-label="Export options">
            <button type="button" className="cd-export-btn" onClick={() => downloadMd({ title, industryLabel, platform, coreIdea: formPayload.coreIdea }, posts)}>↓ .md</button>
            <button type="button" className="cd-export-btn" onClick={() => downloadPdf({ title, industryLabel, platform, coreIdea: formPayload.coreIdea }, posts)}>↓ .pdf</button>
            <button type="button" className="cd-export-btn" onClick={exportIcs} title="Export to Google Calendar / Outlook / Apple Cal">📅 .ics</button>
          </div>

          {p && !editing && (
            <div className="cd-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                <span className="cd-date-pill">{shortDateLabel(dateForDow(weekStartDate, p.dow))}</span>
                <button
                  type="button"
                  className={`cd-pin-btn ${lockedDays.has(p.day) ? "on" : ""}`}
                  onClick={() => toggleLock(p.day)}
                  title={lockedDays.has(p.day) ? "Pinned" : "Pin this post"}
                  aria-pressed={lockedDays.has(p.day)}
                >
                  {lockedDays.has(p.day) ? "📌" : "📍"}
                </button>
              </div>
              <div className="cd-time-row">
                <span className="cd-time-label">Post time</span>
                <input
                  type="time"
                  className="cd-time-input"
                  value={postTimes[String(p.day)] || "09:00"}
                  onChange={e => updatePostTime(p.day, e.target.value)}
                />
              </div>
              <div className="cd-ptitle" style={{ marginTop: 14 }}>{p.title}</div>
              <div className="cd-blabel"><span>Hook</span></div>
              <div className="cd-hook">{p.hook}</div>
              <div className="cd-blabel"><span>Post body</span></div>
              <div className="cd-body">{p.body}</div>
              <div className="cd-blabel"><span>CTA</span></div>
              <div className="cd-cta">{p.cta}</div>
              <div className="cd-blabel"><span>Hashtags</span></div>
              <div className="cd-tags">{p.hashtags}</div>
              <div className="cd-actions">
                {(() => {
                  const f = formatForPlatform(p, platform);
                  const niceLabel = niceLabelFor(platform);
                  const ratio = f.charCount / f.limit;
                  const budgetCls = f.charCount > f.limit ? "over" : ratio >= 0.9 ? "warn" : "";
                  return (
                    <>
                      <span
                        className={`cd-budget ${budgetCls}`}
                        title={`Post-format length for ${niceLabel}`}
                        aria-label={`${f.charCount} of ${f.limit} characters used for ${niceLabel}`}
                      >
                        <span className="cd-budget-dot" aria-hidden="true" />
                        {f.charCount.toLocaleString()} / {f.limit.toLocaleString()}
                      </span>
                      <button
                        className="cd-btn cd-btn-p"
                        disabled={regenerating}
                        title={`${f.charCount} / ${f.limit} chars`}
                        onClick={async () => {
                          const ok = await writeToClipboard(f.text);
                          if (!ok) { toast.error("Could not copy to clipboard"); return; }
                          if (f.truncated && f.platform === "twitter") {
                            toast.error("Trimmed to fit X's 280-char limit");
                          } else {
                            toast.success(`Copied for ${niceLabel} ✓`);
                          }
                        }}
                      >
                        Copy for {niceLabel}
                      </button>
                    </>
                  );
                })()}
                <button className="cd-btn" onClick={startEdit} disabled={regenerating}>Edit this post</button>
                <button
                  className="cd-btn"
                  onClick={() => regenerateDay()}
                  disabled={regenerating}
                  title="Re-roll this day without touching the other six"
                >
                  {regenerating ? "Regenerating…" : "↻ Regenerate"}
                </button>
                <div className="cd-tweak-wrap" ref={tweakOpen ? tweakRef : undefined}>
                  <button
                    className="cd-btn"
                    disabled={regenerating}
                    onClick={() => setTweakOpen(o => !o)}
                    aria-haspopup="menu"
                    aria-expanded={tweakOpen}
                  >
                    ⚡ Tweak ▾
                  </button>
                  {tweakOpen && (
                    <div className="cd-tweak-menu" role="menu">
                      <button className="cd-tweak-opt" onClick={() => regenerateDay("shorter")}>Make shorter</button>
                      <button className="cd-tweak-opt" onClick={() => regenerateDay("punchier")}>Make punchier</button>
                      <button className="cd-tweak-opt" onClick={() => regenerateDay("add-stat")}>Add a stat</button>
                      <button className="cd-tweak-opt" onClick={() => regenerateDay("remove-emoji")}>Remove emoji</button>
                      <button className="cd-tweak-opt" onClick={() => regenerateDay("more-personal")}>More personal</button>
                    </div>
                  )}
                </div>
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
