import { formatForPlatform, writeToClipboard, resolvePlatform, niceLabelFor, buildRawMarkdown, PLATFORM_LABELS, stripMarkdown } from "@/lib/platformCopy";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCalendarQuery, useProfileQuery, useProfileUpdateMutation, useScheduledPostsQuery, useCreateCalendarMutation, useRegeneratePostMutation, useUpdateSavedCalendarMutation } from "@/hooks/useAppQueries";
import { toast } from "sonner";
import { createScopedLogger } from "@/lib/logger";
import { downloadMd, downloadPdf } from "@/lib/exportCalendar";
import {
  downloadIcs,
  parseLocalDate,
  nextMonday,
  toDateInputValue,
  dateForDow,
  shortDateLabel,
} from "@/lib/calendarSchedule";
import { suggestedTimeForDay } from "@/lib/postingTimes";
import { applyPolicy, parsePolicyList, parseHashtagsString, normalizeTag, displayTag, HashtagPolicy } from "@/lib/hashtagPolicy";
import { insightFor } from "@/lib/postInsights";
import PostInsights from "@/components/PostInsights";
import { browserTimezone, fmtDateInTz, fmtTimeInTz, listTimezones, tzLabel, zonedToUtcIso } from "@/lib/timezones";
import { buildTrackingUrl } from "@/lib/utm";
import { useAuth } from "@/contexts/AuthContext";
import { getE2EAuthFlag } from "@/lib/e2eFixtures";
import e2eStore from "@/lib/e2eStore";
import { generateLocalPosts } from "@/lib/localPostGenerator";
import FeedbackModal from "@/components/FeedbackModal";
import { WorkspacePage } from "@/components/layout/WorkspacePage";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { Database, Json } from "@/integrations/supabase/types";

interface Post {
  day: number; dow: string; topic: string; format: string;
  title: string; hook: string; body: string; cta: string; hashtags: string; rationale: string;
  hook_options?: string[];
  cta_options?: string[];
}

type SavedCalendarInsert = Database["public"]["Tables"]["saved_calendars"]["Insert"];

const EMPTY_POST: Post = {
  day: 1,
  dow: "Mon",
  topic: "",
  format: "Balanced mix",
  title: "",
  hook: "",
  body: "",
  cta: "",
  hashtags: "",
  rationale: "",
};

function unwrapPost(value: unknown): Post | null {
  if (!value || typeof value !== "object") return null;
  const candidate = "post" in value ? (value as { post?: unknown }).post : value;
  if (!candidate || typeof candidate !== "object") return null;
  const post = candidate as Partial<Post>;
  return typeof post.day === "number" && typeof post.dow === "string"
    ? { ...EMPTY_POST, ...post }
    : null;
}

interface FormPayload {
  industry?: string;
  platform?: string;
  language?: string;
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



const css = `
.cd-app { min-height:100vh; background:#07080d; color:#edeae3; font-family:'Sora',sans-serif; padding:40px 24px 100px; }
.cd-inner { max-width:760px; margin:0 auto; }
.cd-back { font-size:12px; color:#7a7a8e; text-decoration:none; }
.cd-back:hover { color:#c8f09a; }
.cd-title { font-family:'Playfair Display',serif; font-size:28px; font-weight:400; margin:14px 0 6px; }
.cd-meta { font-size:12px; color:#7a7a8e; margin-bottom:24px; }
.cd-hero { display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.75fr);gap:14px;align-items:stretch;margin:18px 0 18px; }
.cd-hero-main,.cd-hero-side { background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:20px; padding:20px; }
.cd-hero-main { background:linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01)); }
.cd-hero-side { background:linear-gradient(180deg,rgba(200,240,154,0.06),rgba(255,255,255,0.01)); display:grid; gap:10px; }
.cd-hero-kicker { font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#c8f09a;font-weight:500;margin-bottom:12px; }
.cd-hero-title { font-family:'Playfair Display',serif; font-size:30px; font-weight:400; line-height:1.08; letter-spacing:-.4px; margin:0 0 10px; max-width:15ch; }
.cd-hero-copy { font-size:13px; color:#7a7a8e; line-height:1.7; margin:0 0 16px; max-width:54ch; }
.cd-hero-chiprow { display:flex;flex-wrap:wrap;gap:8px; }
.cd-hero-chip { display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,.02);font-size:11px;color:#9a9aae; }
.cd-hero-card { border:1px solid rgba(255,255,255,0.08);background:#07080d;border-radius:16px;padding:14px 15px; }
.cd-hero-card span { display:block;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:#7a7a8e;font-weight:500;margin-bottom:6px; }
.cd-hero-card strong { display:block;font-family:'Playfair Display',serif;font-size:22px;font-weight:400;color:#edeae3;line-height:1.15;margin-bottom:3px; }
.cd-hero-card small { display:block;font-size:11px;color:#5a5a72;line-height:1.5; }
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
.cd-stats { background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:12px; padding:14px 18px; margin-bottom:14px; display:grid; grid-template-columns:repeat(auto-fit,minmax(110px,1fr)); gap:10px; }
.cd-stat { display:flex; flex-direction:column; gap:3px; }
.cd-stat-label { font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; font-weight:500; }
.cd-stat-val { font-family:'Playfair Display',serif; font-size:18px; color:#edeae3; font-variant-numeric:tabular-nums; }
.cd-stat-val em { font-style:normal; color:#c8f09a; }
.cd-stat-sub { font-size:10px; color:#5a5a72; font-weight:300; }
.cd-chip { display:inline-flex; align-items:center; gap:5px; font-size:10px; letter-spacing:.04em; padding:3px 9px; border-radius:99px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,.02); color:#7a7a8e; font-family:'Sora',sans-serif; font-weight:400; white-space:nowrap; }
.cd-chip.good { color:#c8f09a; border-color:rgba(200,240,154,.32); background:rgba(200,240,154,.06); }
.cd-chip.warn { color:#f0d49a; border-color:rgba(240,212,154,.32); background:rgba(240,212,154,.06); }
.cd-chip.bad { color:#f09a9a; border-color:rgba(240,154,154,.35); background:rgba(240,154,154,.08); }
.cd-bulk-bar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:14px; padding:10px 14px; background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:12px; }
.cd-bulk-label { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#7a7a8e; font-weight:500; flex:1; }
.cd-bulk-btn { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#9a9aae; padding:7px 14px; border-radius:8px; font-size:12px; cursor:pointer; font-family:'Sora',sans-serif; transition:all .15s; }
.cd-bulk-btn:hover { border-color:rgba(200,240,154,.32); color:#c8f09a; }
.cd-bulk-btn.primary { background:rgba(200,240,154,.12); border-color:rgba(200,240,154,.32); color:#c8f09a; }
.cd-bulk-btn:disabled { opacity:.5; cursor:not-allowed; }
.cd-modal-bg { position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:300; display:flex; align-items:center; justify-content:center; padding:20px; }
.cd-modal { background:#0d0f18; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:26px; max-width:520px; width:100%; max-height:90vh; overflow:auto; }
.cd-modal h3 { font-family:'Playfair Display',serif; font-size:22px; font-weight:400; margin:0 0 6px; color:#edeae3; }
.cd-modal p { font-size:12px; color:#7a7a8e; margin:0 0 16px; line-height:1.6; }
.cd-modal-row { display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.04); }
.cd-modal-row:last-of-type { border-bottom:none; }
.cd-modal-day { font-size:11px; color:#9a9aae; min-width:90px; }
.cd-modal-time { background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:6px 9px; font-size:12px; color:#edeae3; font-family:'Sora',sans-serif; outline:none; color-scheme:dark; }
.cd-modal-actions { display:flex; gap:8px; margin-top:18px; justify-content:flex-end; }
.cd-tz-bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:14px; padding:10px 14px; background:#0d0f18; border:1px solid rgba(255,255,255,0.055); border-radius:12px; }
.cd-tz-input, .cd-tz-sel { background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:6px 10px; font-size:12px; color:#edeae3; font-family:'Sora',sans-serif; outline:none; }
.cd-tz-input:focus, .cd-tz-sel:focus { border-color:rgba(200,240,154,0.4); }
.cd-tz-input { flex:1; min-width:200px; }
.cd-tag-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:6px; background:rgba(200,240,154,0.06); border:1px solid rgba(200,240,154,0.15); color:rgba(200,240,154,0.78); font-size:12px; cursor:pointer; transition:all .12s; font-family:'Sora',sans-serif; }
.cd-tag-chip:hover { background:rgba(200,240,154,0.14); border-color:rgba(200,240,154,0.32); color:#c8f09a; }
.cd-tag-chip.locked { background:rgba(200,240,154,0.18); border-color:rgba(200,240,154,0.45); color:#c8f09a; }
.cd-tag-policy-warn { display:inline-flex; align-items:center; margin-left:4px; padding:2px 6px; border-radius:6px; border:1px solid rgba(240,212,154,.32); background:rgba(240,212,154,.06); color:#f0d49a; font-size:10px; line-height:1.3; vertical-align:middle; }
.cd-tag-pop { position:absolute; z-index:300; background:#181a26; border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:10px; min-width:240px; box-shadow:0 8px 28px rgba(0,0,0,.55); display:flex; flex-direction:column; gap:6px; }
.cd-tag-pop-h { font-size:11px; color:#7a7a8e; padding-bottom:4px; border-bottom:1px solid rgba(255,255,255,.05); margin-bottom:2px; }
.cd-tag-pop-row { display:flex; gap:6px; align-items:center; }
.cd-tag-pop-btn { background:transparent; border:1px solid rgba(255,255,255,0.1); color:#9a9aae; padding:6px 10px; border-radius:6px; font-size:11px; cursor:pointer; font-family:'Sora',sans-serif; flex:1; text-align:left; }
.cd-tag-pop-btn:hover { border-color:rgba(200,240,154,.32); color:#c8f09a; }
.cd-tag-pop-btn.danger:hover { border-color:rgba(240,154,154,.4); color:#f09a9a; }
.cd-tag-pop-input { flex:1; background:#07080d; border:1px solid rgba(255,255,255,0.1); border-radius:6px; padding:5px 8px; font-size:12px; color:#edeae3; font-family:'Sora',sans-serif; outline:none; }
.cd-tag-pop-input:focus { border-color:rgba(200,240,154,.4); }
.cd-tag-wrap { position:relative; display:inline-block; margin-right:4px; margin-bottom:4px; }
.cd-tags-row { display:flex; flex-wrap:wrap; align-items:center; }
.cd-status-dot { width:6px; height:6px; border-radius:50%; display:inline-block; margin-right:4px; }
.cd-status-dot.drafted { background:#9a9aae; }
.cd-status-dot.approved { background:#9ab5f0; }
.cd-status-dot.published { background:#c8f09a; }
.cd-status-dot.failed { background:#f09a9a; }
.cd-tab-status { position:absolute; top:3px; left:4px; width:5px; height:5px; border-radius:50%; }

@media (max-width: 760px) {
  .cd-app { padding:28px 16px 80px; }
  .cd-hero { grid-template-columns:1fr; }
  .cd-hero-title { font-size:26px; max-width:none; }
  .cd-stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
`;

function wordCount(s: string): number {
  if (!s) return 0;
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function hasEmoji(text: string): boolean {
  return /\p{Emoji}/u.test(text);
}
type TweakKind = "shorter" | "punchier" | "add-stat" | "remove-emoji" | "more-personal" | "clean-formatting";

export default function CalendarDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const [pendingReformatTarget, setPendingReformatTarget] = useState<string | null>(null);
  const [reformatting, setReformatting] = useState(false);
  const createCalendar = useCreateCalendarMutation();
  const regenerateMutation = useRegeneratePostMutation(id);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const [exportingFormat, setExportingFormat] = useState<"md" | "pdf" | "ics" | null>(null);
  const [bulkRegenerating, setBulkRegenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [timezone, setTimezone] = useState<string>(browserTimezone());
  const [profileTimezone, setProfileTimezone] = useState<string>("");
  const [trackingUrl, setTrackingUrl] = useState<string>("");
  const [variantSaving, setVariantSaving] = useState<{ day: number; field: "hook" | "cta" } | null>(null);
  const [lockedHashtags, setLockedHashtags] = useState<Record<string, string[]>>({});
  const [profilePolicy, setProfilePolicy] = useState<HashtagPolicy>({ banned: [], required: [] });
  const [statusByDay, setStatusByDay] = useState<Record<number, "drafted" | "approved" | "published" | "failed">>({});
  const [tagPopover, setTagPopover] = useState<{ day: number; tag: string } | null>(null);
  const [tagReplacement, setTagReplacement] = useState("");
  const tzList = listTimezones();

  const { data: calendarData, isLoading: calendarLoading, error: calendarError } = useCalendarQuery(id);
  const { data: profileData } = useProfileQuery(user?.id);
  const { data: scheduledPostsData } = useScheduledPostsQuery(id);
  const updateCalendarMutation = useUpdateSavedCalendarMutation(id);
  const updateProfileMutation = useProfileUpdateMutation(user?.id);

  const handleTweakClickOutside = useCallback((e: MouseEvent) => {
    if (tweakRef.current && !tweakRef.current.contains(e.target as Node)) setTweakOpen(false);
  }, []);

  const handleCopyMenuClickOutside = useCallback((e: MouseEvent) => {
    if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) setCopyMenuOpen(false);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (posts.length <= 1) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setActive(i => (i + 1) % posts.length);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setActive(i => (i - 1 + posts.length) % posts.length);
    }
  }, [posts.length]);

  useEffect(() => {
    if (!tweakOpen) return;
    document.addEventListener("mousedown", handleTweakClickOutside);
    return () => document.removeEventListener("mousedown", handleTweakClickOutside);
  }, [tweakOpen, handleTweakClickOutside]);

  useEffect(() => {
    if (!copyMenuOpen) return;
    document.addEventListener("mousedown", handleCopyMenuClickOutside);
    return () => document.removeEventListener("mousedown", handleCopyMenuClickOutside);
  }, [copyMenuOpen, handleCopyMenuClickOutside]);

  // Keyboard shortcuts: arrow keys navigate between days
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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
            language: formPayload.language || "English",
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
      try {
        const payload = {
          user_id: user.id,
          title: newTitle,
          industry: formPayload.industry || null,
          industry_label: industryLabel || null,
          platform: targetPlatform,
          core_idea: formPayload.coreIdea || null,
          form_payload: newForm as unknown as Json,
          posts: next as unknown as Json,
          week_start_date: weekStart || null,
          post_times: postTimes,
        };
        const resp = await createCalendar.mutateAsync(payload);
        toast.success(`Reformatted for ${niceLabelFor(targetPlatform)} ✓`);
        navigate(`/calendar/${resp.id}`);
      } catch (insErr) {
        toast.error(insErr instanceof Error ? insErr.message : String(insErr));
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reformat failed");
    } finally {
      setReformatting(false);
      setReformatTarget("");
    }
  }

  // Handle calendar data loading
  useEffect(() => {
    if (!calendarData) return;
    if (calendarError) {
      toast.error("Calendar not found");
      navigate("/my-calendars");
      return;
    }

    const loadedPosts = (calendarData.posts as unknown as Post[]) || [];
    const isE2E = typeof window !== "undefined" && window.localStorage.getItem(getE2EAuthFlag()) === "true";
    const hydratedPosts = loadedPosts.length > 0
      ? loadedPosts
      : isE2E
        ? generateLocalPosts({
            industry: (calendarData as { industry?: string | null }).industry || "",
            industryLabel: calendarData.industry_label || "",
            platform: calendarData.platform || "LinkedIn",
            language: (calendarData.form_payload as { language?: string } | null)?.language || "English",
            coreIdea: calendarData.core_idea || calendarData.title || "",
            audiences: (calendarData.form_payload as { audiences?: string[] } | null)?.audiences || [],
            voice: (calendarData.form_payload as { voice?: string } | null)?.voice || "",
            style: (calendarData.form_payload as { style?: string } | null)?.style || "",
            goals: (calendarData.form_payload as { goals?: string[] } | null)?.goals || [],
            topics: (calendarData.form_payload as { topics?: string[] } | null)?.topics || [],
            format: (calendarData.form_payload as { format?: string } | null)?.format || "Balanced mix",
            cta: (calendarData.form_payload as { cta?: string } | null)?.cta || "Share & repost bait",
            length: (calendarData.form_payload as { length?: string } | null)?.length || "medium",
            structure: (calendarData.form_payload as { structure?: string } | null)?.structure || "mixed",
            extra: (calendarData.form_payload as { extra?: string } | null)?.extra || "",
            bannedWords: (calendarData.form_payload as { bannedWords?: string[] } | null)?.bannedWords || [],
            requiredWords: (calendarData.form_payload as { requiredWords?: string[] } | null)?.requiredWords || [],
            targetTopic: (calendarData.form_payload as { topics?: string[] } | null)?.topics?.[0] || calendarData.core_idea || calendarData.title || "",
            targetDow: "Mon",
          })
        : [];
    setPosts(hydratedPosts);
    setTitle(calendarData.title);
    setPlatform(calendarData.platform || "");
    setIndustryLabel(calendarData.industry_label || "");
    setFormPayload((calendarData.form_payload as unknown as FormPayload) || {});
    setMeta(`${calendarData.industry_label || ""} · ${calendarData.platform || ""} · ${new Date(calendarData.created_at).toLocaleDateString()}`);
    const dx = calendarData as { is_favorite?: boolean; timezone?: string | null; tracking_url?: string | null; locked_hashtags?: Record<string, string[]> | null };
    setIsFavorite(!!dx.is_favorite);
    setTrackingUrl(dx.tracking_url || "");
    setLockedHashtags(dx.locked_hashtags || {});
    const fp = (calendarData.form_payload as { weekStart?: string } | null);
    const ws = (calendarData as { week_start_date?: string | null }).week_start_date
      || fp?.weekStart
      || toDateInputValue(nextMonday());
    setWeekStart(ws);
    const storedTimes = (calendarData as { post_times?: Record<string, string> | null }).post_times;
    if (storedTimes && typeof storedTimes === "object") {
      setPostTimes(storedTimes);
    } else {
      const seed: Record<string, string> = {};
      for (const p of hydratedPosts) seed[String(p.day)] = suggestedTimeForDay(Number(p.day) || 1);
      setPostTimes(seed);
    }
  }, [calendarData, calendarError, navigate]);

  // Handle profile data loading
  useEffect(() => {
    if (!profileData) return;
    const profTz = profileData.default_timezone || browserTimezone();
    setProfileTimezone(profTz);
    setProfilePolicy({
      banned: parsePolicyList(profileData.banned_hashtags),
      required: parsePolicyList(profileData.required_hashtags),
    });
  }, [profileData]);

  // Handle scheduled posts status loading
  useEffect(() => {
    if (!scheduledPostsData) return;
    const statusMap: Record<number, "drafted" | "approved" | "published" | "failed"> = {};
    for (const r of scheduledPostsData) {
      statusMap[r.post_day] = r.workflow_status;
    }
    setStatusByDay(statusMap);
  }, [scheduledPostsData]);

  // Set timezone when both calendar and profile data are loaded
  useEffect(() => {
    if (!calendarData || !profileData) return;
    const dx = calendarData as { timezone?: string | null };
    const profTz = profileData.default_timezone || browserTimezone();
    setTimezone(dx.timezone || profTz);
  }, [calendarData, profileData]);

  // Set loading state based on queries
  useEffect(() => {
    setLoading(calendarLoading);
  }, [calendarLoading]);

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
    try {
      await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
    } catch (error) {
      setSaving(false);
      return toast.error(error instanceof Error ? error.message : "Save failed");
    }
    setSaving(false);
    setPosts(updated);
    setEditing(false);
    setDraft(null);
    toast.success("Post updated");
  }

  async function selectHookVariant(day: number, variant: string) {
    const previous = posts;
    const updated = previous.map(p => p.day === day ? { ...p, hook: variant } : p);
    setPosts(updated);
    setVariantSaving({ day, field: "hook" });
    try {
      await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
      toast.success("Hook variant saved");
    } catch (error) {
      setPosts(previous);
      toast.error(error instanceof Error ? error.message : "Failed to save hook variant");
    } finally {
      setVariantSaving(prev => prev?.day === day && prev?.field === "hook" ? null : prev);
    }
  }

  async function selectCtaVariant(day: number, variant: string) {
    const previous = posts;
    const updated = previous.map(p => p.day === day ? { ...p, cta: variant } : p);
    setPosts(updated);
    setVariantSaving({ day, field: "cta" });
    try {
      await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
      toast.success("CTA variant saved");
    } catch (error) {
      setPosts(previous);
      toast.error(error instanceof Error ? error.message : "Failed to save CTA variant");
    } finally {
      setVariantSaving(prev => prev?.day === day && prev?.field === "cta" ? null : prev);
    }
  }

  async function regenerateDay(tweak?: TweakKind, feedback?: string, category?: string, rating?: number) {
    const log = createScopedLogger('CalendarDetail-RegenerateDay');
    if (!id || regenerating || editing) return;
    const target = posts[active];
    if (!target) return;
    setRegenerating(true);
    setTweakOpen(false);
    try {
      if (tweak === "clean-formatting") {
        const cleaned: Post = {
          ...target,
          title: stripMarkdown(target.title),
          hook: stripMarkdown(target.hook),
          body: stripMarkdown(target.body),
          cta: stripMarkdown(target.cta),
        };
        const updated = posts.map((p, i) => (i === active ? cleaned : p));
        try {
          await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
        } catch (cleanErr) {
          log.error(`Failed to save cleaned post`, cleanErr, { calendarId: id, day: target.day });
          toast.error(cleanErr instanceof Error ? cleanErr.message : "Failed to save cleaned post");
          return;
        }
        setPosts(updated);
        toast.success(`Day ${target.day} formatting cleaned ✓`);
        return;
      }
      const payload = {
        industry: formPayload.industry || "",
        industryLabel,
        platform: platform || formPayload.platform || "LinkedIn",
        language: formPayload.language || "English",
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
        feedback,
        feedbackCategory: category,
        feedbackRating: rating,
        calendarId: id,
      };
      let data: unknown = {};
      try {
        data = await regenerateMutation.mutateAsync(payload);
      } catch (e) {
        log.warn(`Regenerate failed for day ${target.day}`, e, { day: target.day, tweak });
        toast.error(e instanceof Error ? e.message : String(e));
        return;
      }
      if (!data) {
        toast.error("Regenerate failed: no data returned");
        return;
      }
      const regeneratedPost = unwrapPost(data);
      if (!regeneratedPost) {
        toast.error("Regenerate failed: no post returned");
        return;
      }
      const updated = posts.map((p, i) => (i === active ? regeneratedPost : p));
      try {
        await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
      } catch (updErr) {
        log.error(`Failed to save updated post`, updErr, { calendarId: id, day: target.day });
        toast.error(updErr instanceof Error ? updErr.message : "Failed to save updated post");
        return;
      }
      setPosts(updated);
      const tweakLabel = tweak ? ` (${tweak.replace("-", " ")})` : "";
      log.info(`Day ${target.day} regenerated successfully`, { day: target.day, tweak });
      toast.success(`Day ${target.day} regenerated${tweakLabel}`);
    } catch (e) {
      log.error(`Regenerate exception`, e, { day: target.day, tweak });
      toast.error(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegenerating(false);
    }
  }

  async function updatePostTime(day: number, time: string) {
    const next = { ...postTimes, [String(day)]: time };
    setPostTimes(next);
    if (!id) return;
    try {
      await updateCalendarMutation.mutateAsync({ post_times: next as never });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update post time");
    }
  }

  async function updateWeekStart(value: string) {
    setWeekStart(value);
    if (!id) return;
    try {
      await updateCalendarMutation.mutateAsync({ week_start_date: value || null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update week start");
    }
  }

  async function toggleFavorite() {
    if (!id) return;
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await updateCalendarMutation.mutateAsync({ is_favorite: next });
    } catch (error) {
      setIsFavorite(!next);
      toast.error(error instanceof Error ? error.message : "Failed to update favorite");
    }
  }

  async function updateTimezone(tz: string) {
    setTimezone(tz);
    if (!id) return;
    try {
      await updateCalendarMutation.mutateAsync({ timezone: tz || null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update timezone");
    }
  }

  async function updateTrackingUrl(url: string) {
    setTrackingUrl(url);
    if (!id) return;
    try {
      await updateCalendarMutation.mutateAsync({ tracking_url: url || null });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update tracking URL");
    }
  }

  async function persistLockedHashtags(next: Record<string, string[]>) {
    setLockedHashtags(next);
    if (!id) return;
    try {
      await updateCalendarMutation.mutateAsync({ locked_hashtags: next as never });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update hashtag locks");
    }
  }

  async function persistPostHashtags(day: number, newHashtags: string) {
    if (!id) return;
    const updated = posts.map(po => po.day === day ? { ...po, hashtags: newHashtags } : po);
    setPosts(updated);
    try {
      await updateCalendarMutation.mutateAsync({ posts: updated as unknown as never });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update hashtags");
    }
  }

  // Re-render a post's hashtag string by applying workspace policy + this post's locks.
  function rebuildHashtagsForDay(day: number, currentTags: string[], lockedForDay: string[]): string {
    return applyPolicy(currentTags.join(" "), platform, profilePolicy, lockedForDay);
  }

  async function lockTagOnPost(day: number, tag: string) {
    const norm = normalizeTag(tag);
    if (!norm) return;
    const cur = lockedHashtags[String(day)] || [];
    if (cur.includes(norm)) return;
    const nextLocks = { ...lockedHashtags, [String(day)]: [...cur, norm] };
    await persistLockedHashtags(nextLocks);
    toast.success(`#${norm} pinned for Day ${day}`);
  }

  async function unlockTagOnPost(day: number, tag: string) {
    const norm = normalizeTag(tag);
    const cur = lockedHashtags[String(day)] || [];
    if (!cur.includes(norm)) return;
    const nextLocks = { ...lockedHashtags, [String(day)]: cur.filter(t => t !== norm) };
    if (nextLocks[String(day)].length === 0) delete nextLocks[String(day)];
    await persistLockedHashtags(nextLocks);
    toast.success(`#${norm} unpinned`);
  }

  async function banTagWorkspaceWide(day: number, tag: string) {
    const norm = normalizeTag(tag);
    if (!norm) return;
    if (!window.confirm(`Ban #${norm} from EVERY future post across all calendars? You can undo from Profile → Hashtag policy.`)) return;
    // 1) Add to workspace banned list
    const nextBanned = profilePolicy.banned.includes(norm) ? profilePolicy.banned : [...profilePolicy.banned, norm];
    setProfilePolicy({ ...profilePolicy, banned: nextBanned });
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      try {
        await updateProfileMutation.mutateAsync({ banned_hashtags: nextBanned });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update hashtag policy");
      }
    }
    // 2) Strip the tag from this post immediately + unlock it if locked
    const cur = lockedHashtags[String(day)] || [];
    if (cur.includes(norm)) {
      const nextLocks = { ...lockedHashtags, [String(day)]: cur.filter(t => t !== norm) };
      if (nextLocks[String(day)].length === 0) delete nextLocks[String(day)];
      await persistLockedHashtags(nextLocks);
    }
    const post = posts.find(po => po.day === day);
    if (post) {
      const tagsNow = parseHashtagsString(post.hashtags).filter(t => t !== norm);
      const newStr = rebuildHashtagsForDay(day, tagsNow, (lockedHashtags[String(day)] || []).filter(t => t !== norm));
      await persistPostHashtags(day, newStr);
    }
    toast.success(`#${norm} banned workspace-wide ✓`);
    setTagPopover(null);
  }

  async function replaceTagOnPost(day: number, oldTag: string, replacementRaw: string) {
    const oldNorm = normalizeTag(oldTag);
    const newNorm = normalizeTag(replacementRaw);
    if (!oldNorm || !newNorm) return toast.error("Enter a valid replacement tag");
    if (oldNorm === newNorm) return setTagPopover(null);
    const post = posts.find(po => po.day === day);
    if (!post) return;
    const tagsNow = parseHashtagsString(post.hashtags);
    const idx = tagsNow.indexOf(oldNorm);
    if (idx === -1) return;
    tagsNow[idx] = newNorm;
    // Update locks too if old was locked
    const cur = lockedHashtags[String(day)] || [];
    let nextLocks = lockedHashtags;
    if (cur.includes(oldNorm)) {
      nextLocks = { ...lockedHashtags, [String(day)]: cur.map(t => t === oldNorm ? newNorm : t) };
      await persistLockedHashtags(nextLocks);
    }
    const newStr = rebuildHashtagsForDay(day, tagsNow, nextLocks[String(day)] || []);
    await persistPostHashtags(day, newStr);
    toast.success(`#${oldNorm} → #${newNorm}`);
    setTagPopover(null);
    setTagReplacement("");
  }

  function exportIcs() {
    const ws = parseLocalDate(weekStart) || nextMonday();
    const tz = timezone || profileTimezone || browserTimezone();
    downloadIcs({ calendarTitle: title, weekStart: ws, postTimes, platform, timezone: tz }, posts);
  }

  async function handleExport(format: "md" | "pdf" | "ics") {
    if (exportingFormat) return;
    setExportingFormat(format);
    try {
      if (format === "md") {
        downloadMd({ title, industryLabel, platform, coreIdea: formPayload.coreIdea }, posts);
      } else if (format === "pdf") {
        downloadPdf({ title, industryLabel, platform, coreIdea: formPayload.coreIdea }, posts);
      } else {
        const ws = parseLocalDate(weekStart) || nextMonday();
        const tz = timezone || profileTimezone || browserTimezone();
        downloadIcs({ calendarTitle: title, weekStart: ws, postTimes, platform, timezone: tz }, posts);
      }
      toast.success(`Downloaded .${format} ✓`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Download .${format} failed`);
    } finally {
      setExportingFormat(null);
    }
  }

  async function regenerateAllUnlocked() {
    const log = createScopedLogger('CalendarDetail-BulkRegenerate');
    if (!id || regenerating || bulkRegenerating || editing) return;
    const targets = posts.map((p, i) => ({ p, i })).filter(({ p }) => !lockedDays.has(p.day));
    if (targets.length === 0) { toast.error("All posts are pinned. Nothing to regenerate."); return; }
    const ok = window.confirm(`Regenerate ${targets.length} unlocked post${targets.length === 1 ? "" : "s"} for ${niceLabelFor(platform)}? Pinned posts stay untouched.`);
    if (!ok) return;
    setBulkRegenerating(true);
    setBulkProgress({ done: 0, total: targets.length });
    try {
      log.info(`Starting bulk regenerate`, { count: targets.length, platform, calendarId: id });
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const next: Post[] = [...posts];
      let done = 0;
      const failures: { day: number; reason: string }[] = [];

      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      async function runOne({ p: target, i }: { p: Post; i: number }) {
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const payload = {
              industry: formPayload.industry || "", industryLabel,
              platform: platform || formPayload.platform || "LinkedIn",
              coreIdea: formPayload.coreIdea || title, audiences: formPayload.audiences || [],
              voice: formPayload.voice || "", style: formPayload.style || "", goals: formPayload.goals || [],
              format: formPayload.format || "Balanced mix", cta: formPayload.cta || "Share & repost bait",
              length: formPayload.length || "medium", structure: formPayload.structure || "mixed",
              extra: formPayload.extra || "", bannedWords: formPayload.bannedWords || [], requiredWords: formPayload.requiredWords || [],
              post: target, siblings: next,
            };
            const newPost = unwrapPost(await regenerateMutation.mutateAsync(payload));
            if (!newPost) throw new Error("Regenerate failed: no post returned");
            next[i] = newPost;
            return;
          } catch (e) {
            if (attempt < maxAttempts) {
              await sleep(400 * Math.pow(2, attempt - 1));
              continue;
            }
            failures.push({ day: target.day, reason: e instanceof Error ? e.message : String(e) });
            return;
          }
        }
      }

      // Concurrency = 2 worker pool
      const queue = [...targets];
      async function worker() {
        while (queue.length) {
          const job = queue.shift();
          if (!job) return;
          await runOne(job);
          done += 1;
          setBulkProgress({ done, total: targets.length });
          setPosts([...next]);
        }
      }
      await Promise.all([worker(), worker()]);

      try {
        await updateCalendarMutation.mutateAsync({ posts: next as unknown as never });
      } catch (updErr) { toast.error(updErr instanceof Error ? updErr.message : "Failed to save reordered posts"); return; }

      const okCount = targets.length - failures.length;
      if (failures.length === 0) {
        log.info(`Bulk regenerate completed successfully`, { count: okCount, calendarId: id });
        toast.success(`Regenerated ${okCount} post${okCount === 1 ? "" : "s"} ✓`);
      } else if (okCount === 0) {
        log.warn(`All bulk regenerations failed`, new Error(failures[0].reason), { totalCount: targets.length, failureReasons: failures });
        toast.error(`All ${failures.length} regenerations failed. ${failures[0].reason}`);
      } else {
        log.warn(`Partial bulk regenerate failure`, new Error(`${failures.length} of ${targets.length} failed`), { okCount, failureCount: failures.length, failedDays: failures.map(f => f.day) });
        toast.warning(`${okCount} regenerated, ${failures.length} failed (days ${failures.map(f => f.day).join(", ")})`);
      }
    } catch (e) {
      log.error(`Bulk regenerate exception`, e, { calendarId: id });
      toast.error(e instanceof Error ? e.message : "Bulk regenerate failed");
    } finally {
      setBulkRegenerating(false);
      setBulkProgress(null);
    }
  }

  async function scheduleWeek() {
    if (!id || scheduling) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sign in required"); return; }
    setScheduling(true);
    try {
      const ws = parseLocalDate(weekStart) || nextMonday();
      const tz = timezone || profileTimezone || browserTimezone();
      const rows = posts.map(post => {
        const d = dateForDow(ws, post.dow);
        const dateStr = toDateInputValue(d);
        const time = postTimes[String(post.day)] || suggestedTimeForDay(post.day);
        const f = formatForPlatform(post, platform);
        return {
          user_id: user.id,
          calendar_id: id,
          post_day: post.day,
          platform: platform || null,
          scheduled_at: zonedToUtcIso(dateStr, time, tz),
          status: "scheduled",
          workflow_status: "drafted",
          copy_text: f.text,
          post_snapshot: post as unknown as never,
        };
      });
      // Idempotent upsert keyed on (calendar_id, post_day) — preserves existing rows on partial failure
      const { error } = await supabase
        .from("scheduled_posts")
        .upsert(rows as never, { onConflict: "calendar_id,post_day" });
      if (error) { toast.error(error.message); return; }
      const newStatus: typeof statusByDay = {};
      for (const p of posts) newStatus[p.day] = "drafted";
      setStatusByDay(newStatus);
      toast.success(`Scheduled ${rows.length} posts in ${tz} ✓`);
      setScheduleOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule");
    } finally {
      setScheduling(false);
    }
  }

  const weekStartDate = useMemo(() => parseLocalDate(weekStart) || nextMonday(), [weekStart]);

  const p = posts[active] ?? EMPTY_POST;
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

  // K4 — calendar analytics (client-computed, no backend)
  const analytics = useMemo(() => {
    if (!posts.length) return null;
    let totalChars = 0;
    let totalHashtags = 0;
    let withinLimit = 0;
    const formats = new Map<string, number>();
    for (const post of posts) {
      const f = formatForPlatform(post, platform);
      totalChars += f.charCount;
      if (f.charCount <= f.limit) withinLimit += 1;
      const tagCount = String(post.hashtags || "")
        .split(/[\s,]+/).filter(t => t.trim().length > 1).length;
      totalHashtags += tagCount;
      const fmt = (post.format || "—").trim();
      formats.set(fmt, (formats.get(fmt) || 0) + 1);
    }
    const topFormat = [...formats.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      total: posts.length,
      avgChars: Math.round(totalChars / posts.length),
      totalChars,
      avgHashtags: Math.round((totalHashtags / posts.length) * 10) / 10,
      withinPct: Math.round((withinLimit / posts.length) * 100),
      topFormat: topFormat ? `${topFormat[0]} ×${topFormat[1]}` : "—",
      platformLabel: niceLabelFor(platform),
    };
  }, [posts, platform]);

  const sampleMode = false;

  if (loading) return <WorkspacePage size="wide"><div className="cd-inner">Loading…</div></WorkspacePage>;

  return (
    <>
      <style>{css}</style>
      <WorkspacePage size="wide">
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

        <div className="cd-hero">
          <div className="cd-hero-main">
            <div className="cd-hero-kicker">Review workspace</div>
            <div className="cd-hero-title">Polish the week, then ship it.</div>
            <p className="cd-hero-copy">Use the active-day card for edits, keep pinned posts protected, and move to schedule only when the calendar reads clean. The workflow is set up to help you review at a glance, not hunt for controls.</p>
            <div className="cd-hero-chiprow">
              {typeof window !== "undefined" && window.localStorage.getItem(getE2EAuthFlag()) === "true" && (() => {
                const genCount = e2eStore.getLastGeneratedPosts ? e2eStore.getLastGeneratedPosts() : 0;
                const visibleCount = genCount || posts.length;
                return <span className="cd-hero-chip">{visibleCount > 1 ? `${visibleCount}-day calendar` : `1-day calendar`}</span>
              })()}
              <span className="cd-hero-chip">{posts.length} posts</span>
              <span className="cd-hero-chip">{lockedDays.size} pinned</span>
              <span className="cd-hero-chip">{timezone}</span>
              <span className="cd-hero-chip">{editing ? "Editing mode" : "Review mode"}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <PostInsights post={p} platform={platform} topic={p.topic} />
            </div>
          </div>
          <div className="cd-hero-side">
            <div className="cd-hero-card">
              <span>Active day</span>
              <strong>Day {p?.day ?? 0} · {p?.dow ?? "—"}</strong>
              <small>{p ? shortDateLabel(dateForDow(weekStartDate, p.dow)) : "No active post"}</small>
            </div>
            <div className="cd-hero-card">
              <span>Workflow</span>
              <strong>{sampleMode ? "Sample calendar" : "Live calendar"}</strong>
              <small>{posts.length > 1 ? "Use the strip to jump between days" : "Single post review"}</small>
            </div>
          </div>
        </div>

        {analytics && (
          <div className="cd-stats" aria-label="Calendar analytics">
            <div className="cd-stat">
              <span className="cd-stat-label">Posts</span>
              <span className="cd-stat-val">{analytics.total}</span>
              <span className="cd-stat-sub">this week</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat-label">Avg length</span>
              <span className="cd-stat-val">{analytics.avgChars.toLocaleString()}</span>
              <span className="cd-stat-sub">chars / post</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat-label">Avg hashtags</span>
              <span className="cd-stat-val">{analytics.avgHashtags}</span>
              <span className="cd-stat-sub">per post</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat-label">Within limit</span>
              <span className="cd-stat-val">
                <em>{analytics.withinPct}%</em>
              </span>
              <span className="cd-stat-sub">on {analytics.platformLabel}</span>
            </div>
            <div className="cd-stat">
              <span className="cd-stat-label">Top format</span>
              <span className="cd-stat-val" style={{ fontSize: 14, lineHeight: 1.4 }}>{analytics.topFormat}</span>
              <span className="cd-stat-sub">most-used</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
            <span style={{ fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: "#7a7a8e" }}>Week starting</span>
            <input
              type="date"
              aria-label="Week start date"
              value={weekStart}
              onChange={e => updateWeekStart(e.target.value)}
              style={{ background: "#07080d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#edeae3", fontFamily: "Sora, sans-serif", outline: "none", colorScheme: "dark" }}
            />
            <span style={{ fontSize: 11, color: "#7a7a8e" }}>Day 1 = {shortDateLabel(weekStartDate)}</span>
          </div>

        <div className="cd-tz-bar">
            <span className="cd-reformat-label">Timezone</span>
            <select
              className="cd-tz-sel"
              aria-label="Calendar timezone"
              value={timezone}
              onChange={e => updateTimezone(e.target.value)}
              style={{ maxWidth: 240 }}
              title={`Workspace default: ${profileTimezone || browserTimezone()}`}
            >
              {tzList.map(tz => <option key={tz} value={tz}>{tzLabel(tz)}</option>)}
            </select>
            <span className="cd-reformat-label" style={{ marginLeft: 4 }}>Tracking URL</span>
            <input
              className="cd-tz-input"
              type="url"
              placeholder="https://yoursite.com/launch"
              value={trackingUrl}
              onChange={e => setTrackingUrl(e.target.value)}
              onBlur={e => updateTrackingUrl(e.target.value.trim())}
            />
          </div>

        <div className="cd-reformat-bar">
            <span className="cd-reformat-label">Reformat for</span>
            <select
              className="cd-reformat-sel"
              aria-label="Reformat platform"
              value={reformatTarget}
              onChange={(e) => setReformatTarget(e.target.value)}
              disabled={reformatting || regenerating}
            >
              <option value="" disabled>Choose platform…</option>
              {(["LinkedIn","Twitter/X","Instagram","Facebook","Newsletter","Blog"] as const)
                .filter(p => p !== platform)
                .map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button
              type="button"
              className="cd-reformat-btn"
              disabled={!reformatTarget || reformatting || regenerating}
              onClick={() => setPendingReformatTarget(reformatTarget)}
              title="Re-runs all 7; saved as a new calendar"
            >
              {reformatting ? "Reformatting all 7…" : "Reformat all 7 →"}
            </button>
          </div>

        {posts.length > 1 && (
          <div className="cd-strip" role="tablist" aria-label="Days of the week">
            {posts.map((post, i) => {
              const st = statusByDay[post.day];
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  disabled={editing}
                  className={`cd-tab ${i === active ? "on" : ""} ${lockedDays.has(post.day) ? "locked" : ""}`}
                  onClick={() => { if (!editing) setActive(i); }}
                  title={st ? `Status: ${st}` : "Not scheduled"}
                >
                  {st && <span className={`cd-tab-status ${st}`} aria-hidden="true" style={{ background: st === "published" ? "#c8f09a" : st === "approved" ? "#9ab5f0" : st === "failed" ? "#f09a9a" : "#9a9aae" }} />}
                  <div className="cd-tab-dow">{post.dow}</div>
                  <div className="cd-tab-n">{i + 1}</div>
                  <div className="cd-tab-date">{shortDateLabel(dateForDow(weekStartDate, post.dow)).split(" · ")[1]}</div>
                </button>
              );
            })}
          </div>
        )}

        <div className="cd-export-row" aria-label="Export options">
            <button type="button" className="cd-export-btn" disabled={!!exportingFormat} onClick={() => handleExport("md")}>
              {exportingFormat === "md" ? "↓ .md…" : "↓ .md"}
            </button>
            <button type="button" className="cd-export-btn" disabled={!!exportingFormat} onClick={() => handleExport("pdf")}>
              {exportingFormat === "pdf" ? "↓ .pdf…" : "↓ .pdf"}
            </button>
            <button type="button" className="cd-export-btn" disabled={!!exportingFormat} onClick={() => handleExport("ics")} title="Export to Google Calendar / Outlook / Apple Cal">
              {exportingFormat === "ics" ? "📅 .ics…" : "📅 .ics"}
            </button>
          </div>

        <div className="cd-bulk-bar">
            {posts.length > 1 ? (
              <>
                <span className="cd-bulk-label">
                  Bulk actions · {posts.length - lockedDays.size} unlocked / {lockedDays.size} pinned
                </span>
                <button
                  type="button"
                  className="cd-bulk-btn"
                  onClick={regenerateAllUnlocked}
                  disabled={bulkRegenerating || regenerating || reformatting || editing}
                  title="Re-rolls every unpinned post with the same constraints"
                >
                  {bulkRegenerating
                    ? `↻ Regenerating ${bulkProgress?.done ?? 0}/${bulkProgress?.total ?? 0}…`
                    : `↻ Regenerate all unlocked`}
                </button>
                <button
                  type="button"
                  className="cd-bulk-btn primary"
                  onClick={() => setScheduleOpen(true)}
                  disabled={bulkRegenerating || regenerating || editing}
                  title="Queue all posts at the times shown"
                >
                  📅 Schedule week →
                </button>
              </>
            ) : (
              <>
                <span className="cd-bulk-label">Single-day post</span>
                <button
                  type="button"
                  className="cd-bulk-btn primary"
                  onClick={() => setScheduleOpen(true)}
                  disabled={bulkRegenerating || regenerating || editing}
                  title="Schedule this post"
                >
                  📅 Schedule this post →
                </button>
              </>
            )}
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
                  aria-label={`Post time for day ${p.day}`}
                  value={postTimes[String(p.day)] || suggestedTimeForDay(p.day)}
                  onChange={e => updatePostTime(p.day, e.target.value)}
                />
              </div>
              <div className="cd-ptitle" style={{ marginTop: 14 }}>{p.title}</div>
              <div className="cd-blabel"><span>Hook</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div className="cd-hook" style={{ flex: 1 }}>{p.hook}</div>
                {p.hook_options && p.hook_options.length > 1 && (
                  <select
                    className="cd-reformat-sel"
                    value={p.hook}
                    onChange={e => selectHookVariant(p.day, e.target.value)}
                    aria-label={`Choose hook variant for day ${p.day}`}
                  >
                    {p.hook_options.map((h, i) => (
                      <option key={i} value={h}>{h.length > 60 ? `${h.slice(0, 60)}…` : h}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="cd-blabel"><span>Post body</span></div>
              <div className="cd-body">{stripMarkdown(p.body)}</div>
              <div className="cd-blabel"><span>CTA</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="cd-cta" style={{ flex: 1 }}>{p.cta}</div>
                {p.cta_options && p.cta_options.length > 1 && (
                  <select
                    className="cd-reformat-sel"
                    value={p.cta}
                    onChange={e => selectCtaVariant(p.day, e.target.value)}
                    aria-label={`Choose CTA variant for day ${p.day}`}
                  >
                    {p.cta_options.map((c, i) => (
                      <option key={i} value={c}>{c.length > 60 ? `${c.slice(0, 60)}…` : c}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="cd-blabel"><span>Hashtags</span><span className="cd-blabel-count">click a tag to lock, ban, or replace</span></div>
              <div className="cd-tags-row">
                {(() => {
                  const tags = parseHashtagsString(p.hashtags);
                  const locks = lockedHashtags[String(p.day)] || [];
                  if (tags.length === 0) return <span className="cd-tags" style={{ color: "#3a3a50" }}>— none —</span>;
                  return tags.map(t => {
                    const isLocked = locks.includes(t);
                    const overridesBan = isLocked && profilePolicy.banned.includes(t);
                    const open = tagPopover && tagPopover.day === p.day && tagPopover.tag === t;
                    return (
                      <span key={t} className="cd-tag-wrap">
                        <button
                          type="button"
                          className={`cd-tag-chip ${isLocked ? "locked" : ""}`}
                          onClick={() => { setTagPopover(open ? null : { day: p.day, tag: t }); setTagReplacement(""); }}
                          title={isLocked ? "Pinned — survives regenerates" : "Click for actions"}
                        >
                          {isLocked ? "📌 " : ""}{displayTag(t)}
                        </button>
                        {overridesBan && (
                          <span className="cd-tag-policy-warn" title="Locked tag overrides the workspace ban list">
                            overrides ban
                          </span>
                        )}
                        {open && (
                          <div className="cd-tag-pop" style={{ top: "calc(100% + 4px)", left: 0 }}>
                            <div className="cd-tag-pop-h">{displayTag(t)}</div>
                            {isLocked ? (
                              <button className="cd-tag-pop-btn" onClick={() => unlockTagOnPost(p.day, t)}>📍 Unpin</button>
                            ) : (
                              <button className="cd-tag-pop-btn" onClick={() => lockTagOnPost(p.day, t)}>📌 Lock on this post</button>
                            )}
                            <button className="cd-tag-pop-btn danger" onClick={() => banTagWorkspaceWide(p.day, t)}>✕ Ban workspace-wide</button>
                            <div className="cd-tag-pop-row">
                              <input
                                className="cd-tag-pop-input"
                                placeholder="replace with…"
                                value={tagReplacement}
                                onChange={e => setTagReplacement(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && replaceTagOnPost(p.day, t, tagReplacement)}
                                autoFocus
                              />
                              <button className="cd-tag-pop-btn" style={{ flex: "0 0 auto" }} onClick={() => replaceTagOnPost(p.day, t, tagReplacement)}>↻</button>
                            </div>
                            <button className="cd-tag-pop-btn" onClick={() => setTagPopover(null)} style={{ borderColor: "transparent", color: "#5a5a72" }}>Close</button>
                          </div>
                        )}
                      </span>
                    );
                  });
                })()}
              </div>
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
                        {f.charCount.toLocaleString()} / {f.limit.toLocaleString()} ({Math.round(ratio * 100)}%)
                      </span>
                      {(() => {
                        const ins = insightFor(p, platform);
                        const tagCls = ins.hashtagState === "sweet" ? "good" : ins.hashtagState === "na" ? "" : ins.hashtagState === "dense" ? "bad" : "warn";
                        const healthCls = ins.health === "good" ? "good" : ins.health === "warn" ? "warn" : "bad";
                        const healthLabel = ins.health === "good" ? "✓ ready" : ins.health === "warn" ? "⚠ review" : "✕ fix";
                        return (
                          <>
                            <span className={`cd-chip ${tagCls}`} title={`Hashtag density for ${niceLabel}`}>
                              # {ins.hashtagLabel}
                            </span>
                            <span className={`cd-chip ${healthCls}`} title="Overall health (length + hashtags)">
                              {healthLabel}
                            </span>
                          </>
                        );
                      })()}
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
                <button
                  className="cd-btn"
                  onClick={() => setFeedbackOpen(true)}
                  disabled={regenerating}
                  title="Regenerate and send feedback"
                >
                  📝 Regenerate + feedback
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
                      {(() => {
                        const t = posts[active];
                        const hasE = t ? hasEmoji((t.title || "") + " " + (t.hook || "") + " " + (t.body || "") + " " + (t.cta || "")) : false;
                        return (
                          <button
                            className="cd-tweak-opt"
                            onClick={() => regenerateDay("remove-emoji")}
                            disabled={!hasE}
                            title={!hasE ? "No emoji detected" : "Remove emojis from this post"}
                          >
                            Remove emoji
                          </button>
                        );
                      })()}
                      <button className="cd-tweak-opt" onClick={() => regenerateDay("clean-formatting")}>Clean formatting symbols</button>
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
      </WorkspacePage>
      {scheduleOpen && (
        <div className="cd-modal-bg" onClick={() => !scheduling && setScheduleOpen(false)}>
          <div className="cd-modal" onClick={e => e.stopPropagation()} tabIndex={0} role="dialog" aria-modal="true" aria-label="Schedule this week dialog">
            <h3>Schedule this week</h3>
            <p>
              Queues all 7 posts to your schedule using the times below. Existing scheduled
              entries for this calendar will be replaced. Adjust times in the per-day cards if needed.
            </p>
            {posts.map(post => {
              const d = dateForDow(weekStartDate, post.dow);
              return (
                <div key={post.day} className="cd-modal-row">
                  <span className="cd-modal-day">{shortDateLabel(d)}</span>
                  <input
                    type="time"
                    className="cd-modal-time"
                    aria-label={`Schedule time for day ${post.day}`}
                    value={postTimes[String(post.day)] || suggestedTimeForDay(post.day)}
                    onChange={e => updatePostTime(post.day, e.target.value)}
                  />
                  <span style={{ fontSize: 11, color: "#7a7a8e", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {post.title}
                  </span>
                </div>
              );
            })}
            <div className="cd-modal-actions">
              <button className="cd-bulk-btn" onClick={() => setScheduleOpen(false)} disabled={scheduling}>Cancel</button>
              <button className="cd-bulk-btn primary" onClick={scheduleWeek} disabled={scheduling}>
                {scheduling ? "Scheduling…" : `Schedule ${posts.length} posts`}
              </button>
            </div>
          </div>
        </div>
      )}
      {feedbackOpen && (
        <FeedbackModal
          open={feedbackOpen}
          submitting={feedbackSubmitting || regenerating}
          onClose={() => { if (!feedbackSubmitting && !regenerating) setFeedbackOpen(false); }}
          onSubmit={async ({ feedback, category, rating }) => {
            try {
              setFeedbackSubmitting(true);
              await regenerateDay(undefined, feedback, category, rating);
              setFeedbackOpen(false);
            } finally {
              setFeedbackSubmitting(false);
            }
          }}
        />
      )}
      {pendingReformatTarget && (
        <ConfirmDialog
          title="Reformat all 7 posts?"
          message={`This will create a new calendar reformatted for ${niceLabelFor(pendingReformatTarget)} and leave the current one untouched.`}
          onCancel={() => setPendingReformatTarget(null)}
          onConfirm={async () => { setPendingReformatTarget(null); await reformatAllForPlatform(pendingReformatTarget); }}
        />
      )}
    </>
  );
}
