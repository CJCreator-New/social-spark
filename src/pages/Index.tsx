import { Suspense, useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getE2EAuthFlag, E2E_USER_ID, E2E_CALENDAR } from "@/lib/e2eFixtures";
import e2eStore from "@/lib/e2eStore";
import { toast } from "sonner";
import storageService from "@/lib/storageService";
import { createScopedLogger } from "@/lib/logger";
import { getUserFriendlyMessage } from "@/lib/errors";
import { downloadMd, downloadPdf } from "@/lib/exportCalendar";
import telemetry from "@/lib/telemetry";
import { downloadIcs, nextMonday, toDateInputValue, parseLocalDate, dateForDow, shortDateLabel } from "@/lib/calendarSchedule";
import { formatForPlatform, writeToClipboard, PLATFORM_LIMITS, resolvePlatform, niceLabelFor, buildRawMarkdown, stripMarkdown } from "@/lib/platformCopy";
import { suggestedTimeForDay } from "@/lib/postingTimes";
import { getVoiceStylePreview } from "@/lib/voiceStylePreview";
import { generateLocalPosts } from "@/lib/localPostGenerator";
import { DraftRecoveryDialog } from "@/components/DraftRecoveryDialog";
import { BatchEditModal, type BatchEditPayload } from "@/components/BatchEditModal";
import { PerformanceScoreCard } from "@/components/PerformanceScoreCard";
import PostInsights from "@/components/PostInsights";
import { DiffView } from "@/components/DiffView";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { ToneConsistencyChecker } from "@/components/ToneConsistencyChecker";
import { InspirationBank } from "@/components/InspirationBank";
import GenerateSkeleton from "@/components/GenerateSkeleton";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useCreateCalendarMutation, useRegeneratePostMutation } from "@/hooks/useAppQueries";
import { swapItems, handleDragStart, handleDragOver, handleDrop } from "@/lib/dragDrop";
import { SAMPLE_FORM, SAMPLE_POSTS, SAMPLE_POST_TIMES } from "@/lib/sampleCalendar";
import mediaManager from "@/lib/mediaManager";
import { WorkspacePage } from "@/components/layout/WorkspacePage";
import type { Database, Json } from "@/integrations/supabase/types";
import { FontStyle, applyStyle } from "@/lib/unicodeFonts";

function hasEmoji(text: string): boolean {
  return /\p{Emoji}/u.test(text);
}

function formatBadgeForPlatform(format: string, platform: string): string {
  if (resolvePlatform(platform) !== "twitter") return format;
  return /list|bullet|thread/i.test(format) ? "THREAD FORMAT" : "SINGLE TWEET";
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(v => String(v).trim()).filter(Boolean)));
}

function unwrapPost(value: unknown): Post | null {
  if (!value || typeof value !== "object") return null;
  const candidate = "post" in value ? (value as { post?: unknown }).post : value;
  if (!candidate || typeof candidate !== "object") return null;

  // Some older responses nest the actual post more than once, or return { posts: [...] }.
  const nestedCandidate = "post" in candidate
    ? (candidate as { post?: unknown }).post
    : "posts" in candidate && Array.isArray((candidate as { posts?: unknown[] }).posts)
      ? (candidate as { posts?: unknown[] }).posts?.[0]
      : candidate;

  if (!nestedCandidate || typeof nestedCandidate !== "object") return null;
  const post = nestedCandidate as Partial<Post>;
  return typeof post.day === "number" && typeof post.dow === "string"
    ? { ...EMPTY_POST, ...post }
    : null;
}

function unwrapPosts(value: unknown): Post[] {
  if (!value || typeof value !== "object") return [];
  const candidate = value as Record<string, unknown>;

  if (Array.isArray(candidate.posts)) {
    return candidate.posts.map(unwrapPost).filter((p): p is Post => !!p);
  }

  const post = unwrapPost(value);
  return post ? [post] : [];
}

// ─── DATA ────────────────────────────────────────────────────────────────────

const INDUSTRIES = [
  { id: "tech", label: "Tech & Software", icon: "⌨" },
  { id: "health", label: "Health & Wellness", icon: "◎" },
  { id: "finance", label: "Finance & Fintech", icon: "◈" },
  { id: "education", label: "Education & EdTech", icon: "◉" },
  { id: "ecommerce", label: "E-commerce & Retail", icon: "◫" },
  { id: "marketing", label: "Marketing & Growth", icon: "◬" },
  { id: "startup", label: "Startups & VC", icon: "◭" },
  { id: "legal", label: "Legal & Compliance", icon: "◪" },
  { id: "hr", label: "HR & Future of Work", icon: "◯" },
  { id: "sustainability", label: "Sustainability", icon: "◌" },
  { id: "creator", label: "Creator Economy", icon: "◍" },
  { id: "other", label: "Other / Custom", icon: "◻" },
];

const INDUSTRY_TOPICS: Record<string, string[]> = {
  tech: ["AI & machine learning", "Developer tools", "Cloud architecture", "Cybersecurity", "Open source", "Product management", "API design", "No-code / low-code", "DevOps & SRE", "Tech careers"],
  health: ["Mental wellness", "Nutrition & diet", "Fitness & movement", "Sleep science", "Preventive care", "Digital health", "Women's health", "Gut health", "Longevity", "Healthcare policy"],
  finance: ["Personal finance", "Investing basics", "Crypto & Web3", "Fintech products", "Tax strategy", "Wealth building", "Banking innovation", "Financial literacy", "Market trends", "Startup funding"],
  education: ["Online learning", "EdTech tools", "Skill development", "Career transitions", "Parenting & kids", "Higher education", "Corporate training", "Micro-credentials", "Study strategies", "Accessibility in learning"],
  ecommerce: ["DTC brand building", "Shopify & platforms", "Customer retention", "Supply chain", "Influencer commerce", "Product launches", "Returns & logistics", "Marketplaces", "Consumer trends", "Pricing strategy"],
  marketing: ["Content strategy", "SEO & search", "Paid ads", "Email marketing", "Brand storytelling", "Social media growth", "Community building", "Analytics & data", "Copywriting", "Influencer marketing"],
  startup: ["Fundraising & VC", "Founder mindset", "Product-market fit", "Go-to-market", "Team building", "SaaS metrics", "Startup operations", "Pivoting & failure", "Angel investing", "Startup stories"],
  legal: ["Contract basics", "IP & trademarks", "Startup law", "Regulatory trends", "Privacy & GDPR", "Employment law", "Legaltech", "Compliance tips", "Terms & policies", "Consumer rights"],
  hr: ["Remote work culture", "Hiring & recruiting", "Employee retention", "DEI & inclusion", "Performance management", "Workplace wellbeing", "Future of work", "Compensation strategy", "Team dynamics", "Leadership development"],
  sustainability: ["ESG investing", "Climate tech", "Circular economy", "Carbon footprinting", "Sustainable supply chains", "Green energy", "Impact measurement", "Corporate sustainability", "Consumer behaviour", "Net zero"],
  creator: ["Monetisation strategies", "Audience building", "Newsletter growth", "YouTube & video", "Short-form content", "Brand deals", "Creator tools", "Community & memberships", "Personal branding", "Creator burnout"],
  other: ["Industry trends & predictions", "Behind-the-scenes story", "Lessons learned (mistakes)", "Quick how-to / framework", "Hot take / contrarian view"],
};

const PLATFORM_OPTIONS = [
  { id: "LinkedIn", label: "LinkedIn", hint: "Professional long-form" },
  { id: "Twitter/X", label: "Twitter / X", hint: "Short punchy threads" },
  { id: "Instagram", label: "Instagram", hint: "Visual + caption" },
  { id: "Facebook", label: "Facebook", hint: "Community & stories" },
  { id: "Newsletter", label: "Newsletter", hint: "Email-first content" },
  { id: "Blog", label: "Blog / SEO", hint: "Long-form articles" },
];

const AUDIENCE_PRESETS: Record<string, string[]> = {
  tech: ["Developers & engineers", "Product managers", "CTOs & tech leads", "Tech founders", "Non-technical stakeholders", "Design professionals", "Data scientists", "DevRel professionals"],
  health: ["Fitness enthusiasts", "Healthcare professionals", "Wellness coaches", "Patients & caregivers", "Nutritionists", "Health founders", "General public", "Corporate wellness teams"],
  finance: ["Individual investors", "Finance professionals", "Startup founders", "Millennials & Gen Z", "CFOs & finance leads", "Small business owners", "Fintech builders", "Aspiring investors"],
  education: ["Students", "Teachers & educators", "Parents", "EdTech founders", "Corporate L&D teams", "Career switchers", "Lifelong learners", "School administrators"],
  ecommerce: ["DTC founders", "E-commerce managers", "Shopify merchants", "Consumer brands", "Retail buyers", "Marketing teams", "Supply chain professionals", "Investors"],
  marketing: ["Marketing managers", "Growth hackers", "Founders & CMOs", "Content creators", "Agency professionals", "Brand strategists", "Social media managers", "SEO professionals"],
  startup: ["Startup founders", "Angel investors", "VCs & fund managers", "Product leaders", "First-time entrepreneurs", "Startup employees", "Accelerator participants", "Tech journalists"],
  legal: ["Lawyers & attorneys", "Startup founders", "Compliance officers", "HR professionals", "Business owners", "Law students", "General public", "Policy makers"],
  hr: ["HR professionals", "Team managers", "C-suite leaders", "Remote workers", "Job seekers", "Recruiters", "Employees", "People ops teams"],
  sustainability: ["Impact investors", "CSR professionals", "Climate tech founders", "Policy makers", "Conscious consumers", "ESG analysts", "Sustainability managers", "Students & researchers"],
  creator: ["Content creators", "Aspiring creators", "Brand managers", "Newsletter writers", "YouTubers", "Coaches & consultants", "Freelancers", "Creator economy investors"],
  other: ["General professionals", "Industry peers", "Decision makers", "Beginners", "Enthusiasts", "Students", "Leaders", "Practitioners"],
};

const VOICE_OPTIONS = ["Technical & analytical", "Conversational & warm", "PM / product thinking", "Opinionated & bold", "Data-driven", "Storytelling-first", "Educational & clear", "Contrarian / challenger", "Founder POV", "Academic & research-backed", "Humorous & witty", "Inspirational & motivating"];
const STYLE_OPTIONS = ["Short punchy lines", "Long-form narrative", "Lists & frameworks", "Thread-style breakdown", "Stats-led", "Case study format", "Question-led", "First-person story", "Industry insight", "Myth-busting", "How-to guide", "Behind-the-scenes"];
const FORMAT_OPTIONS = ["Balanced mix", "Storytelling-led", "Data & insights", "How-it-works", "Opinion / POV", "List posts", "Interviews & Q&A", "Case studies"];
const CTA_OPTIONS = ["Share & repost bait", "Spark comments & debate", "Drive to profile / newsletter", "Collect leads", "Build community", "No hard CTA"];
const COPY_STYLE_OPTIONS = ["None", "Bold serif", "Italic", "Bold italic", "Monospace", "Sans-serif bold"];
const COPY_STYLE_MAP: Record<string, FontStyle> = {
  None: FontStyle.None,
  "Bold serif": FontStyle.BoldSerif,
  Italic: FontStyle.Italic,
  "Bold italic": FontStyle.BoldItalic,
  Monospace: FontStyle.Monospace,
  "Sans-serif bold": FontStyle.SansSerifBold,
};
const GOAL_OPTIONS = ["Awareness", "Engagement", "Drive traffic", "Lead generation", "Thought leadership", "Community building", "Sales & conversion"];

const LENGTH_OPTIONS = [
  { id: "short", label: "Short", hint: "80–120 words" },
  { id: "medium", label: "Medium", hint: "160–230 words" },
  { id: "long", label: "Long", hint: "280–380 words" },
  { id: "mixed", label: "Mixed lengths", hint: "Vary across the week" },
];

const STRUCTURE_OPTIONS = [
  { id: "paragraphs", label: "Paragraphs only", hint: "Flowing prose" },
  { id: "bullets", label: "Bullet points only", hint: "Scannable lists" },
  { id: "mixed", label: "Mix of both", hint: "Paragraphs + bullets" },
  { id: "perPost", label: "Per-post best fit", hint: "AI picks per topic" },
];

// ─── CSS ─────────────────────────────────────────────────────────────────────

const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=Sora:wght@300;400;500;600&display=swap');

.cf-app *, .cf-app *::before, .cf-app *::after { box-sizing: border-box; }
.cf-app {
  --bg: #07080d; --surface: #0d0f18; --surface2: #12141e; --surface3: #181a26;
  --border: rgba(255,255,255,0.055); --border2: rgba(255,255,255,0.1); --border3: rgba(255,255,255,0.15);
  --accent: #c8f09a; --adim: rgba(200,240,154,0.12); --adim2: rgba(200,240,154,0.06);
  --text: #edeae3; --text2: #7a7a8e; --text3: #3a3a50;
  --err: #f09a9a; --err-bg: rgba(240,154,154,0.07);
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px;
  color: var(--text);
  position: relative; overflow-x: hidden;
  font-family: 'Sora', sans-serif; -webkit-font-smoothing: antialiased;
}

.cf-app .bg-grid { position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(200,240,154,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(200,240,154,0.018) 1px,transparent 1px);
  background-size:52px 52px; }
.cf-app .bg-glow { position:fixed;width:700px;height:700px;border-radius:50%;
  background:radial-gradient(circle,rgba(200,240,154,0.035) 0%,transparent 65%);
  pointer-events:none;top:-300px;left:50%;transform:translateX(-50%);z-index:0; }

.cf-app .inner { position:relative;z-index:1;width:100%; }

.cf-app .brand { margin-bottom:52px; }
.cf-app .brand-eyebrow { font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);font-weight:500;margin-bottom:12px;display:flex;align-items:center;gap:8px; }
.cf-app .brand-eyebrow::before { content:'';display:block;width:22px;height:1px;background:var(--accent); }
.cf-app .brand-title { font-family:'Playfair Display',serif;font-size:38px;font-weight:400;color:var(--text);letter-spacing:-.5px;line-height:1.08;margin:0; }
.cf-app .brand-title em { font-style:italic;color:var(--accent); }
.cf-app .brand-sub { font-size:13px;color:var(--text2);margin-top:10px;font-weight:300;line-height:1.65;max-width:480px; }

.cf-app .hero-shell { display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:16px;align-items:stretch;margin:22px 0 28px; }
.cf-app .hero-panel { background:linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01)); border:1px solid var(--border); border-radius:24px; padding:22px; box-shadow:0 20px 60px rgba(0,0,0,.22); }
.cf-app .hero-panel.alt { background:linear-gradient(180deg,rgba(200,240,154,0.06),rgba(255,255,255,0.01)); }
.cf-app .hero-kicker { font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--accent);font-weight:500;margin-bottom:12px; }
.cf-app .hero-title { font-family:'Playfair Display',serif;font-size:34px;font-weight:400;letter-spacing:-.5px;line-height:1.06;margin:0 0 12px;max-width:14ch; }
.cf-app .hero-copy { font-size:13px;color:var(--text2);line-height:1.75;max-width:52ch;margin:0 0 18px; }
.cf-app .hero-badges { display:flex;flex-wrap:wrap;gap:8px; }
.cf-app .hero-badge { display:inline-flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;border:1px solid var(--border2);background:rgba(255,255,255,0.015);font-size:11px;color:var(--text2);font-weight:300; }
.cf-app .hero-badge strong { color:var(--text);font-weight:500; }
.cf-app .hero-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px; }
.cf-app .hero-stat { border:1px solid var(--border);border-radius:16px;padding:14px 15px;background:rgba(7,8,13,.55);min-height:88px;display:flex;flex-direction:column;justify-content:space-between; }
.cf-app .hero-stat span { font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--text3);font-weight:500; }
.cf-app .hero-stat strong { font-family:'Playfair Display',serif;font-size:24px;font-weight:400;color:var(--text);line-height:1.1; }
.cf-app .hero-note { margin-top:12px;padding:12px 14px;border-radius:14px;background:rgba(200,240,154,.06);border:1px solid rgba(200,240,154,.16);font-size:12px;color:rgba(237,234,227,.88);line-height:1.6; }
.cf-app .hero-note strong { color:var(--accent);font-weight:500; }
.cf-app .hero-linkrow { margin-top:14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center; }
.cf-app .hero-link { color:var(--accent);text-decoration:none;font-size:12px;letter-spacing:.04em; }
.cf-app .hero-link:hover { text-decoration:underline; }

.cf-app .stepper { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:36px; }
.cf-app .snode { display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--border);border-radius:16px;background:var(--surface);min-width:0; }
.cf-app .sdot { width:28px;height:28px;border-radius:50%;border:1px solid var(--border2);background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3);font-weight:600;transition:all .25s;flex-shrink:0; }
.cf-app .sdot.done { background:var(--adim);border-color:rgba(200,240,154,.5);color:var(--accent); }
.cf-app .sdot.active { background:var(--accent);border-color:var(--accent);color:#07080d; }
.cf-app .slabel { font-size:12px;color:var(--text3);letter-spacing:.03em;font-weight:400;transition:color .25s;white-space:normal;line-height:1.2; }
.cf-app .slabel.active { color:var(--text2); } .cf-app .slabel.done { color:rgba(200,240,154,.6); }
.cf-app .sline { display:none; }
.cf-app .sline.done { background:rgba(200,240,154,.25); }

.cf-app .screen { display:none; }
.cf-app .screen.active { display:block;animation:cfFadeUp .3s ease; }
@keyframes cfFadeUp { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }

.cf-app .card { background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:26px;margin-bottom:14px; }
.cf-app .csect { margin-bottom:26px; } .cf-app .csect:last-child { margin-bottom:0; }
.cf-app .divider { height:1px;background:var(--border);margin:22px 0; }

.cf-app .flabel { font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--text2);margin-bottom:9px;font-weight:500;display:flex;align-items:center;gap:6px; }
.cf-app .fhint { font-size:11px;color:var(--text3);letter-spacing:0;text-transform:none;font-weight:300; }

.cf-app textarea, .cf-app .ti {
  width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:var(--r-sm);
  padding:11px 13px;font-size:13px;color:var(--text);font-family:'Sora',sans-serif;font-weight:300;
  line-height:1.7;transition:border-color .2s,box-shadow .2s;resize:vertical;outline:none;display:block;
}
.cf-app textarea:focus,.cf-app .ti:focus { border-color:rgba(200,240,154,.28);box-shadow:0 0 0 3px rgba(200,240,154,.04); }
.cf-app textarea::placeholder,.cf-app .ti::placeholder { color:var(--text3); }

.cf-app .g2 { display:grid;grid-template-columns:1fr 1fr;gap:13px; }

.cf-app .chips { display:flex;flex-wrap:wrap;gap:6px; }
.cf-app .chip { padding:5px 13px;border-radius:99px;border:1px solid var(--border2);font-size:12px;color:var(--text2);cursor:pointer;background:transparent;font-family:'Sora',sans-serif;transition:all .15s;font-weight:300; }
.cf-app .chip:hover { border-color:rgba(200,240,154,.2);color:var(--text); }
.cf-app .chip.on { background:var(--adim);border-color:rgba(200,240,154,.38);color:var(--accent);font-weight:400; }

.cf-app .ind-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:8px; }
.cf-app .ind-card { border:1px solid var(--border);border-radius:var(--r-md);padding:14px 10px;cursor:pointer;text-align:center;background:var(--bg);transition:all .15s;font-family:'Sora',sans-serif;color:inherit; }
.cf-app .ind-card:hover { border-color:var(--border2);background:var(--surface2); }
.cf-app .ind-card.on { border-color:rgba(200,240,154,.35);background:var(--adim); }
.cf-app .ind-card:focus-visible { outline:2px solid rgba(200,240,154,.7);outline-offset:2px; }
.cf-app .ind-icon { font-size:20px;margin-bottom:6px;line-height:1; }
.cf-app .ind-label { font-size:11px;color:var(--text2);font-weight:400;line-height:1.3; }
.cf-app .ind-card.on .ind-label { color:var(--accent); }

.cf-app .plat-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:8px; }
.cf-app .plat-card { border:1px solid var(--border);border-radius:var(--r-md);padding:12px 10px;cursor:pointer;background:var(--bg);transition:all .15s;font-family:'Sora',sans-serif;color:inherit;text-align:left; }
.cf-app .plat-card:hover { border-color:var(--border2); }
.cf-app .plat-card.on { border-color:rgba(200,240,154,.38);background:var(--adim); }
.cf-app .plat-card:focus-visible { outline:2px solid rgba(200,240,154,.7);outline-offset:2px; }
.cf-app .plat-name { font-size:13px;font-weight:500;color:var(--text2);margin-bottom:3px; }
.cf-app .plat-hint { font-size:11px;color:var(--text3);font-weight:300; }
.cf-app .plat-card.on .plat-name { color:var(--accent); }
.cf-app .plat-card.on .plat-hint { color:rgba(200,240,154,.5); }

.cf-app .swrap { position:relative; }
.cf-app .sel { width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:var(--r-sm);padding:11px 38px 11px 13px;font-size:13px;color:var(--text);font-family:'Sora',sans-serif;font-weight:300;appearance:none;cursor:pointer;outline:none;transition:border-color .2s; }
.cf-app .sel:focus { border-color:rgba(200,240,154,.28); }
.cf-app .sarrow { position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--text3);display:flex; }

.cf-app .mswrap { position:relative; }
.cf-app .msbox { width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:var(--r-sm);padding:9px 36px 9px 12px;font-size:13px;color:var(--text);font-family:'Sora',sans-serif;font-weight:300;cursor:pointer;transition:border-color .2s;min-height:42px;display:flex;align-items:center;flex-wrap:wrap;gap:5px;position:relative; }
.cf-app .msbox.open { border-color:rgba(200,240,154,.28); }
.cf-app .ms-ph { color:var(--text3);font-size:13px;font-weight:300; }
.cf-app .ms-tag { background:var(--adim);border:1px solid rgba(200,240,154,.22);color:var(--accent);border-radius:5px;padding:2px 7px;font-size:11px;font-weight:400;display:inline-flex;align-items:center;gap:4px;min-width:0;max-width:100%; }
.cf-app .ms-tag-text { display:inline-block;min-width:0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
.cf-app .ms-x { cursor:pointer;color:rgba(200,240,154,.45);font-size:14px;line-height:1;transition:color .12s; }
.cf-app .ms-x:hover { color:var(--accent); }
.cf-app .ms-caret { position:absolute;right:11px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--text3);display:flex; }
.cf-app .ms-drop { position:absolute;top:calc(100% + 5px);left:0;right:0;z-index:200;background:var(--surface3);border:1px solid var(--border2);border-radius:var(--r-md);overflow:hidden;max-height:220px;overflow-y:auto; }
.cf-app .ms-opt { padding:9px 13px;font-size:13px;color:var(--text2);cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:background .1s;font-weight:300; }
.cf-app .ms-opt:hover { background:var(--adim2);color:var(--text); }
.cf-app .ms-opt.sel { color:var(--accent);background:var(--adim2); }
.cf-app .ms-chk { width:13px;height:13px;border-radius:3px;border:1px solid var(--border2);display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.cf-app .ms-opt.sel .ms-chk { background:var(--accent);border-color:var(--accent); }

.cf-app .brow { display:flex;justify-content:flex-end;gap:8px;margin-top:22px; }
.cf-app .btn { padding:10px 22px;border-radius:var(--r-sm);font-size:13px;font-family:'Sora',sans-serif;cursor:pointer;font-weight:500;letter-spacing:.02em;transition:all .15s;border:none; }
.cf-app .btn-p { background:var(--accent);color:#07080d; }
.cf-app .btn-p:hover { background:#d4f7aa;transform:translateY(-1px); }
.cf-app .btn-g { background:transparent;border:1px solid var(--border2);color:var(--text2); }
.cf-app .btn-g:hover { border-color:rgba(200,240,154,.2);color:var(--text); }

.cf-app .add-row { display:flex;gap:8px;margin-top:8px; }
.cf-app .add-row .ti { flex:1; }
.cf-app .add-btn { padding:0 16px;background:var(--adim);border:1px solid rgba(200,240,154,.2);border-radius:var(--r-sm);color:var(--accent);font-size:13px;cursor:pointer;font-family:'Sora',sans-serif;white-space:nowrap;transition:all .15s;font-weight:400; }
.cf-app .add-btn:hover { background:rgba(200,240,154,.18); }

.cf-app .err-box { background:var(--err-bg);border:1px solid rgba(240,154,154,.2);border-radius:var(--r-sm);padding:10px 13px;font-size:12px;color:var(--err);margin-top:10px;font-weight:300;line-height:1.5; }

.cf-app .gen-wrap { display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:400px;text-align:center; }
.cf-app .gen-orb { width:58px;height:58px;border-radius:50%;background:var(--adim);border:1px solid rgba(200,240,154,.18);display:flex;align-items:center;justify-content:center;margin:0 auto 24px;animation:cfSpin 4s linear infinite; }
@keyframes cfSpin { to{transform:rotate(360deg)} }
.cf-app .gen-title { font-family:'Playfair Display',serif;font-size:26px;color:var(--text);margin-bottom:8px;font-weight:400; }
.cf-app .gen-msg { font-size:13px;color:var(--text2);margin-bottom:28px;font-weight:300;min-height:18px; }
.cf-app .prog-track { width:240px;height:2px;background:var(--surface3);border-radius:99px;overflow:hidden;margin:0 auto;position:relative; }
.cf-app .prog-indet { position:absolute;top:0;left:0;height:100%;width:40%;background:var(--accent);border-radius:99px;animation:cfIndet 1.4s ease-in-out infinite; }
@keyframes cfIndet { 0% { left:-40%; } 100% { left:100%; } }
.cf-app .gen-checklist { margin-top:28px;display:flex;flex-direction:column;gap:7px;align-items:flex-start;max-width:260px; }
.cf-app .gci { font-size:12px;color:var(--text3);display:flex;align-items:center;gap:8px;font-weight:300;transition:color .3s; }
.cf-app .gci.done { color:var(--accent); }
.cf-app .gci-dot { width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0; }

.cf-app .week-strip { display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:18px; }
.cf-app .dtab { padding:10px 4px;border-radius:var(--r-sm);border:1px solid var(--border);text-align:center;cursor:pointer;background:var(--surface);transition:all .15s;font-family:'Sora',sans-serif;color:inherit;width:100%; }
.cf-app .dtab:hover { border-color:var(--border2); }
.cf-app .dtab.on { background:var(--adim);border-color:rgba(200,240,154,.32); }
.cf-app .dtab:focus-visible { outline:2px solid rgba(200,240,154,.7);outline-offset:2px; }
.cf-app .dtab.dragging { opacity:.5;border-color:rgba(200,240,154,.5);background:rgba(200,240,154,.1); }
.cf-app .dtab-dow { font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3); }
.cf-app .dtab.on .dtab-dow { color:rgba(200,240,154,.55); }
.cf-app .dtab-n { font-family:'Playfair Display',serif;font-size:17px;color:var(--text2);margin-top:2px; }
.cf-app .dtab.on .dtab-n { color:var(--accent); }

.cf-app .pcard { background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:26px;animation:cfFadeUp .28s ease; }
.cf-app .ph { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;gap:12px; }
.cf-app .ptags { display:flex;gap:6px;flex-wrap:wrap; }
.cf-app .ptag { font-size:10px;padding:3px 9px;border-radius:99px;font-weight:400;letter-spacing:.05em;text-transform:uppercase; }
.cf-app .pt-day { background:rgba(255,255,255,.04);border:1px solid var(--border2);color:var(--text3); }
.cf-app .pt-topic { background:var(--surface2);border:1px solid var(--border2);color:var(--text2); }
.cf-app .pt-fmt { background:var(--adim);border:1px solid rgba(200,240,154,.18);color:var(--accent); }
.cf-app .cpbtn { font-size:11px;padding:5px 12px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-family:'Sora',sans-serif;letter-spacing:.04em;transition:all .15s;white-space:nowrap;flex-shrink:0; }
.cf-app .cpbtn:hover { border-color:rgba(200,240,154,.28);color:var(--accent); }
.cf-app .cpbtn.done { border-color:rgba(200,240,154,.35);color:var(--accent);background:var(--adim); }

.cf-app .ptitle { font-family:'Playfair Display',serif;font-size:21px;font-weight:400;color:var(--text);line-height:1.35;margin-bottom:18px; }
.cf-app .blabel { font-size:9px;letter-spacing:.15em;text-transform:uppercase;color:var(--text3);margin-bottom:7px;margin-top:16px;font-weight:500; }
.cf-app .hook-block { border-left:2px solid rgba(200,240,154,.28);padding:10px 15px;background:rgba(200,240,154,.025);border-radius:0 6px 6px 0; }
.cf-app .hook-text { font-family:'Playfair Display',serif;font-size:14px;font-style:italic;color:var(--text2);line-height:1.65;white-space:pre-line; }
.cf-app .body-text { font-size:13px;color:#686880;line-height:1.85;white-space:pre-line;font-weight:300; }
.cf-app .cta-block { background:var(--adim2);border:1px solid rgba(200,240,154,.1);border-radius:var(--r-sm);padding:13px 15px;font-size:13px;color:rgba(200,240,154,.75);line-height:1.6;font-weight:300; }
.cf-app .htags { font-size:12px;color:rgba(200,240,154,.38);line-height:2;font-weight:300; }
.cf-app .rationale { font-size:12px;color:var(--text3);font-style:italic;border-top:1px solid var(--border);padding-top:13px;font-weight:300;line-height:1.6; }

.cf-app .step4-layout { display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);gap:18px;align-items:start; }
.cf-app .step4-main { min-width:0; }
.cf-app .step4-side { position:sticky;top:18px;display:flex;flex-direction:column;gap:14px; }
.cf-app .summary-card { background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px; }
.cf-app .summary-head { display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:12px; }
.cf-app .summary-stat { display:flex;flex-direction:column;gap:2px; }
.cf-app .summary-stat b { font-size:20px;color:var(--text);font-family:'Playfair Display',serif;font-weight:400; }
.cf-app .summary-stat span { font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);font-weight:500; }
.cf-app .summary-list { display:grid;gap:8px; }
.cf-app .summary-row { display:flex;justify-content:space-between;gap:10px;font-size:12px;color:var(--text2);padding:8px 10px;border-radius:8px;background:var(--bg);border:1px solid var(--border); }
.cf-app .summary-row strong { color:var(--accent);font-weight:500; }
.cf-app .summary-meta { display:flex;flex-wrap:wrap;gap:8px;margin-top:12px; }
.cf-app .summary-pill { font-size:10px;padding:4px 8px;border-radius:99px;border:1px solid var(--border2);color:var(--text2);background:rgba(255,255,255,.02); }

/* Performance Score Card */
.cf-app .performance-card { background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:20px; }
.cf-app .perf-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:16px; }
.cf-app .perf-overall { display:flex;flex-direction:column;align-items:center;gap:6px; }
.cf-app .perf-score-ring { width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;box-shadow:inset 0 0 0 3px var(--surface); }
.cf-app .perf-score-inner { width:52px;height:52px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:var(--accent); }
.cf-app .perf-metrics { display:flex;flex-direction:column;gap:12px; }
.cf-app .perf-metric { display:flex;flex-direction:column;gap:6px; }
.cf-app .perf-metric-label { display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--text2); }
.cf-app .perf-metric-value { font-weight:600;font-size:12px; }
.cf-app .perf-bar { height:4px;background:var(--border);border-radius:2px;overflow:hidden; }
.cf-app .perf-bar-fill { height:100%;border-radius:2px;transition:width .3s ease; }
.cf-app .perf-feedback { background:var(--bg);border:1px solid var(--border2);border-radius:var(--r-md);padding:12px; }
.cf-app .perf-tips { display:flex;flex-direction:column;gap:6px; }
.cf-app .perf-tip { font-size:11px;color:var(--text2);line-height:1.5;padding:4px 0; }

.cf-app .li-preview { background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px;box-shadow:0 22px 44px rgba(0,0,0,.18); }
.cf-app .li-head { display:flex;align-items:center;gap:10px;margin-bottom:14px; }
.cf-app .li-avatar { width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg, rgba(200,240,154,.9), rgba(200,240,154,.3));color:#07080d;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0; }
.cf-app .li-name { font-size:13px;color:var(--text);font-weight:500;line-height:1.2; }
.cf-app .li-meta { font-size:11px;color:var(--text3);font-weight:300;margin-top:2px; }
.cf-app .li-dot { width:6px;height:6px;border-radius:50%;background:var(--accent);margin-left:auto;box-shadow:0 0 0 4px rgba(200,240,154,.1); }
.cf-app .li-body { position:relative;padding:4px 2px 0; }
.cf-app .li-content { font-size:14px;line-height:1.7;color:var(--text);white-space:pre-wrap; }
.cf-app .li-content strong { color:var(--text);font-weight:600; }
.cf-app .li-fade { position:absolute;left:0;right:0;bottom:0;height:92px;background:linear-gradient(180deg, rgba(13,15,24,0) 0%, rgba(13,15,24,.92) 82%); pointer-events:none; }
.cf-app .li-more { position:relative;z-index:1;margin-top:12px;display:inline-flex;align-items:center;font-size:11px;color:var(--accent);background:var(--adim);border:1px solid rgba(200,240,154,.18);border-radius:99px;padding:5px 10px; }
.cf-app .li-tags { display:flex;flex-wrap:wrap;gap:6px;margin-top:14px; }
.cf-app .li-tag { font-size:11px;padding:4px 8px;border-radius:99px;border:1px solid rgba(200,240,154,.18);color:rgba(200,240,154,.8);background:rgba(200,240,154,.05); }

/* Inspiration Bank */
.cf-app .inspiration-bank { background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px; }
.cf-app .insp-header { margin-bottom:14px; }
.cf-app .insp-title { font-size:13px;font-weight:500;color:var(--text);margin-bottom:4px; }
.cf-app .insp-subtitle { font-size:11px;color:var(--text3);font-weight:300;margin-bottom:6px; }
.cf-app .insp-updated { font-size:10px;color:var(--text3);margin-top:2px; }
.cf-app .insp-topics { display:flex;flex-direction:column;gap:8px;margin-bottom:12px; }
.cf-app .insp-topic { background:transparent;border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px 12px;text-align:left;cursor:pointer;font-family:'Sora',sans-serif;transition:all .15s;font-size:12px;color:var(--text2); }
.cf-app .insp-topic:hover { border-color:rgba(200,240,154,.3);background:rgba(200,240,154,.05);color:var(--text); }
.cf-app .insp-topic-main { display:flex;align-items:center;gap:8px;margin-bottom:4px; }
.cf-app .insp-topic-name { font-weight:500;flex:1; }
.cf-app .insp-trending-badge { font-size:11px; }
.cf-app .insp-topic-meta { display:flex;justify-content:space-between;gap:8px;font-size:10px;color:var(--text3); }
.cf-app .insp-category { background:var(--adim);padding:2px 6px;border-radius:3px;font-weight:400; }
.cf-app .insp-count { color:rgba(200,240,154,.6); }
.cf-app .insp-hint { font-size:10px;color:var(--text3);font-style:italic;line-height:1.5; }

.cf-app .bbar { display:flex;justify-content:space-between;align-items:center;margin-top:16px;gap:10px;flex-wrap:wrap; }
.cf-app .bactions { display:flex;gap:8px;align-items:center; }
.cf-app .restart { font-size:12px;color:var(--text3);cursor:pointer;background:none;border:none;font-family:'Sora',sans-serif;transition:color .15s; }
.cf-app .restart:hover { color:var(--text2); }
.cf-app .dlbtn { display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:13px;font-family:'Sora',sans-serif;cursor:pointer;transition:all .15s;font-weight:400; }
.cf-app .dlbtn:hover { border-color:rgba(200,240,154,.22);color:var(--accent); }

.cf-app .sh { font-family:'Playfair Display',serif;font-size:16px;font-weight:400;color:var(--text);margin-bottom:16px;line-height:1.3; }
.cf-app .sh span { font-style:italic;color:var(--accent); }

.cf-app .date-input { width:100%;background:var(--bg);border:1px solid var(--border2);border-radius:var(--r-sm);padding:11px 13px;font-size:13px;color:var(--text);font-family:'Sora',sans-serif;font-weight:300;outline:none;color-scheme:dark; }
.cf-app .date-input:focus { border-color:rgba(200,240,154,.28); }

.cf-app .pt-date { background:rgba(200,240,154,.06);border:1px solid rgba(200,240,154,.16);color:rgba(200,240,154,.78); }
.cf-app .time-row { display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap; }
.cf-app .time-label { font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--text2);font-weight:500; }
.cf-app .time-input { background:var(--bg);border:1px solid var(--border2);border-radius:6px;padding:6px 9px;font-size:12px;color:var(--text);font-family:'Sora',sans-serif;font-weight:300;outline:none;color-scheme:dark;width:100px; }
.cf-app .time-input:focus { border-color:rgba(200,240,154,.28); }
.cf-app .time-hint { font-size:11px;color:var(--text3);font-weight:300; }

.cf-app .tweak-wrap { position:relative;display:inline-block; }
.cf-app .tweak-menu { position:absolute;top:calc(100% + 4px);right:0;z-index:200;background:var(--surface3);border:1px solid var(--border2);border-radius:var(--r-md);overflow:hidden;min-width:180px;box-shadow:0 6px 24px rgba(0,0,0,.45); }
.cf-app .tweak-opt { padding:9px 13px;font-size:12px;color:var(--text2);cursor:pointer;font-family:'Sora',sans-serif;font-weight:300;border:none;background:transparent;width:100%;text-align:left;display:block; }
.cf-app .tweak-opt:hover { background:var(--adim2);color:var(--accent); }
.cf-app .tweak-opt:disabled { opacity:.4;cursor:not-allowed; }

.cf-app .budget { display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:.04em;padding:3px 9px;border-radius:99px;border:1px solid var(--border2);background:rgba(255,255,255,.02);color:var(--text2);font-family:'Sora',sans-serif;font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap; }
.cf-app .budget.warn { color:#f0d49a;border-color:rgba(240,212,154,.32);background:rgba(240,212,154,.06); }
.cf-app .budget.over { color:var(--err);border-color:rgba(240,154,154,.35);background:rgba(240,154,154,.08); }
.cf-app .budget-dot { width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.7; }

.cf-app .recent-strip { background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:18px 22px;margin-bottom:18px; }
.cf-app .recent-head { display:flex;justify-content:space-between;align-items:baseline;margin-bottom:13px; }
.cf-app .recent-eyebrow { font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--text2);font-weight:500; }
.cf-app .recent-link { font-size:11px;color:var(--text2);text-decoration:none;transition:color .15s; }
.cf-app .recent-link:hover { color:var(--accent); }
.cf-app .recent-list { display:flex;flex-direction:column;gap:7px; }
.cf-app .recent-item { display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg);transition:border-color .15s; }
.cf-app .recent-item:hover { border-color:rgba(200,240,154,.22); }
.cf-app .recent-meta { min-width:0;flex:1; }
.cf-app .recent-title { font-family:'Playfair Display',serif;font-size:14px;color:var(--text);margin:0 0 2px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.cf-app .recent-sub { font-size:10px;color:var(--text3);font-weight:300; }
.cf-app .recent-tag { display:inline-block;padding:1px 7px;border-radius:99px;background:var(--adim);color:var(--accent);font-size:9px;letter-spacing:.04em;margin-right:5px; }
.cf-app .recent-actions { display:flex;gap:5px;flex-shrink:0; }
.cf-app .recent-btn { font-size:10px;padding:5px 11px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-family:'Sora',sans-serif;transition:all .15s;white-space:nowrap; }
.cf-app .recent-btn:hover { border-color:rgba(200,240,154,.32);color:var(--accent); }
.cf-app .recent-btn.primary { background:var(--adim);border-color:rgba(200,240,154,.28);color:var(--accent); }

.cf-app .vsp { margin-top:14px;border:1px dashed var(--border2);border-radius:var(--r-md);padding:14px 16px;background:var(--bg); }
.cf-app .vsp-eyebrow { font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--text3);margin-bottom:8px;font-weight:500; }
.cf-app .vsp-hook { font-family:'Playfair Display',serif;font-style:italic;font-size:14px;color:var(--text2);line-height:1.6;margin-bottom:8px;white-space:pre-line; }
.cf-app .vsp-tail { font-size:12px;color:#686880;line-height:1.7;font-weight:300;white-space:pre-line; }
.cf-app .vsp-empty { font-size:11px;color:var(--text3);font-style:italic; }

.cf-app .sample-banner { background:rgba(200,240,154,.07);border:1px solid rgba(200,240,154,.22);border-radius:var(--r-md);padding:12px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap; }
.cf-app .sample-banner-text { font-size:12px;color:rgba(200,240,154,.85);line-height:1.5;font-weight:400; }
.cf-app .sample-banner-text strong { color:var(--accent);font-weight:500; }
.cf-app .sample-cta { background:var(--accent);color:#07080d;padding:7px 14px;border-radius:6px;font-size:12px;font-weight:500;border:none;cursor:pointer;font-family:'Sora',sans-serif;letter-spacing:.02em;white-space:nowrap; }
.cf-app .sample-cta:hover { background:#d4f7aa; }
.cf-app .sample-link { background:transparent;border:1px solid var(--border2);color:var(--text2);padding:7px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:400; }
.cf-app .sample-link:hover { border-color:rgba(200,240,154,.35);color:var(--accent); }
.cf-app .try-sample { display:flex;justify-content:center;margin:-4px 0 14px; }
.cf-app .try-sample-btn { background:transparent;border:1px dashed var(--border2);color:var(--text2);padding:8px 18px;border-radius:99px;font-size:11px;cursor:pointer;font-family:'Sora',sans-serif;letter-spacing:.04em;transition:all .15s; }
.cf-app .try-sample-btn:hover { border-color:rgba(200,240,154,.35);color:var(--accent);border-style:solid; }

.cf-app .pin-btn { background:transparent;border:1px solid var(--border2);color:var(--text3);width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0; }
.cf-app .pin-btn:hover { border-color:rgba(200,240,154,.32);color:var(--accent); }
.cf-app .pin-btn.on { background:var(--adim);border-color:rgba(200,240,154,.42);color:var(--accent); }
.cf-app .dtab.locked { position:relative; }
.cf-app .dtab.locked::after { content:'📌';position:absolute;top:3px;right:4px;font-size:9px;line-height:1; }
.cf-app .reformat-bar { display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 14px;margin-bottom:14px; }
.cf-app .reformat-label { font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--text2);font-weight:500; }
.cf-app .reformat-sel { background:var(--bg);border:1px solid var(--border2);border-radius:6px;padding:6px 28px 6px 10px;font-size:12px;color:var(--text);font-family:'Sora',sans-serif;outline:none;appearance:none;cursor:pointer;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 11 11' fill='none' stroke='%237a7a8e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><path d='M2.5 4l3 3 3-3'/></svg>");background-repeat:no-repeat;background-position:right 9px center; }
.cf-app .reformat-btn { background:var(--adim);border:1px solid rgba(200,240,154,.28);color:var(--accent);padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-family:'Sora',sans-serif;font-weight:500; }
.cf-app .reformat-btn:disabled { opacity:.5;cursor:not-allowed; }

.cf-app .copy-split { position:relative;display:inline-flex; }
.cf-app .copy-split-main { border-top-right-radius:0;border-bottom-right-radius:0;border-right-width:0; }
.cf-app .copy-split-caret { padding:5px 8px;border-radius:0 var(--r-sm) var(--r-sm) 0;border:1px solid var(--border2);background:transparent;color:var(--text2);cursor:pointer;font-family:'Sora',sans-serif;display:inline-flex;align-items:center;transition:all .15s; }
.cf-app .copy-split-caret:hover { border-color:rgba(200,240,154,.28);color:var(--accent); }
.cf-app .copy-menu { position:absolute;top:calc(100% + 4px);right:0;z-index:200;background:var(--surface3);border:1px solid var(--border2);border-radius:var(--r-md);overflow:hidden;min-width:180px;box-shadow:0 6px 24px rgba(0,0,0,.45); }
.cf-app .copy-menu-opt { padding:9px 13px;font-size:12px;color:var(--text2);cursor:pointer;font-family:'Sora',sans-serif;font-weight:300;border:none;background:transparent;width:100%;text-align:left;display:block; }
.cf-app .copy-menu-opt:hover { background:var(--adim2);color:var(--accent); }

/* Modal overlays */
.cf-app .modal-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:1000; }
.cf-app .modal-content { background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;max-width:480px;width:calc(100% - 32px);max-height:80vh;overflow-y:auto; }
.cf-app .modal-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:20px; }
.cf-app .modal-header h2 { font-size:18px;color:var(--text);margin:0;font-family:'Playfair Display',serif;font-weight:400; }
.cf-app .modal-close { background:transparent;border:none;color:var(--text2);font-size:24px;cursor:pointer;padding:0;width:32px;height:32px;display:flex;align-items:center;justify-content:center;transition:color .15s; }
.cf-app .modal-close:hover { color:var(--text); }
.cf-app .modal-body { display:flex;flex-direction:column;gap:16px;margin-bottom:20px; }
.cf-app .modal-footer { display:flex;gap:8px;justify-content:flex-end; }

.cf-app .form-group { display:flex;flex-direction:column;gap:6px; }
.cf-app .form-group label { font-size:12px;color:var(--text2);font-weight:500;letter-spacing:.04em;text-transform:uppercase; }
.cf-app .form-group input, .cf-app .form-group select { background:var(--bg);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px 12px;font-size:13px;color:var(--text);font-family:'Sora',sans-serif;outline:none; }
.cf-app .form-group input:focus, .cf-app .form-group select:focus { border-color:rgba(200,240,154,.28); }
.cf-app .form-group .hint { font-size:11px;color:var(--text3);margin-top:2px;font-weight:300; }
.cf-app .form-group.checkbox { flex-direction:row;align-items:center; }
.cf-app .form-group.checkbox label { display:flex;align-items:center;gap:8px;margin:0;font-size:13px;font-weight:400;text-transform:none; }
.cf-app .form-group.checkbox input { margin:0;width:16px;height:16px; }
.cf-app .char-count { font-size:11px;color:var(--text3);font-weight:300; }

.cf-app .preview-box { background:var(--bg);border:1px solid var(--border2);border-radius:var(--r-sm);padding:12px;margin-top:8px; }
.cf-app .preview-label { font-size:11px;color:var(--text3);font-weight:500;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px; }
.cf-app .preview-list { list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px; }
.cf-app .preview-list li { font-size:12px;color:var(--text2); }
.cf-app .preview-list li.empty { color:var(--text3);font-style:italic; }

/* Diff view */
.cf-app .diff-overlay { position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:1000; }
.cf-app .diff-modal { background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;max-width:640px;width:calc(100% - 32px);max-height:80vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px; }
.cf-app .diff-header { display:flex;justify-content:space-between;align-items:flex-start; }
.cf-app .diff-header h2 { font-size:18px;color:var(--text);margin:0;font-family:'Playfair Display',serif;font-weight:400; }
.cf-app .diff-stats { display:flex;gap:8px;flex-wrap:wrap; }
.cf-app .diff-stats .stat { font-size:11px;padding:4px 8px;border-radius:99px;border:1px solid var(--border2);color:var(--text2);background:rgba(255,255,255,.02); }
.cf-app .diff-stats .stat.positive { border-color:rgba(152,195,121,.28);color:rgba(152,195,121,.8);background:rgba(152,195,121,.05); }
.cf-app .diff-stats .stat.negative { border-color:rgba(240,154,154,.28);color:rgba(240,154,154,.8);background:rgba(240,154,154,.05); }
.cf-app .diff-stats .stat.removed { border-color:rgba(240,154,154,.28);color:rgba(240,154,154,.8);background:rgba(240,154,154,.05); }
.cf-app .diff-stats .stat.added { border-color:rgba(152,195,121,.28);color:rgba(152,195,121,.8);background:rgba(152,195,121,.05); }
.cf-app .diff-content { flex:1;overflow-y:auto; }
.cf-app .diff-comparison { display:grid;grid-template-columns:1fr 1fr;gap:12px; }
.cf-app .diff-col { display:flex;flex-direction:column;gap:8px; }
.cf-app .diff-col-label { font-size:11px;color:var(--text3);font-weight:500;letter-spacing:.04em;text-transform:uppercase; }
.cf-app .diff-side { font-size:12px;color:var(--text2);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;background:var(--bg);line-height:1.6;white-space:pre-wrap;word-break:break-word; }
.cf-app .diff-line { margin-bottom:4px; }
.cf-app .diff-actions { display:flex;gap:8px;justify-content:flex-end; }

@media (max-width: 640px) {
  .cf-app .ind-grid{grid-template-columns:repeat(3,1fr);}
  .cf-app .plat-grid{grid-template-columns:repeat(2,1fr);}
  .cf-app .g2{grid-template-columns:1fr;}
  .cf-app .brand-title{font-size:30px;}
  .cf-app .hero-shell{grid-template-columns:1fr;}
  .cf-app .hero-title{font-size:28px;max-width:none;}
  .cf-app .hero-grid{grid-template-columns:1fr;}
  .cf-app .step4-layout{grid-template-columns:1fr;}
  .cf-app .step4-side{position:static;}
  .cf-app .stepper{grid-template-columns:repeat(2,minmax(0,1fr));}
  /* Hide inactive step labels on mobile but keep the active one for context. */
  .cf-app .stepper .slabel:not(.active){display:none;}
  .cf-app .stepper .slabel.active{font-size:11px;}
}
`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function Caret() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4l3 3 3-3" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="#07080d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 4.5L3.5 6.5L7.5 2.5" />
    </svg>
  );
}

function baseFormatLabel(format: string) {
  return (format || "Unspecified").split("—")[0].split("-")[0].trim() || "Unspecified";
}

function renderLinkedInPreviewText(text: string) {
  return text.split(/\n/).map((line, lineIndex) => {
    const chunks = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={lineIndex} style={{ marginBottom: lineIndex === 0 ? 0 : 8 }}>
        {chunks.map((chunk, chunkIndex) => {
          if (chunk.startsWith("**") && chunk.endsWith("**")) {
            return <strong key={`${lineIndex}-${chunkIndex}`}>{chunk.slice(2, -2)}</strong>;
          }
          return <span key={`${lineIndex}-${chunkIndex}`}>{chunk}</span>;
        })}
      </div>
    );
  });
}

interface SelectFieldProps {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}

function SelectField({ label, options, value, onChange, placeholder, hint }: SelectFieldProps) {
  return (
    <div>
      <div className="flabel">{label}{hint && <span className="fhint">{hint}</span>}</div>
      <div className="swrap">
        <select className="sel" aria-label={label || "Select option"} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">{placeholder || "Select…"}</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="sarrow"><Caret /></span>
      </div>
    </div>
  );
}

interface MultiSelectProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  hint?: string;
  disabledOptions?: string[];
}

function MultiSelect({ label, options, value, onChange, placeholder, max = 6, hint, disabledOptions = [] }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  const toggle = (v: string) => {
    if (disabledOptions.includes(v)) return;
    if (value.includes(v)) onChange(value.filter(x => x !== v));
    else if (value.length < max) onChange([...value, v]);
  };
  return (
    <div>
      <div className="flabel">{label}{hint && <span className="fhint">{hint}</span>}</div>
      <div className="mswrap" ref={ref}>
        <div className={`msbox ${open ? "open" : ""}`} onClick={() => setOpen(o => !o)}>
          {value.length === 0
            ? <span className="ms-ph">{placeholder || "Select…"}</span>
            : value.map(v => (
              <span key={v} className="ms-tag" title={v}>
                <span className="ms-tag-text">{v}</span>
                <span className="ms-x" onClick={e => { e.stopPropagation(); toggle(v); }}>×</span>
              </span>
            ))}
          <span className="ms-caret"><Caret /></span>
        </div>
        {open && (
          <div className="ms-drop">
            {options.map(o => {
              const disabled = disabledOptions.includes(o);
              if (disabled) {
                return (
                  <div key={o} className="ms-opt" style={{ opacity: 0.5, cursor: "default", fontStyle: "italic" }} onClick={e => e.stopPropagation()}>
                    {o}
                  </div>
                );
              }
              return (
                <div key={o} className={`ms-opt ${value.includes(o) ? "sel" : ""}`} onClick={() => toggle(o)}>
                  {o}
                  <span className="ms-chk">{value.includes(o) && <Check />}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

interface Post {
  day: number;
  dow: string;
  topic: string;
  format: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
  rationale: string;
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

type WizardForm = {
  industry: string;
  platform: string;
  language: string;
  coreIdea: string;
  audiences: string[];
  voice: string;
  style: string;
  goals: string[];
  topics: string[];
  format: string;
  cta: string;
  copyStyle: string;
  length: string;
  structure: string;
  extra: string;
  bannedWords: string[];
  requiredWords: string[];
  weekStart: string;
  mode: "week" | "day";
  targetDate: string;
};

type WizardDraftSnapshot = {
  savedAt: number;
  form: WizardForm;
  step: number;
  extraTopics: string[];
  posts: Post[];
  activeDay: number;
  postTimes: Record<string, string>;
};

const INITIAL_FORM: WizardForm = {
  industry: "",
  platform: "LinkedIn",
  language: "English",
  coreIdea: "",
  audiences: [],
  voice: "",
  style: "",
  goals: ["Awareness", "Engagement"],
  topics: [],
  format: "Balanced mix",
  cta: "Share & repost bait",
  copyStyle: "None",
  length: "medium",
  structure: "mixed",
  extra: "",
  bannedWords: [],
  requiredWords: [],
  weekStart: toDateInputValue(nextMonday()),
  mode: "week",
  targetDate: toDateInputValue(nextMonday()),
};

// ─── MAIN ────────────────────────────────────────────────────────────────────

const DRAFT_VERSION = 1;
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const WIZARD_DRAFT_PREFIX = "draft:wizard:";
const WIZARD_SERVER_DRAFT_TABLE = "wizard_drafts";
let wizardDraftServerAvailable = true;

function isMissingWizardDraftTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; message?: unknown; details?: unknown };
  const status = candidate.status;
  const message = String(candidate.message || candidate.details || "").toLowerCase();
  return status === 404 || message.includes(WIZARD_SERVER_DRAFT_TABLE) || message.includes("does not exist") || message.includes("not found");
}

function markWizardDraftServerUnavailable(error: unknown) {
  if (isMissingWizardDraftTableError(error)) {
    wizardDraftServerAvailable = false;
  }
}

type DraftEnvelope<T> = {
  version: number;
  savedAt: number;
  data: T;
};

function makeDraftEnvelope<T>(data: T): DraftEnvelope<T> {
  return { version: DRAFT_VERSION, savedAt: Date.now(), data };
}

function parseDraftEnvelope<T>(value: unknown): DraftEnvelope<T> | null {
  if (!value || typeof value !== "object") return null;
  const envelope = value as Partial<DraftEnvelope<T>>;
  if (
    typeof envelope.version !== "number" ||
    typeof envelope.savedAt !== "number" ||
    !("data" in envelope)
  ) {
    return null;
  }
  if (envelope.version !== DRAFT_VERSION || Date.now() - envelope.savedAt > DRAFT_MAX_AGE_MS) {
    return null;
  }
  return envelope as DraftEnvelope<T>;
}

function readDraftEnvelope<T>(key: string): DraftEnvelope<T> | null {
  try {
    const env = storageService.loadDraft<DraftEnvelope<T>>(key);
    return env ?? null;
  } catch (e) {
    // Ensure corrupt items are removed
    storageService.removeDraft(key);
    return null;
  }
}

function readDraft<T>(key: string): T | null {
  return readDraftEnvelope<T>(key)?.data ?? null;
}

function writeDraft<T>(key: string, data: T) {
  // Save the draft envelope with a TTL matching the page's max age
  try {
    storageService.saveDraft<DraftEnvelope<T>>(key, makeDraftEnvelope(data), DRAFT_MAX_AGE_MS);
  } catch (e) {
    console.warn("writeDraft failed", e);
  }
}

function extractMediaUrlsFromPosts(items: Post[]): string[] {
  const urls = new Set<string>();
  const urlRe = /(https?:\/\/[\w\-./?=&%]+\.(?:png|jpg|jpeg|webp))(?:\)|\s|$)/gi;

  for (const post of items) {
    const haystack = `${post.title || ""} ${post.hook || ""} ${post.body || ""} ${post.cta || ""}`;
    let match: RegExpExecArray | null;
    while ((match = urlRe.exec(haystack))) {
      urls.add(match[1]);
    }
  }

  return [...urls];
}

async function upsertMediaReferences(params: {
  userId: string;
  referenceKey: string;
  bucket: string;
  posts: Post[];
}) {
  const { userId, referenceKey, bucket, posts } = params;
  const urls = extractMediaUrlsFromPosts(posts);
  if (!urls.length) return;

  await Promise.all(urls.map((publicUrl) =>
    supabase.from("media_references").upsert({
      user_id: userId,
      bucket,
      storage_path: publicUrl,
      public_url: publicUrl,
      reference_kind: bucket === "avatars" ? "avatar" : "calendar",
      reference_key: referenceKey,
      reference_count: 1,
      last_referenced_at: new Date().toISOString(),
      orphaned_at: null,
      deleted_at: null,
    }, { onConflict: "bucket,storage_path" })
  ));
}

async function readServerDraft(userId: string): Promise<DraftEnvelope<WizardDraftSnapshot> | null> {
  if (!wizardDraftServerAvailable) return null;
  const { data, error } = await supabase.from(WIZARD_SERVER_DRAFT_TABLE)
    .select("snapshot")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    markWizardDraftServerUnavailable(error);
    return null;
  }
  if (!data?.snapshot) return null;
  return parseDraftEnvelope<WizardDraftSnapshot>(data.snapshot);
}

async function writeServerDraft(userId: string, snapshot: WizardDraftSnapshot) {
  if (!wizardDraftServerAvailable) return;
  const { error } = await supabase.from(WIZARD_SERVER_DRAFT_TABLE).upsert(
    {
      user_id: userId,
      snapshot: makeDraftEnvelope(snapshot) as unknown as Json,
    },
    { onConflict: "user_id" }
  );
  if (error) markWizardDraftServerUnavailable(error);
}

async function clearServerDraft(userId: string) {
  if (!wizardDraftServerAvailable) return;
  const { error } = await supabase.from(WIZARD_SERVER_DRAFT_TABLE).delete().eq("user_id", userId);
  if (error) markWizardDraftServerUnavailable(error);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simple in-memory dedupe map for generation requests to prevent duplicate in-flight calls
const _pendingGenRequests = new Map<string, Promise<Response>>();

async function fetchWithGenerationRetry(input: RequestInfo | URL, init: RequestInit, maxRetries = 2): Promise<Response> {
  // Build a cheap dedupe key from URL + method + body
  try {
    const url = typeof input === "string" ? input : String(input);
    const method = (init && init.method) || "GET";
    const bodyKey = init.body ? String(init.body) : "";
    const dedupeKey = `${method.toUpperCase()}|${url}|${bodyKey}`;

    if (_pendingGenRequests.has(dedupeKey)) {
      return _pendingGenRequests.get(dedupeKey)!;
    }

    const p = (async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(input, init);
          if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
            await sleep(400 * Math.pow(2, attempt));
            continue;
          }
          return res;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") throw error;
          if (attempt >= maxRetries) throw error;
          await sleep(400 * Math.pow(2, attempt));
        }
      }
    })();

    _pendingGenRequests.set(dedupeKey, p);
    try {
      const res = await p;
      return res;
    } finally {
      // Ensure we remove the pending promise once settled
      _pendingGenRequests.delete(dedupeKey);
    }
  } catch (e) {
    // Fallback to normal fetch loop if any error building the key
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(input, init);
        if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
          await sleep(400 * Math.pow(2, attempt));
          continue;
        }
        return res;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        if (attempt >= maxRetries) throw error;
        await sleep(400 * Math.pow(2, attempt));
      }
    }
  }
}

const Index = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardForm>(() => ({ ...INITIAL_FORM }));
  const [customTopic, setCustomTopic] = useState("");
  const [extraTopics, setExtraTopics] = useState<string[]>([]);
  const [recentCalendars, setRecentCalendars] = useState<{ id: string; title: string; platform: string | null; industry_label: string | null; created_at: string }[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postTimes, setPostTimes] = useState<Record<string, string>>({}); // {"1":"09:00",...}
  const [activeDay, setActiveDay] = useState(0);
  const [genMsg, setGenMsg] = useState("");
  const [genStep, setGenStep] = useState(0);
  const [error, setError] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastGenerationError, setLastGenerationError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [tweakOpenIdx, setTweakOpenIdx] = useState<number | null>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [lockedDays, setLockedDays] = useState<Set<number>>(new Set());
  const [sampleMode, setSampleMode] = useState(false);
  const [e2eNetworkError, setE2eNetworkError] = useState(false);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const [reformatTarget, setReformatTarget] = useState<string>("");
  const [reformatting, setReformatting] = useState(false);
  const [recoveryDraft, setRecoveryDraft] = useState<WizardDraftSnapshot | null>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autosaveClearTimer = useRef<number | null>(null);
  const [showRationale, setShowRationale] = useState(false);
  const [showSubtopicConfirm, setShowSubtopicConfirm] = useState(false);
  const [subtopicPreview, setSubtopicPreview] = useState<string[]>([]);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [diffViewData, setDiffViewData] = useState<{ before: string; after: string; dayIndex: number; newPost: Post } | null>(null);
  const [confirm, setConfirm] = useState<{ title?: string; message: string; onConfirm: () => void | Promise<void> } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const msgRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generatingRef = useRef(false);
  const hydrated = useRef(false);
  const draftReady = useRef(false);
  const draftSaveTimer = useRef<number | null>(null);
  const industryRef = useRef<HTMLDivElement>(null);
  const coreIdeaRef = useRef<HTMLDivElement>(null);
  const topicsRef = useRef<HTMLDivElement>(null);
  const tweakRef = useRef<HTMLDivElement>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const createCalendarMutation = useCreateCalendarMutation();
  const regenerateMutation = useRegeneratePostMutation(savedId || undefined);

  // Undo/redo hook for post history
  const { state: postsHistory, setState: setPostsWithHistory, undo: undoChange, redo: redoChange, canUndo, canRedo } = useUndoRedo<Post[]>(posts);

  // Sync posts state with undo/redo history
  useEffect(() => {
    if (postsHistory !== posts) {
      setPosts(postsHistory);
    }
  }, [postsHistory, posts]);

  // Keyboard shortcuts for undo/redo and batch edit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z for undo (or Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey && canUndo && step === 4) {
        e.preventDefault();
        undoChange();
        toast.success("Undo ✓");
      }
      // Ctrl+Y (or Cmd+Shift+Z on Mac) for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z")) && canRedo && step === 4) {
        e.preventDefault();
        redoChange();
        toast.success("Redo ✓");
      }
      // Ctrl+Shift+E for batch edit
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "e" && step === 4) {
        e.preventDefault();
        setBatchEditOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, canUndo, canRedo, undoChange, redoChange]);

  const scrollToField = (field: "industry" | "coreIdea" | "topics") => {
    const refMap = { industry: industryRef, coreIdea: coreIdeaRef, topics: topicsRef };
    refMap[field].current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const weekSummary = useMemo(() => {
    const totalPosts = posts.length;
    const totalChars = posts.reduce((sum, post) => sum + formatForPlatform(post, form.platform, { style: getClipboardStyle() }).charCount, 0);
    const totalWithinLimit = posts.filter(post => formatForPlatform(post, form.platform, { style: getClipboardStyle() }).charCount <= formatForPlatform(post, form.platform, { style: getClipboardStyle() }).limit).length;
    const formatCounts = posts.reduce<Record<string, number>>((counts, post) => {
      const label = baseFormatLabel(post.format);
      counts[label] = (counts[label] || 0) + 1;
      return counts;
    }, {});
    const hashtagCounts = posts.map(post => post.hashtags.split(/\s+/).filter(Boolean).length);
    const postingTimes = posts.map(post => ({
      day: post.day,
      dow: post.dow,
      time: postTimes[String(post.day)] || suggestedTimeForDay(post.day),
    }));

    return {
      totalPosts,
      avgChars: totalPosts ? Math.round(totalChars / totalPosts) : 0,
      withinLimitPct: totalPosts ? Math.round((totalWithinLimit / totalPosts) * 100) : 0,
      formatCounts,
      hashtagCounts,
      postingTimes,
    };
  }, [posts, form.platform, postTimes, form.copyStyle]);

  const buildSubtopicPreview = () => {
    const selectedTopics = form.topics.filter(Boolean);
    if (selectedTopics.length === 0) return [];
    if (selectedTopics.length >= 7) {
      const grouped = Array.from({ length: 7 }, () => [] as string[]);
      selectedTopics.forEach((topic, index) => {
        grouped[index % 7].push(topic);
      });
      return grouped.map(bucket => bucket.join(" + "));
    }

    const preview = [...selectedTopics];
    const seed = selectedTopics[0] || form.coreIdea || form.industry || "the topic";
    const fillAngles = [
      `Why ${seed} matters now`,
      `A practical example of ${seed}`,
      `Common mistakes around ${seed}`,
      `How to apply ${seed} this week`,
      `A sharper take on ${seed}`,
      `What most people miss about ${seed}`,
      `A closing lesson on ${seed}`,
    ];

    for (const angle of fillAngles) {
      if (preview.length >= 7) break;
      preview.push(angle);
    }

    return preview.slice(0, 7);
  };

  // Close tweak menu on outside click
  useEffect(() => {
    if (tweakOpenIdx === null) return;
    const h = (e: MouseEvent) => {
      if (tweakRef.current && !tweakRef.current.contains(e.target as Node)) setTweakOpenIdx(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [tweakOpenIdx]);

  // Close copy-split menu on outside click
  useEffect(() => {
    if (!copyMenuOpen) return;
    const h = (e: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) setCopyMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [copyMenuOpen]);

  // Keyboard shortcuts: arrow keys navigate between days (only on step 4 when week-strip visible)
  useEffect(() => {
    if (step !== 4 || posts.length <= 1) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveDay(d => (d + 1) % posts.length);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveDay(d => (d - 1 + posts.length) % posts.length);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [step, posts.length]);

  // Load user profile with React Query
  const { data: profileData } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("default_voice, default_style, default_audiences, default_goals")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch recent calendars with React Query
  const { data: recentCalendarsData } = useQuery({
    queryKey: ["recent-calendars", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("saved_calendars")
        .select("id, title, platform, industry_label, created_at")
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Update recent calendars state when data changes
  useEffect(() => {
    if (recentCalendarsData) {
      setRecentCalendars(recentCalendarsData);
    }
  }, [recentCalendarsData]);

  const wizardDraftKey = `${WIZARD_DRAFT_PREFIX}${user ? user.id : "guest"}`;

  // Hydrate the wizard draft once on mount and prompt the user before restoring it.
  useEffect(() => {
    let cancelled = false;
    draftReady.current = false;
    setRecoveryDraft(null);
    setShowRecoveryDialog(false);

    // Remove any expired local drafts early to avoid showing stale recovery
    try {
      storageService.cleanupExpiredDrafts();
    } catch (e) {
      /* ignore */
    }

    const hydrateDraft = async () => {
      try {
        const localDraft = readDraftEnvelope<WizardDraftSnapshot>(wizardDraftKey);
        const serverDraft = user ? await readServerDraft(user.id) : null;
        const newestDraft = [localDraft, serverDraft]
          .filter((item): item is DraftEnvelope<WizardDraftSnapshot> => !!item)
          .sort((a, b) => b.savedAt - a.savedAt)[0] || null;

        if (cancelled) return;

        if (newestDraft) {
          const shouldSkipRecovery = newestDraft.data.step === 4 && newestDraft.data.posts.length === 0;
          if (shouldSkipRecovery) {
            if (user) {
              void clearServerDraft(user.id).catch((error) => {
                console.warn("Failed to clear empty server draft", error);
              });
            }
            if (localDraft) {
              storageService.removeDraft(wizardDraftKey);
            }
            return;
          }
          setRecoveryDraft(newestDraft.data);
          setShowRecoveryDialog(true);
          if (user && localDraft && localDraft.savedAt >= (serverDraft?.savedAt || 0)) {
            void writeServerDraft(user.id, localDraft.data).catch((error) => {
              console.warn("Failed to sync local draft to server", error);
            });
          }
        }
      } catch (e) {
        console.warn("Failed to load wizard draft", e);
      } finally {
        if (!cancelled) draftReady.current = true;
      }
    };

    void hydrateDraft();

    return () => {
      cancelled = true;
    };
  }, [wizardDraftKey, user]);

  // Pre-fill form with profile defaults when profile data loads and no recovered draft is pending.
  useEffect(() => {
    if (!profileData || hydrated.current || recoveryDraft) return;
    const isDefaultForm = !form.voice && !form.style && form.audiences.length === 0 && form.goals.length === 0;
    if (isDefaultForm) {
      setForm(f => ({
        ...f,
        voice: f.voice || profileData.default_voice || "",
        style: f.style || profileData.default_style || "",
        audiences: f.audiences.length ? f.audiences : (profileData.default_audiences || []),
        goals: profileData.default_goals && profileData.default_goals.length ? profileData.default_goals : f.goals,
      }));
    }
    hydrated.current = true;
  }, [profileData, form.voice, form.style, form.audiences.length, form.goals.length, recoveryDraft]);

  // Persist the active wizard snapshot, with a short debounce, so reloads can recover progress.
  useEffect(() => {
    if (!draftReady.current || !wizardDraftKey || recoveryDraft) return;
    if (draftSaveTimer.current) {
      window.clearTimeout(draftSaveTimer.current);
    }
    draftSaveTimer.current = window.setTimeout(() => {
      const hasMeaningfulDraft =
        step > 1 ||
        posts.length > 0 ||
        form.industry !== "" ||
        form.coreIdea.trim() !== "" ||
        form.audiences.length > 0 ||
        form.voice !== "" ||
        form.style !== "" ||
        form.topics.length > 0 ||
        form.extra.trim() !== "" ||
        form.bannedWords.length > 0 ||
        form.requiredWords.length > 0 ||
        form.format !== "Balanced mix" ||
        form.cta !== "Share & repost bait" ||
        form.length !== "medium" ||
        form.structure !== "mixed" ||
        form.mode !== "week" ||
        form.targetDate !== toDateInputValue(nextMonday());

      try {
        if (!hasMeaningfulDraft) {
          localStorage.removeItem(wizardDraftKey);
          if (user) {
            void clearServerDraft(user.id).catch((error) => {
              console.warn("Failed to clear server draft", error);
            });
          }
          return;
        }
        const snapshot = {
          savedAt: Date.now(),
          form,
          step,
          extraTopics,
          posts,
          activeDay,
          postTimes,
        };
        try {
          setAutosaveStatus("saving");
          writeDraft(wizardDraftKey, snapshot);
          // Persist media references found in posts for orphan cleanup later
          try {
            // simple extractor for image urls in post bodies
            const urlRe = /(https?:\/\/[\w\-./?=&%]+\.(?:png|jpg|jpeg|webp))(?:\)|\s|$)/gi;
            for (const p of posts) {
              const hay = `${(p.title || "")} ${(p.hook || "")} ${(p.body || "")} ${(p.cta || "")}`;
              let m: RegExpExecArray | null;
              while ((m = urlRe.exec(hay))) {
                void import("@/lib/mediaManager")
                  .then(mod => mod.default.addMediaRef(wizardDraftKey, m[1]))
                  .catch(() => {
                    /* media reference tracking is best effort */
                  });
              }
            }
          } catch {
            /* autosave media extraction is best effort */
          }
          setAutosaveStatus("saved");
          if (autosaveClearTimer.current) window.clearTimeout(autosaveClearTimer.current);
          autosaveClearTimer.current = window.setTimeout(() => {
            setAutosaveStatus("idle");
            autosaveClearTimer.current = null;
          }, 2000);
        } catch (e) {
          setAutosaveStatus("error");
          if (autosaveClearTimer.current) window.clearTimeout(autosaveClearTimer.current);
          autosaveClearTimer.current = window.setTimeout(() => {
            setAutosaveStatus("idle");
            autosaveClearTimer.current = null;
          }, 3000);
        }
        if (user) {
          void writeServerDraft(user.id, snapshot).catch((error) => {
            console.warn("Failed to autosave wizard draft", error);
          });
        }
      } catch (e) {
        console.warn("Failed to persist wizard draft", e);
      }
    }, 1000);

    return () => {
      if (draftSaveTimer.current) {
        window.clearTimeout(draftSaveTimer.current);
      }
    };
  }, [wizardDraftKey, user, form, step, extraTopics, posts, activeDay, postTimes, recoveryDraft]);

  const clearDraft = () => {
    try {
      if (wizardDraftKey) storageService.removeDraft(wizardDraftKey);
      if (user) {
        void clearServerDraft(user.id).catch((error) => {
          console.warn("Failed to clear server draft", error);
        });
      }
    } catch (e) {
      console.warn("Failed to clear wizard draft", e);
    }
  };

  const restoreDraft = () => {
    if (!recoveryDraft) return;
    setForm({ ...recoveryDraft.form });
    setStep(recoveryDraft.posts.length > 0 ? 4 : recoveryDraft.step);
    setExtraTopics([...recoveryDraft.extraTopics]);
    setPostsWithHistory([...recoveryDraft.posts]);
    setActiveDay(recoveryDraft.activeDay);
    setPostTimes({ ...recoveryDraft.postTimes });
    setSavedId(null);
    setSampleMode(false);
    setError("");
    setGenMsg("");
    setGenStep(0);
    setRecoveryDraft(null);
    setShowRecoveryDialog(false);
  };

  const discardDraft = () => {
    clearDraft();
    setRecoveryDraft(null);
    setShowRecoveryDialog(false);
  };

  const upd = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setError("");
  }, []);
  const toggleChip = (k: "goals", v: string) =>
    setForm(f => ({ ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v] }));

  const setIndustry = (id: string) => {
    setForm(f => ({ ...f, industry: id, topics: [], audiences: [] }));
    setExtraTopics([]);
    setError("");
  };

  const selectedIndustry = INDUSTRIES.find(i => i.id === form.industry);
  const topicPool = form.industry ? uniqueStrings([...(INDUSTRY_TOPICS[form.industry] || []), ...extraTopics]) : uniqueStrings([...extraTopics]);
  const audiencePool = form.industry ? (AUDIENCE_PRESETS[form.industry] || AUDIENCE_PRESETS.other) : AUDIENCE_PRESETS.other;

  function addCustomTopic() {
    const v = customTopic.trim();
    if (!v || topicPool.includes(v)) return;
    setExtraTopics(p => [...p, v]);
    setForm(f => ({ ...f, topics: [...f.topics, v] }));
    setError("");
    setCustomTopic("");
  }

  function validate(s: number) {
    if (s === 1) {
      if (!form.industry) { setError("Please select your industry / niche."); scrollToField("industry"); return false; }
      if (!form.coreIdea.trim()) { setError("Please describe your core idea."); scrollToField("coreIdea"); return false; }
    }
    if (s === 2) {
      if (form.mode === "day") {
        if (!form.targetDate) { setError("Please pick a date for your post."); return false; }
        if (form.topics.length === 0) { setError("Please pick (or add) one topic for this post."); scrollToField("topics"); return false; }
      } else if (form.topics.length === 0) {
        setError("Please select at least 1 topic.");
        scrollToField("topics");
        return false;
      }
    }
    setError(""); return true;
  }

  const GEN_MSGS = ["Analysing your niche…", "Mapping topics to days…", "Writing hooks…", "Drafting post bodies…", "Adding CTAs & hashtags…"];
  const GEN_LABELS = ["Niche analysis", "Topic mapping", "Hook writing", "Body drafting", "CTA & hashtags"];

  const log = createScopedLogger('Index-Generate');

  async function generate(isRetry: boolean = false, bypassSubtopicPreview: boolean = false) {
    if (generatingRef.current) return;
    if (!validate(2)) return;

    const isE2E = typeof window !== "undefined" && window.localStorage.getItem(getE2EAuthFlag()) === "true";

    if (!isRetry && form.mode !== "day" && !bypassSubtopicPreview && form.topics.length > 0 && form.topics.length < 7 && !isE2E) {
      setSubtopicPreview(buildSubtopicPreview());
      setShowSubtopicConfirm(true);
      return;
    }
    
    generatingRef.current = true;
    setIsGenerating(true);
    setLastGenerationError(null);
    if (typeof telemetry?.sendEvent === "function") telemetry.sendEvent("generate_start", { user: user?.id, mode: form.mode });
    setStep(3); setGenStep(0); setGenMsg(GEN_MSGS[0]); setSavedId(null);

    // Cycle the friendly status messages on a steady cadence; the bar itself is indeterminate.
    let mi = 0;
    msgRef.current = setInterval(() => {
      mi = Math.min(mi + 1, GEN_MSGS.length - 1);
      setGenMsg(GEN_MSGS[mi]);
      setGenStep(mi);
    }, 2200);

    // Abort plumbing: user-cancel + 90s hard timeout.
    const ac = new AbortController();
    abortRef.current = ac;
    const timeoutId = setTimeout(() => ac.abort("timeout"), 90_000);

    const cleanup = () => {
      if (msgRef.current) clearInterval(msgRef.current);
      clearTimeout(timeoutId);
      abortRef.current = null;
      generatingRef.current = false;
      setIsGenerating(false);
    };

    const localFallback = (message: string) => {
      const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const targetDateObj = form.mode === "day" ? (parseLocalDate(form.targetDate) || new Date()) : null;
      const localTargetDow = targetDateObj ? DOW_NAMES[targetDateObj.getDay()] : "Mon";
      const fallbackPosts = generateLocalPosts({
        industry: form.industry,
        industryLabel: selectedIndustry?.label || form.industry,
        platform: form.platform,
        language: form.language,
        coreIdea: form.coreIdea,
        audiences: form.audiences,
        voice: form.voice,
        style: form.style,
        goals: form.goals,
        topics: form.mode === "day" ? [form.topics[0] || form.coreIdea] : form.topics,
        format: form.format,
        cta: form.cta,
        length: form.length,
        structure: form.structure,
        extra: form.extra,
        bannedWords: form.bannedWords,
        requiredWords: form.requiredWords,
        targetTopic: form.topics[0] || form.coreIdea,
        targetDow: localTargetDow,
      });
      const result: Post[] = form.mode === "day" ? fallbackPosts.slice(0, 1) : fallbackPosts;
      setGenStep(GEN_LABELS.length);
      setPostsWithHistory(result);
      setActiveDay(0);
      const seedTimes: Record<string, string> = {};
      for (const r of result) seedTimes[String(r.day)] = suggestedTimeForDay(Number(r.day) || 1);
      setPostTimes(seedTimes);
      setTimeout(() => setStep(4), 350);
      log.warn(`Using local fallback generator`, new Error(message), { mode: form.mode, postCount: result.length });
      if (typeof telemetry?.sendEvent === "function") telemetry.sendEvent("generate_fallback", { user: user?.id, mode: form.mode, reason: message });
      toast.warning("Live AI generation is unavailable right now, so a local fallback version was generated.");
    };

    try {
      if (isE2E) {
        const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const isDay = form.mode === "day";
        const targetDateObj = isDay ? (parseLocalDate(form.targetDate) || new Date()) : null;
        const targetDow = targetDateObj ? DOW_NAMES[targetDateObj.getDay()] : "Mon";
        const result: Post[] = isDay
          ? [{
              ...SAMPLE_POSTS[0],
              day: 1,
              dow: targetDow,
              topic: form.topics[0] || form.coreIdea || SAMPLE_POSTS[0].topic,
              title: `${form.topics[0] || form.coreIdea || SAMPLE_POSTS[0].topic} — ${form.platform}`,
            }]
          : Array.from({ length: 7 }).map((_, index) => {
              const sample = SAMPLE_POSTS[index % SAMPLE_POSTS.length] || SAMPLE_POSTS[0];
              return {
                ...sample,
                day: index + 1,
                dow: DOW_NAMES[(index + 1) % DOW_NAMES.length] || sample.dow,
                topic: form.topics[index] || sample.topic,
              };
            });

        setGenStep(GEN_LABELS.length);
        setPostsWithHistory(result);
        setActiveDay(0);
        const seedTimes: Record<string, string> = {};
        for (const r of result) seedTimes[String(r.day)] = suggestedTimeForDay(Number(r.day) || 1);
        setPostTimes(seedTimes);

        const saved = await createCalendarMutation.mutateAsync({
          user_id: user?.id || E2E_USER_ID,
          title: form.coreIdea.slice(0, 80) || `${selectedIndustry?.label || "Calendar"} — ${form.platform}`,
          industry: form.industry,
          industry_label: selectedIndustry?.label || form.industry,
          platform: form.platform,
          core_idea: form.coreIdea,
          form_payload: { ...form } as unknown as Json,
          posts: result as unknown as Json,
          week_start_date: form.weekStart || null,
          post_times: seedTimes,
        });

        cleanup();
        // Persist last generated post count in-memory for E2E runs
        try {
          e2eStore.setLastGeneratedPosts(result.length);
        } catch {
          /* E2E helper is best effort */
        }
        setSavedId(saved.id);
        toast.success(`${isRetry ? 'Regenerated' : 'Generated'} ${isDay ? 'post' : 'week'} successfully`);
        navigate(`/calendar/${saved.id}`);
        return;
      }

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      const isDay = form.mode === "day";
      const endpoint = isDay ? "generate-single-post" : "generate-calendar";
      const mode = isDay ? "single-day" : "full-week";

      // Derive dow ("Mon".."Sun") from chosen date for single-day mode.
      const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const targetDateObj = isDay ? (parseLocalDate(form.targetDate) || new Date()) : null;
      const targetDow = targetDateObj ? DOW_NAMES[targetDateObj.getDay()] : "Mon";

      const baseBody = {
        industry: form.industry,
        industryLabel: selectedIndustry?.label || form.industry,
        platform: form.platform,
        language: form.language,
        coreIdea: form.coreIdea,
        audiences: form.audiences,
        voice: form.voice,
        style: form.style,
        goals: form.goals,
        format: form.format,
        cta: form.cta,
        length: form.length,
        structure: form.structure,
        extra: form.extra,
        bannedWords: form.bannedWords,
        requiredWords: form.requiredWords,
      };

      const body = isDay
        ? { ...baseBody, topic: form.topics[0] || form.coreIdea, dow: targetDow, date: form.targetDate }
        : { ...baseBody, topics: form.topics };

      log.info(`Starting generation (${mode}, ${isRetry ? 'retry' : 'first attempt'})`, { mode, platform: form.platform, industry: form.industry });

      // E2E fast-path: return a deterministic calendar/post when E2E auth flag is set
      const e2eEnabled = typeof window !== "undefined" && window.localStorage.getItem(getE2EAuthFlag()) === "true";
      if (e2eEnabled) {
        const fakePosts: Post[] = (() => {
          if (isDay) {
            return [
              {
                id: `e2e-post-1`,
                day: 1,
                dow: targetDow,
                topic: form.topics[0] || E2E_CALENDAR.core_idea || "E2E topic",
                title: `E2E Post: ${E2E_CALENDAR.title}`,
                hook: `E2E hook`,
                body: `Deterministic E2E post body for testing.`,
                cta: `No CTA`,
                format: "Balanced mix",
                hashtags: "",
                rationale: "",
                hook_options: [],
                cta_options: [],
              },
            ];
          }
          const days = (E2E_CALENDAR.posts && E2E_CALENDAR.posts.length) || 7;
          return Array.from({ length: days }).map((_, i) => ({
            id: `e2e-post-${i + 1}`,
            day: i + 1,
            dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][(i + 1) % 7],
            topic: form.topics[i] || `E2E topic ${i + 1}`,
            title: `E2E Day ${i + 1}`,
            hook: `E2E hook ${i + 1}`,
            body: `Deterministic E2E body for day ${i + 1}`,
            cta: `No CTA`,
            format: "Balanced mix",
            hashtags: "",
            rationale: "",
            hook_options: [],
            cta_options: [],
          }));
        })();

        setGenStep(GEN_LABELS.length);
        setPostsWithHistory(fakePosts);
        setActiveDay(0);
        const seedTimes: Record<string, string> = {};
        for (const r of fakePosts) seedTimes[String(r.day)] = suggestedTimeForDay(Number(r.day) || 1);
        setPostTimes(seedTimes);
        setTimeout(() => setStep(4), 350);
        log.info(`E2E generation completed`, { mode, postCount: fakePosts.length });
        toast.success(`${isRetry ? 'Regenerated' : 'Generated'} ${isDay ? 'post' : 'week'} successfully`);
        return;
      }

      const res = await fetchWithGenerationRetry(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${session?.access_token || SUPABASE_KEY}`,
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      });

      const data = await res.json().catch(() => ({}));
      cleanup();

      if (!res.ok || data?.error) {
        const errorMsg = data?.error || `Generation failed (${res.status}).`;
        log.warn(`Generation failed`, new Error(errorMsg), { mode, status: res.status, endpoint });
        localFallback(errorMsg);
        return;
      }

      // Normalize: single-post endpoint returns { post }, week endpoint returns { posts }
      const result: Post[] = unwrapPosts(data);
      if (result.length === 0) {
        const emptyError = "Empty response. Please try again.";
        log.warn(`Empty generation response`, new Error(emptyError), { mode });
        localFallback(emptyError);
        return;
      }

      setGenStep(GEN_LABELS.length);
      setPostsWithHistory(result); setActiveDay(0);
      // Seed day-optimized default times per post (keyed by post.day)
      const seedTimes: Record<string, string> = {};
      for (const r of result) seedTimes[String(r.day)] = suggestedTimeForDay(Number(r.day) || 1);
      setPostTimes(seedTimes);
      setTimeout(() => setStep(4), 350);
      log.info(`Generation completed successfully`, { mode, postCount: result.length });
      if (typeof telemetry?.sendEvent === "function") telemetry.sendEvent("generate_success", { user: user?.id, mode: form.mode, postCount: result.length });
      toast.success(`${isRetry ? 'Regenerated' : 'Generated'} ${isDay ? 'post' : 'week'} successfully`);
    } catch (err) {
      if (typeof telemetry?.sendEvent === "function") telemetry.sendEvent("generate_error", { user: user?.id, mode: form.mode, error: String(err) });
      cleanup();
      const aborted = err instanceof DOMException && err.name === "AbortError";
      const reason = (ac.signal as AbortSignal & { reason?: unknown }).reason;
      if (!aborted) {
        localFallback(err instanceof Error ? err.message : String(err));
        return;
      }

      const userMessage = getUserFriendlyMessage(err);
      setError(userMessage);
      setLastGenerationError(err);
      log.error(`Generation error`, err, { mode: form.mode, aborted, reason });

      if (aborted && reason === "timeout") {
        setError("Generation timed out. Please try again.");
      } else if (aborted) {
        setError("Generation was cancelled.");
      } else {
        setError(userMessage);
      }
    }
  }

  function cancelGeneration() {
    if (abortRef.current) abortRef.current.abort("user");
  }

  async function regenerateDay(idx: number, tweak?: "shorter" | "punchier" | "add-stat" | "remove-emoji" | "more-personal" | "clean-formatting") {
    if (regenIdx !== null) return;
    const target = posts[idx];
    if (!target) return;
    setRegenIdx(idx);
    const doRegenerate = async (targetsParam: { p: Post; i: number }[]) => {
      setReformatting(true);
      try {
        const next = [...posts];
        let okCount = 0;
        for (const { p: target, i } of targetsParam) {
          setRegenIdx(i);
          const payload = {
            industry: form.industry,
            industryLabel: selectedIndustry?.label || form.industry,
            platform: form.platform,
            language: form.language,
            coreIdea: form.coreIdea,
            audiences: form.audiences,
            voice: form.voice,
            style: form.style,
            goals: form.goals,
            format: form.format,
            cta: form.cta,
            length: form.length,
            structure: form.structure,
            extra: form.extra,
            bannedWords: form.bannedWords,
            requiredWords: form.requiredWords,
            post: target,
            siblings: next,
          };
          try {
            const newPost = await regenerateMutation.mutateAsync(payload);
            if (newPost) {
              next[i] = newPost as Post;
              setPostsWithHistory([...next]);
              okCount++;
            }
          } catch (e) {
            // ignore per-item failures
          }
        }
        setSavedId(null);
        toast.success(`Regenerated ${okCount} of ${targetsParam.length} unlocked post${targetsParam.length === 1 ? "" : "s"}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Regenerate failed");
      } finally {
        setRegenIdx(null);
        setReformatting(false);
      }
    };

    const targets = [{ p: target, i: idx }];

    if (targets.length === posts.length) {
      setConfirm({ title: "Regenerate all posts?", message: `Regenerate all ${posts.length} posts? Tip: pin posts you love first.`, onConfirm: async () => { setConfirm(null); await doRegenerate(targets); } });
      return;
    }

    await doRegenerate(targets);
  }

  function toggleLock(day: number) {
    setLockedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  }

  async function regenerateUnlocked() {
    if (regenIdx !== null || reformatting) return;
    const targets = posts
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => !lockedDays.has(p.day));
    if (targets.length === 0) {
      toast.error("All posts are locked. Unpin at least one to regenerate.");
      return;
    }

    const doRegenerate = async (targetsParam: { p: Post; i: number }[]) => {
      setReformatting(true);
      try {
        const next = [...posts];
        let okCount = 0;
        for (const { p: target, i } of targetsParam) {
          setRegenIdx(i);
          const payload = {
            industry: form.industry,
            industryLabel: selectedIndustry?.label || form.industry,
            platform: form.platform,
            language: form.language,
            coreIdea: form.coreIdea,
            audiences: form.audiences,
            voice: form.voice,
            style: form.style,
            goals: form.goals,
            format: form.format,
            cta: form.cta,
            length: form.length,
            structure: form.structure,
            extra: form.extra,
            bannedWords: form.bannedWords,
            requiredWords: form.requiredWords,
            post: target,
            siblings: next,
          };
          try {
            const newPost = await regenerateMutation.mutateAsync(payload);
            if (newPost) {
              next[i] = newPost as Post;
              setPostsWithHistory([...next]);
              okCount++;
            }
          } catch (e) {
            // ignore per-item failures
          }
        }
        setSavedId(null);
        toast.success(`Regenerated ${okCount} of ${targetsParam.length} unlocked post${targetsParam.length === 1 ? "" : "s"}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Regenerate failed");
      } finally {
        setRegenIdx(null);
        setReformatting(false);
      }
    };

    if (targets.length === posts.length) {
      setConfirm({ title: "Regenerate all posts?", message: `Regenerate all ${posts.length} posts? Tip: pin posts you love first.`, onConfirm: async () => { setConfirm(null); await doRegenerate(targets); } });
      return;
    }

    await doRegenerate(targets);
  }

  async function reformatAllForPlatform(targetPlatform: string) {
    if (!targetPlatform || targetPlatform === form.platform || reformatting || regenIdx !== null) return;
    if (!user) {
      toast.error("Sign in to reformat — the result is saved as a new calendar.");
      return;
    }
    setConfirm({ title: "Reformat calendar?", message: `Reformat this 7-day calendar for ${niceLabelFor(targetPlatform)}? It will be saved as a NEW calendar — your current one stays untouched.`, onConfirm: async () => {
      setConfirm(null);
      setReformatting(true);
      try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const next: Post[] = [...posts];
      for (let i = 0; i < posts.length; i++) {
        setRegenIdx(i);
        const payload = {
          industry: form.industry,
          industryLabel: selectedIndustry?.label || form.industry,
          platform: targetPlatform,
          language: form.language,
          coreIdea: form.coreIdea,
          audiences: form.audiences,
          voice: form.voice,
          style: form.style,
          goals: form.goals,
          format: form.format,
          cta: form.cta,
          length: form.length,
          structure: form.structure,
          extra: form.extra,
          bannedWords: form.bannedWords,
          requiredWords: form.requiredWords,
          post: posts[i],
          siblings: next,
        };
        try {
          const newPost = await regenerateMutation.mutateAsync(payload);
          if (newPost) next[i] = newPost as Post;
        } catch (e) {
          // ignore per-item failures
        }
      }
      // Save as new calendar
      const title = `${form.coreIdea.slice(0, 60) || selectedIndustry?.label || "Calendar"} — ${targetPlatform}`;
      const newForm = { ...form, platform: targetPlatform };
      const ins = await createCalendarMutation.mutateAsync({
        user_id: user.id,
        title,
        industry: form.industry,
        industry_label: selectedIndustry?.label || form.industry,
        platform: targetPlatform,
        core_idea: form.coreIdea,
        form_payload: newForm as unknown as Json,
        posts: next as unknown as Json,
        week_start_date: form.weekStart || null,
        post_times: postTimes,
      });
      if (!ins?.id) throw new Error("Reformat save failed");
      for (const url of extractMediaUrlsFromPosts(next)) {
        mediaManager.addMediaRef(String(ins.id), url);
      }
      await upsertMediaReferences({ userId: user.id, referenceKey: String(ins.id), bucket: "calendars", posts: next });
      toast.success(`Reformatted for ${niceLabelFor(targetPlatform)} ✓ — opening new calendar`);
      navigate(`/calendar/${ins.id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Reformat failed");
      } finally {
        setRegenIdx(null);
        setReformatting(false);
        setReformatTarget("");
      }
    } });
  }

  function loadSample() {
    setForm(f => ({ ...f, ...SAMPLE_FORM }));
    setPostsWithHistory(SAMPLE_POSTS);
    setPostTimes(SAMPLE_POST_TIMES);
    setActiveDay(0);
    setSampleMode(true);
    setSavedId(null);
    setLockedDays(new Set());
    setStep(4);
    toast.success("Sample calendar loaded — explore the layout, then start your own.");
  }

  function exitSample() {
    setSampleMode(false);
    setPostsWithHistory([]);
    setActiveDay(0);
    setStep(1);
  }

  function applyBatchEdit(payload: BatchEditPayload) {
    const updated = posts.map(post => {
      const updatedPost = { ...post };

      // Apply brand mention if provided
      if (payload.brandMention) {
        updatedPost.cta = `${updatedPost.cta} ${payload.brandMention}`;
      }

      // Add hashtag if provided
      if (payload.hashtag) {
        updatedPost.hashtags = `${updatedPost.hashtags} ${payload.hashtag}`.trim();
      }

      // Replace CTA style if provided
      if (payload.ctaStyle) {
        updatedPost.cta = payload.ctaStyle;
      }

      return updatedPost;
    });

    setPostsWithHistory(updated);
    setSavedId(null);
    toast.success(`Applied batch edits to all ${posts.length} posts`);

    // Reset posting times if requested
    if (payload.updateTimes) {
      const newTimes: Record<string, string> = {};
      posts.forEach(post => {
        newTimes[String(post.day)] = suggestedTimeForDay(post.day);
      });
      setPostTimes(newTimes);
      toast.success("Posting times reset to platform defaults");
    }
  }

  function handleDayDrop(draggedIdx: number | null, targetIdx: number) {
    if (draggedIdx === null || draggedIdx === targetIdx) return;

    const reorderedPosts = swapItems(posts, draggedIdx, targetIdx);
    setPostsWithHistory(reorderedPosts);
    setSavedId(null);
    setDraggedIndex(null);
    toast.success(`Reordered: Day ${posts[draggedIdx].day} ↔ Day ${posts[targetIdx].day}`);
  }

  function copyText(text: string, cb: () => void) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(cb).catch(() => fbCopy(text, cb));
    } else fbCopy(text, cb);
  }
  function fbCopy(text: string, cb: () => void) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand("copy"); cb(); } catch (e) { console.error(e); }
    document.body.removeChild(ta);
  }

  function postText(p: Post) {
    const text = `${p.title}\n\n${p.hook}\n\n${p.body}\n\n${p.cta}\n\n${p.hashtags}`;
    const style = getClipboardStyle();
    return style === FontStyle.None ? text : applyStyle(text, style);
  }

  function getClipboardStyle(): FontStyle {
    return COPY_STYLE_MAP[form.copyStyle] || FontStyle.None;
  }

  function getPostContentForDiff(p: Post): string {
    // Full content for diff comparison
    return [
      `Title: ${p.title}`,
      `Hook: ${p.hook}`,
      `Body:\n${p.body}`,
      `CTA: ${p.cta}`,
      `Hashtags: ${p.hashtags}`,
    ].join("\n\n");
  }

  async function copyPost(i: number) {
    const p = posts[i];
    if (!p) return;
    const formatted = formatForPlatform(p, form.platform, { style: getClipboardStyle() });
    const ok = await writeToClipboard(formatted.text);
    if (!ok) { toast.error("Could not copy to clipboard"); return; }
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 2000);
    if (formatted.truncated && formatted.platform === "twitter") {
      toast.error("Trimmed to fit X's 280-char limit");
    } else {
      toast.success(`Copied for ${formatted.platformLabel} ✓`);
    }
  }
  async function copyAll() {
    const all = posts.map(p => {
      const f = formatForPlatform(p, form.platform, { style: getClipboardStyle() });
      return `=== Day ${p.day} — ${p.dow} | ${p.topic} ===\n${f.text}`;
    }).join("\n\n\n");
    const ok = await writeToClipboard(all);
    if (!ok) { toast.error("Could not copy to clipboard"); return; }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
    toast.success(`All 7 copied for ${niceLabelFor(form.platform)} ✓`);
  }
  function downloadTxt() {
    const header = `CONTENTFORGE — 7-DAY ${form.platform.toUpperCase()} CONTENT CALENDAR
Industry: ${selectedIndustry?.label || "—"}  |  Niche: ${form.coreIdea}
Platform: ${form.platform}  |  Generated: ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
${"═".repeat(52)}\n\n`;
    const body = posts.map(p =>
      `${"─".repeat(52)}
DAY ${p.day} — ${p.dow.toUpperCase()}  |  ${p.topic.toUpperCase()}
Format: ${p.format}
${"─".repeat(52)}

${postText(p)}

📌 ${p.rationale}
`).join("\n\n");
    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contentforge-${form.industry}-${Date.now()}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    try { toast.success("Download started"); } catch (e) { /* noop */ }
  }

  async function saveCalendar() {
    if (!user || posts.length === 0) return;
    setSaving(true);
    try {
      const isDay = form.mode === "day" && posts.length === 1;
      const baseTitle = form.coreIdea.slice(0, 80) || `${selectedIndustry?.label || "Calendar"} — ${form.platform}`;
      const title = isDay
        ? `${(form.topics[0] || baseTitle).slice(0, 60)} · ${form.platform} · ${form.targetDate}`
        : baseTitle;
      const payload = {
        user_id: user.id,
        title,
        industry: form.industry,
        industry_label: selectedIndustry?.label || form.industry,
        platform: form.platform,
        core_idea: form.coreIdea,
        form_payload: form as unknown as Json,
        posts: posts as unknown as Json,
        week_start_date: (isDay ? form.targetDate : form.weekStart) || null,
        post_times: postTimes,
      };

      const data = await createCalendarMutation.mutateAsync(payload);
      if (!data?.id) throw new Error("Calendar save failed");
      for (const url of extractMediaUrlsFromPosts(posts)) {
        mediaManager.addMediaRef(String(data.id), url);
      }
      await upsertMediaReferences({ userId: user.id, referenceKey: String(data.id), bucket: "calendars", posts });
      setSavedId(data.id);
      clearDraft();
      toast.success("Calendar saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Calendar save failed");
    } finally {
      setSaving(false);
    }
  }

  function exportIcs() {
    const weekStart = parseLocalDate(form.weekStart) || nextMonday();
    const title = form.coreIdea.slice(0, 80) || `${selectedIndustry?.label || "Calendar"} — ${form.platform}`;
    downloadIcs({
      calendarTitle: title,
      weekStart,
      postTimes,
      platform: form.platform,
    }, posts);
  }

  const weekStartDate = useMemo(() => parseLocalDate(form.weekStart) || nextMonday(), [form.weekStart]);

  const STEP_LABELS = ["Industry", "Topics", "Generate", "Calendar"];
  const p = posts[activeDay];
  const wizardProgress = Math.round(((step - 1) / (STEP_LABELS.length - 1)) * 100);
  const wizardStepLabel = STEP_LABELS[step - 1] || STEP_LABELS[0];
  const wizardGuidance =
    step === 1 ? "Choose your niche, platform, and tone before anything else." :
    step === 2 ? "Gather the angles that will become your week or single post." :
    step === 3 ? "Generation is running. Keep this tab open until the preview lands." :
    "Review the output, pin the winners, and schedule when ready.";
  const autosaveLabel =
    autosaveStatus === "saving" ? "Saving draft" :
    autosaveStatus === "saved" ? "Draft saved" :
    autosaveStatus === "error" ? "Draft save failed" :
    "Draft idle";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isE2E = window.localStorage.getItem(getE2EAuthFlag()) === "true";
    const hasNetworkErrorFlag = new URLSearchParams(window.location.search).has("e2e-network-error");
    setE2eNetworkError(isE2E && hasNetworkErrorFlag);
  }, []);

  useEffect(() => {
    if (e2eNetworkError) {
      setError("Connection error. Please check your internet and try again.");
    }
  }, [e2eNetworkError]);

  return (
    <WorkspacePage size="xwide" className="cf-app">
      <style>{css}</style>
      <DraftRecoveryDialog
        open={showRecoveryDialog && !!recoveryDraft}
        draft={recoveryDraft ? {
          savedAt: recoveryDraft.savedAt,
          step: recoveryDraft.step,
          industry: recoveryDraft.form.industry,
          postCount: recoveryDraft.posts.length,
        } : null}
        onRestore={restoreDraft}
        onDiscard={discardDraft}
      />
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onConfirm={() => confirm.onConfirm()}
          onCancel={() => setConfirm(null)}
        />
      )}
      <div className="cf-app">
        <div className="bg-grid" />
        <div className="bg-glow" />

        <div className="inner">
          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, marginBottom: 24, fontSize: 12, color: "#7a7a8e", flexWrap: "wrap" }}>
            <Link
              to="/my-calendars"
              style={{
                color: "#c8f09a",
                textDecoration: "none",
                background: "rgba(200,240,154,0.10)",
                border: "1px solid rgba(200,240,154,0.32)",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: ".02em",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              📅 My calendars
            </Link>
            <Link to="/schedule" style={{ color: "#7a7a8e", textDecoration: "none", padding: "6px 10px" }}>Schedule</Link>
            <Link to="/profile" style={{ color: "#7a7a8e", textDecoration: "none", padding: "6px 10px" }}>Profile</Link>
            <span style={{ color: "#3a3a50" }}>·</span>
            <span style={{ color: "#9a9aae", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</span>
            {autosaveStatus !== "idle" && (
              <span style={{ fontSize: 12, color: autosaveStatus === "error" ? "#e66" : "#9a9aae", marginLeft: 8 }}>
                {autosaveStatus === "saving" ? "Saving draft…" : autosaveStatus === "saved" ? "Draft saved" : "Draft save failed"}
              </span>
            )}
            <button onClick={async () => { await signOut(); navigate("/auth"); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#9a9aae", padding: "6px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>Sign out</button>
          </div>

          {/* BRAND */}
          <div className="brand">
            <div className="brand-eyebrow">AI content studio</div>
            <h1 className="brand-title">Content<em>Forge</em></h1>
            <div className="brand-sub">Generate a full week of platform-native posts for any niche — tailored to your voice, audience, and goals.</div>
          </div>

          <div className="hero-shell">
            <div className="hero-panel">
              <div className="hero-kicker">Guided creation workspace</div>
              <div className="hero-title">Build the calendar before the scroll ever starts.</div>
              <p className="hero-copy">The workflow below stays focused: define the brief, pick the topics, then generate and refine the calendar in one place. Autosave and recovery stay on so you can pick up where you left off.</p>
              <div className="hero-badges">
                <span className="hero-badge"><strong>{wizardStepLabel}</strong> step active</span>
                <span className="hero-badge"><strong>{wizardProgress}%</strong> through the flow</span>
                <span className="hero-badge"><strong>{posts.length || 0}</strong> posts ready</span>
                <span className="hero-badge"><strong>{recentCalendars.length}</strong> recent calendars</span>
              </div>
              <div className="hero-note">
                <strong>{autosaveLabel}</strong> · {wizardGuidance}
              </div>
              <div className="hero-linkrow">
                <Link to="/my-calendars" className="hero-link">Open saved calendars →</Link>
                <button type="button" className="hero-link" onClick={loadSample} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>See a sample calendar</button>
              </div>
            </div>

            <div className="hero-panel alt">
              <div className="hero-kicker">Current setup</div>
              <div className="hero-grid">
                <div className="hero-stat">
                  <span>Industry</span>
                  <strong>{selectedIndustry?.label || "Not picked"}</strong>
                </div>
                <div className="hero-stat">
                  <span>Platform</span>
                  <strong>{form.platform || "LinkedIn"}</strong>
                </div>
                <div className="hero-stat">
                  <span>Topics</span>
                  <strong>{form.topics.length}</strong>
                </div>
                <div className="hero-stat">
                  <span>Mode</span>
                  <strong>{form.mode === "day" ? "Single day" : "Full week"}</strong>
                </div>
              </div>
              <div className="hero-note">
                <strong>{form.audiences.length || 0}</strong> audiences selected · <strong>{form.goals.length || 0}</strong> goals active · <strong>{form.voice || "default voice"}</strong> voice
              </div>
            </div>
          </div>

          {/* STEPPER */}
          <div className="stepper">
            {STEP_LABELS.map((s, i) => (
              <div key={s} className={`snode ${i + 1 === step ? "on" : ""}`} role="button" tabIndex={0} onClick={() => setStep(i + 1)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setStep(i + 1); }}>
                <div className={`sdot ${i + 1 === step ? "active" : ""} ${i + 1 < step ? "done" : ""}`}>
                  {i + 1 < step ? <Check /> : i + 1}
                </div>
                <div className={`slabel ${i + 1 === step ? "active" : ""} ${i + 1 < step ? "done" : ""}`}>{s}</div>
              </div>
            ))}
          </div>

          {/* ── STEP 1 ── */}
          <div className={`screen ${step === 1 ? "active" : ""}`}>
            {recentCalendars.length > 0 && (
              <div className="recent-strip">
                <div className="recent-head">
                  <div className="recent-eyebrow">Pick up where you left off</div>
                  <Link to="/my-calendars" className="recent-link">View all →</Link>
                </div>
                <div className="recent-list">
                  {recentCalendars.map(rc => (
                    <div key={rc.id} className="recent-item">
                      <div className="recent-meta">
                        <div className="recent-title">{rc.title}</div>
                        <div className="recent-sub">
                          {rc.platform && <span className="recent-tag">{rc.platform}</span>}
                          {rc.industry_label && <span className="recent-tag">{rc.industry_label}</span>}
                          <span>{new Date(rc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="recent-actions">
                        <button
                          type="button"
                          className="recent-btn primary"
                          onClick={() => navigate(`/calendar/${rc.id}`)}
                        >
                          Open →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="try-sample">
              <button type="button" className="try-sample-btn" onClick={loadSample}>
                ✨ See an example calendar (no sign-up, no API call)
              </button>
            </div>
            <div className="card" ref={industryRef}>
              <div className="sh">What's your <span>industry / niche?</span></div>
              <div className="ind-grid" role="radiogroup" aria-label="Industry or niche">
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind.id}
                    type="button"
                    role="radio"
                    aria-checked={form.industry === ind.id}
                    className={`ind-card ${form.industry === ind.id ? "on" : ""}`}
                    onClick={() => setIndustry(ind.id)}
                  >
                    <div className="ind-icon" aria-hidden="true">{ind.icon}</div>
                    <div className="ind-label">{ind.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="sh">Your <span>platform & content</span></div>

              <div className="csect">
                <div className="flabel" id="cf-platform-label">Platform</div>
                <div className="plat-grid" role="radiogroup" aria-labelledby="cf-platform-label">
                  {PLATFORM_OPTIONS.map(pl => (
                    <button
                      key={pl.id}
                      type="button"
                      role="radio"
                      aria-checked={form.platform === pl.id}
                      className={`plat-card ${form.platform === pl.id ? "on" : ""}`}
                      onClick={() => upd("platform", pl.id)}
                    >
                      <div className="plat-name">{pl.label}</div>
                      <div className="plat-hint">{pl.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="csect">
                <SelectField
                  label="Content language"
                  options={["English", "Tamil"]}
                  value={form.language}
                  onChange={v => upd("language", v)}
                  hint="(choose the script the generated content should use)"
                />
              </div>

              <div className="csect" ref={coreIdeaRef}>
                <div className="flabel">Core idea / angle</div>
                <textarea rows={3} placeholder="What's the big idea or angle behind your content? e.g. 'helping early-stage SaaS founders ship better products faster'…" value={form.coreIdea} onChange={e => upd("coreIdea", e.target.value)} />
              </div>

              <div className="csect">
                <MultiSelect label="Target audience" hint="(pick up to 4)" options={audiencePool} value={form.audiences} onChange={v => upd("audiences", v)} placeholder={form.industry ? "Who are you writing for?" : "Select industry first"} max={4} />
              </div>

              <div className="g2">
                <SelectField label="Voice / tone" options={VOICE_OPTIONS} value={form.voice} onChange={v => upd("voice", v)} placeholder="Select a voice…" />
                <SelectField label="Writing style" options={STYLE_OPTIONS} value={form.style} onChange={v => upd("style", v)} placeholder="Select a style…" />
                <SelectField label="Copy style" options={COPY_STYLE_OPTIONS} value={form.copyStyle} onChange={v => upd("copyStyle", v)} placeholder="Keep plain text" hint="Applied when copying or scheduling" />
              </div>

              {(() => {
                const preview = getVoiceStylePreview(form.industry, form.voice, form.style);
                if (!preview) {
                  return (
                    <div className="vsp">
                      <div className="vsp-eyebrow">Live voice preview</div>
                      <div className="vsp-empty">Pick a voice and style above to see a 2-line sample of how your posts will sound — before you generate.</div>
                    </div>
                  );
                }
                return (
                  <div className="vsp">
                    <div className="vsp-eyebrow">
                      Live voice preview · {form.voice || "default voice"} × {form.style || "default style"}
                    </div>
                    <div className="vsp-hook">{preview.hook}</div>
                    <div className="vsp-tail">{preview.tail}</div>
                    {preview.stylePreset && (
                      <div className="vsp-tail" style={{ marginTop: 8, fontSize: 12, color: '#9a9aae', fontStyle: 'italic' }}>{preview.stylePreset}</div>
                    )}
                  </div>
                );
              })()}

              <div className="divider" />

              <div className="csect">
                <div className="flabel">Goal <span className="fhint">(pick all that apply)</span></div>
                <div className="chips">
                  {GOAL_OPTIONS.map(v => (
                    <div key={v} className={`chip ${form.goals.includes(v) ? "on" : ""}`} onClick={() => toggleChip("goals", v)}>{v}</div>
                  ))}
                </div>
              </div>
            </div>

            {error && <div className="err-box">{error}</div>}
            <div className="brow">
              <button className="btn btn-p" onClick={() => { if (validate(1)) { setError(""); setStep(2); } }}>Next step →</button>
            </div>
          </div>

          {/* ── STEP 2 ── */}
          <div className={`screen ${step === 2 ? "active" : ""}`}>
            <div className="card">
              <div className="sh">Pick your <span>{form.mode === "day" ? "single-day topic" : "weekly topics"}</span></div>

              {/* NEW: mode toggle */}
              <div className="csect">
                <div className="flabel">Generation mode</div>
                <div className="plat-grid" role="radiogroup" aria-label="Generation mode" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.mode === "week"}
                    className={`plat-card ${form.mode === "week" ? "on" : ""}`}
                    onClick={() => setForm(f => ({ ...f, mode: "week", topics: f.topics.slice(0, 7) }))}
                  >
                    <div className="plat-name">Full week</div>
                    <div className="plat-hint">7 posts, Mon → Sun</div>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={form.mode === "day"}
                    className={`plat-card ${form.mode === "day" ? "on" : ""}`}
                    onClick={() => setForm(f => ({ ...f, mode: "day", topics: f.topics.slice(0, 1) }))}
                  >
                    <div className="plat-name">Single day</div>
                    <div className="plat-hint">Just 1 post for a chosen date</div>
                  </button>
                </div>
              </div>

              {/* NEW: date picker (single-day mode only) */}
              {form.mode === "day" && (
                <div className="csect">
                  <div className="flabel">Date for this post</div>
                  <input
                    type="date"
                    className="date-input"
                    value={form.targetDate}
                    onChange={e => upd("targetDate", e.target.value)}
                  />
                  <div className="time-hint" style={{ marginTop: 6 }}>
                    Your post will be written for <strong style={{ color: "rgba(200,240,154,.85)" }}>{shortDateLabel(parseLocalDate(form.targetDate) || nextMonday())}</strong>.
                  </div>
                </div>
              )}

              <div className="csect" ref={topicsRef}>
                <MultiSelect
                  label={form.mode === "day" ? "Topic for this post" : "Topics to cover"}
                  hint={form.mode === "day" ? "(pick exactly 1)" : "(pick up to 7; fewer than 7 will be expanded into related angles)"}
                  options={topicPool.length > 0 ? topicPool : ["Add custom topics below ↓"]}
                  disabledOptions={topicPool.length > 0 ? [] : ["Add custom topics below ↓"]}
                  value={form.topics}
                  onChange={v => upd("topics", form.mode === "day" ? v.slice(-1) : v)}
                  placeholder={form.industry ? "Select topics…" : "Select industry first"}
                  max={form.mode === "day" ? 1 : 7}
                />
                <div className="add-row">
                  <input type="text" className="ti" placeholder="+ add a custom topic, press Enter or click Add"
                    value={customTopic}
                    onChange={e => setCustomTopic(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCustomTopic()} />
                  <button className="add-btn" onClick={addCustomTopic}>Add</button>
                </div>
              </div>

              {/* Inspiration Bank - Show trending topics for quick selection */}
              {form.industry && (
                <div className="csect">
                  <InspirationBank
                    industry={form.industry}
                    platform={form.platform}
                    onTopicClick={(topic) => {
                      const updated = form.mode === "day" ? [topic] : [...form.topics, topic];
                      if (updated.length <= (form.mode === "day" ? 1 : 7)) {
                        upd("topics", updated);
                      }
                    }}
                  />
                </div>
              )}

              <div className="divider" />

              <div className="g2" style={{ marginBottom: 16 }}>
                <SelectField label="Format mix" options={FORMAT_OPTIONS} value={form.format} onChange={v => upd("format", v)} />
                <SelectField label="CTA style" options={CTA_OPTIONS} value={form.cta} onChange={v => upd("cta", v)} />
              </div>

              <div className="csect">
                <div className="flabel" id="cf-length-label">Post length</div>
                <div className="plat-grid" role="radiogroup" aria-labelledby="cf-length-label">
                  {LENGTH_OPTIONS.filter(o => !(form.mode === "day" && o.id === "mixed")).map(o => (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={form.length === o.id}
                      className={`plat-card ${form.length === o.id ? "on" : ""}`}
                      onClick={() => upd("length", o.id)}
                    >
                      <div className="plat-name">{o.label}</div>
                      <div className="plat-hint">{o.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="csect">
                <div className="flabel" id="cf-structure-label">Structure <span className="fhint">(paragraphs vs bullets)</span></div>
                <div className="plat-grid" role="radiogroup" aria-labelledby="cf-structure-label">
                  {STRUCTURE_OPTIONS.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={form.structure === o.id}
                      className={`plat-card ${form.structure === o.id ? "on" : ""}`}
                      onClick={() => upd("structure", o.id)}
                    >
                      <div className="plat-name">{o.label}</div>
                      <div className="plat-hint">{o.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              {form.mode === "week" && (
                <div className="csect">
                  <div className="flabel">Week starting <span className="fhint">(used for dates + .ics export)</span></div>
                  <input
                    type="date"
                    className="date-input"
                    value={form.weekStart}
                    onChange={e => upd("weekStart", e.target.value)}
                  />
                  <div className="time-hint" style={{ marginTop: 6 }}>
                    Day 1 will be <strong style={{ color: "rgba(200,240,154,.85)" }}>{shortDateLabel(weekStartDate)}</strong>. Each post gets a day-specific default time — you can adjust per post on the next screen.
                  </div>
                </div>
              )}
              <div className="csect">
                <div className="flabel">Extra context <span className="fhint">(optional)</span></div>
                <textarea rows={2} placeholder="e.g. reference specific tools, frameworks, local market context, personal story hooks…" value={form.extra} onChange={e => upd("extra", e.target.value)} />
              </div>

              <div className="g2">
                <div>
                  <div className="flabel">Never say <span className="fhint">(comma-separated, hard ban)</span></div>
                  <input
                    type="text"
                    className="ti"
                    placeholder="e.g. game-changer, synergy, leverage"
                    value={form.bannedWords.join(", ")}
                    onChange={e => upd("bannedWords", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  />
                </div>
                <div>
                  <div className="flabel">Must mention <span className="fhint">(comma-separated, weave in)</span></div>
                  <input
                    type="text"
                    className="ti"
                    placeholder="e.g. our product name, RAG, India"
                    value={form.requiredWords.join(", ")}
                    onChange={e => upd("requiredWords", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="err-box">
                {error}
                {lastGenerationError && (
                  <div style={{ marginTop: '10px', fontSize: '12px', opacity: 0.8 }}>
                    <button
                      onClick={() => generate(true)}
                      disabled={isGenerating}
                      style={{
                        background: 'rgba(200,240,154,.2)',
                        border: '1px solid rgba(200,240,154,.3)',
                        color: '#c8f09a',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        cursor: isGenerating ? 'not-allowed' : 'pointer',
                        opacity: isGenerating ? 0.6 : 1,
                        fontSize: '12px',
                        fontFamily: '"Sora", sans-serif',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        if (!isGenerating) {
                          (e.target as HTMLButtonElement).style.background = 'rgba(200,240,154,.3)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLButtonElement).style.background = 'rgba(200,240,154,.2)';
                      }}
                    >
                      {isGenerating ? '⏳ Retrying...' : '🔄 Try again'}
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="brow">
              <button className="btn btn-g" onClick={() => { setError(""); setStep(1); }}>← Back</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-p" onClick={() => generate(false)} disabled={isGenerating} style={{ opacity: isGenerating ? 0.6 : 1, cursor: isGenerating ? 'not-allowed' : 'pointer' }}>{isGenerating ? `⏳ ${genMsg || 'Generating...'}` : (form.mode === "day" ? "Generate this post →" : "Generate my week →")}</button>
                <button className="btn btn-g" onClick={async () => {
                  if (!user) { toast.error('Sign in to save templates'); return; }
                  const name = window.prompt('Template name (short)');
                  if (!name || !name.trim()) return;
                  try {
                    const payload = { user_id: user.id, name: name.trim(), description: '', config: form };
                    const { error } = await supabase.from('templates').insert(payload).select();
                    if (error) throw error;
                    toast.success('Template saved');
                  } catch (e) {
                    toast.error(e?.message || 'Failed to save template');
                  }
                }}>Save as template</button>
              </div>
            </div>
          </div>

          {showSubtopicConfirm && (
            <Modal onClose={() => setShowSubtopicConfirm(false)} className="modal-content">
              <div className="sh">Your topic will be expanded into 7 posts</div>
              <div className="time-hint" style={{ marginTop: 8 }}>
                You selected fewer than 7 topics, so the remaining days will be filled with related angles.
              </div>
              <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                {subtopicPreview.map((topic, index) => (
                  <div key={index} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", color: "var(--text)" }}>
                    <strong style={{ color: "var(--accent)", marginRight: 8 }}>Day {index + 1}</strong>
                    {topic}
                  </div>
                ))}
              </div>
              <div className="brow" style={{ marginTop: 20 }}>
                <button className="btn btn-g" onClick={() => setShowSubtopicConfirm(false)}>Edit topics</button>
                <button className="btn btn-p" onClick={() => { setShowSubtopicConfirm(false); void generate(false, true); }}>Looks good, generate →</button>
              </div>
            </Modal>
          )}

          {/* ── STEP 3 ── */}
          <div className={`screen ${step === 3 ? "active" : ""}`}>
            <div className="gen-wrap">
              <div className="gen-orb">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.4">
                  <path d="M12 2l3 7.5L22 12l-7.5 3L12 22l-3-7.5L2 12l7.5-3z" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="gen-title">{form.mode === "day" ? "Writing your post" : "Writing your week"}</div>
              <div className="gen-msg">{genMsg}</div>
              <div className="prog-track">
                <div className="prog-indet" />
              </div>
              <div className="gen-checklist">
                {GEN_LABELS.map((l, i) => (
                  <div key={i} className={`gci ${i < genStep ? "done" : ""}`}>
                    <span className="gci-dot" />
                    {l}
                  </div>
                ))}
              </div>
              {/* Visual skeleton of calendar so users see expected output shape while waiting */}
              <div style={{ marginTop: 18 }}>
                {/* Lazy-load the skeleton to keep bundle small */}
                <Suspense fallback={null}>
                  <GenerateSkeleton />
                </Suspense>
              </div>
              <button
                onClick={cancelGeneration}
                style={{ marginTop: 24, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#7a7a8e", padding: "7px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "Sora, sans-serif" }}
              >
                Cancel and try again
              </button>
            </div>
          </div>

          {/* ── STEP 4 ── */}
          <div className={`screen ${step === 4 ? "active" : ""}`}>
            {posts.length > 0 && (
              <div className="step4-layout">
                <div className="step4-main">
                  <>
                {sampleMode && (
                  <div className="sample-banner">
                    <div className="sample-banner-text">
                      <strong>Sample calendar.</strong> This is a pre-baked example to show you the layout.
                      Save isn't available — start your own to keep results.
                    </div>
                    <button type="button" className="sample-cta" onClick={exitSample}>Start my own →</button>
                  </div>
                )}

                {!sampleMode && (
                  <div className="reformat-bar">
                    <span className="reformat-label">Reformat for</span>
                    <select
                      className="reformat-sel"
                      value={reformatTarget}
                      onChange={(e) => setReformatTarget(e.target.value)}
                      disabled={reformatting || regenIdx !== null}
                      aria-label="Choose another platform to reformat for"
                    >
                      <option value="">Another platform…</option>
                      {PLATFORM_OPTIONS.filter(po => po.id !== form.platform).map(po => (
                        <option key={po.id} value={po.id}>{po.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="reformat-btn"
                      disabled={!reformatTarget || reformatting || regenIdx !== null || !user}
                      onClick={() => reformatAllForPlatform(reformatTarget)}
                      title={!user ? "Sign in — saved as a new calendar" : "Re-runs all 7 posts; saved as a new calendar"}
                    >
                      {reformatting ? `Reformatting… ${regenIdx !== null ? `(${regenIdx + 1}/${posts.length})` : ""}` : `Reformat all ${posts.length} →`}
                    </button>
                    <span style={{ flex: 1 }} />
                    <button
                      type="button"
                      className="reformat-btn"
                      style={{ background: "transparent", color: "var(--text2)", borderColor: "var(--border2)" }}
                      disabled={reformatting || regenIdx !== null || lockedDays.size === posts.length}
                      onClick={regenerateUnlocked}
                      title="Re-roll only the days you haven't pinned"
                    >
                      ↻ Regenerate unlocked ({posts.length - lockedDays.size})
                    </button>
                  </div>
                )}

                {posts.length > 1 && (
                  <div className="week-strip" role="tablist" aria-label="Days of the week">
                    {posts.map((post, i) => (
                      <button
                        key={i}
                        type="button"
                        role="tab"
                        aria-selected={i === activeDay}
                        className={`dtab ${i === activeDay ? "on" : ""} ${lockedDays.has(post.day) ? "locked" : ""} ${draggedIndex === i ? "dragging" : ""}`}
                        onClick={() => setActiveDay(i)}
                        draggable
                        onDragStart={(e) => {
                          handleDragStart(e, i);
                          setDraggedIndex(i);
                        }}
                        onDragOver={handleDragOver}
                        onDrop={(e) => {
                          const sourcIdx = handleDrop(e, i);
                          if (sourcIdx !== null) {
                            handleDayDrop(sourcIdx, i);
                          }
                        }}
                        onDragEnd={() => setDraggedIndex(null)}
                        title="Drag to reorder days"
                      >
                        <div className="dtab-dow">{post.dow}</div>
                        <div className="dtab-n">{i + 1}</div>
                      </button>
                    ))}
                  </div>
                )}
                {p && (
                  <div>
                    <div className="pcard">
                    <div className="ph">
                      <div className="ptags">
                        <span className="ptag pt-day">Day {p.day} · {p.dow}</span>
                        <span className="ptag pt-date">{shortDateLabel(dateForDow(weekStartDate, p.dow))}</span>
                        <span className="ptag pt-topic">{p.topic}</span>
                        <span className="ptag pt-fmt">{formatBadgeForPlatform(p.format, form.platform)}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", position: "relative" }} ref={tweakOpenIdx === activeDay ? tweakRef : undefined}>
                        <button
                          type="button"
                          className={`pin-btn ${lockedDays.has(p.day) ? "on" : ""}`}
                          onClick={() => toggleLock(p.day)}
                          title={lockedDays.has(p.day) ? "Pinned — won't be touched by 'Regenerate unlocked'" : "Pin this post to protect it"}
                          aria-pressed={lockedDays.has(p.day)}
                        >
                          {lockedDays.has(p.day) ? "📌" : "📍"}
                        </button>
                        <button
                          className="cpbtn"
                          onClick={() => regenerateDay(activeDay)}
                          disabled={regenIdx !== null || reformatting}
                          title="Re-roll this single day without touching the other six"
                        >
                          {regenIdx === activeDay ? "Regenerating…" : "↻ Regenerate"}
                        </button>
                        <div className="tweak-wrap">
                          <button
                            className="cpbtn"
                            disabled={regenIdx !== null || reformatting}
                            onClick={() => setTweakOpenIdx(tweakOpenIdx === activeDay ? null : activeDay)}
                            aria-haspopup="menu"
                            aria-expanded={tweakOpenIdx === activeDay}
                            title="Quick tweaks that preserve the angle"
                          >
                            ⚡ Tweak ▾
                          </button>
                          {tweakOpenIdx === activeDay && (
                            <div className="tweak-menu" role="menu">
                              <button className="tweak-opt" onClick={() => regenerateDay(activeDay, "shorter")}>Make shorter</button>
                              <button className="tweak-opt" onClick={() => regenerateDay(activeDay, "punchier")}>Make punchier</button>
                              <button className="tweak-opt" onClick={() => regenerateDay(activeDay, "add-stat")}>Add a stat</button>
                              <button
                                className="tweak-opt"
                                onClick={() => regenerateDay(activeDay, "remove-emoji")}
                                disabled={!hasEmoji(posts[activeDay].title + " " + posts[activeDay].hook + " " + posts[activeDay].body + " " + posts[activeDay].cta)}
                                title={!hasEmoji(posts[activeDay].title + " " + posts[activeDay].hook + " " + posts[activeDay].body + " " + posts[activeDay].cta) ? "No emoji detected" : "Remove emojis from this post"}
                              >
                                Remove emoji
                              </button>
                              <button className="tweak-opt" onClick={() => regenerateDay(activeDay, "clean-formatting")}>Clean formatting symbols</button>
                              <button className="tweak-opt" onClick={() => regenerateDay(activeDay, "more-personal")}>More personal</button>
                            </div>
                          )}
                        </div>
                        {(() => {
                          const niceLabel = niceLabelFor(form.platform);
                          const f = formatForPlatform(posts[activeDay], form.platform, { style: getClipboardStyle() });
                          const ratio = f.charCount / f.limit;
                          const budgetCls = f.charCount > f.limit ? "over" : ratio >= 0.9 ? "warn" : "";
                          return (
                            <>
                              <span
                                className={`budget ${budgetCls}`}
                                title={`Post-format length for ${niceLabel}`}
                                aria-label={`${f.charCount} of ${f.limit} characters used for ${niceLabel}`}
                              >
                                <span className="budget-dot" aria-hidden="true" />
                                {f.charCount.toLocaleString()} / {f.limit.toLocaleString()}
                              </span>
                              <div className="copy-split" ref={copyMenuOpen ? copyMenuRef : undefined}>
                                <button
                                  className={`cpbtn copy-split-main ${copiedIdx === activeDay ? "done" : ""}`}
                                  onClick={() => copyPost(activeDay)}
                                  title={`${f.charCount} / ${f.limit} chars`}
                                >
                                  {copiedIdx === activeDay ? "Copied ✓" : `Copy for ${niceLabel}`}
                                </button>
                                <button
                                  type="button"
                                  className="copy-split-caret"
                                  onClick={() => setCopyMenuOpen(o => !o)}
                                  aria-haspopup="menu"
                                  aria-expanded={copyMenuOpen}
                                  aria-label="More copy options"
                                >
                                  ▾
                                </button>
                                {copyMenuOpen && (
                                  <div className="copy-menu" role="menu">
                                    <button
                                      type="button"
                                      className="copy-menu-opt"
                                      onClick={async () => {
                                        const ok = await writeToClipboard(buildRawMarkdown(posts[activeDay]));
                                        setCopyMenuOpen(false);
                                        if (ok) toast.success("Copied raw markdown ✓");
                                        else toast.error("Could not copy");
                                      }}
                                    >
                                      Copy as raw markdown
                                    </button>
                                    <button
                                      type="button"
                                      className="copy-menu-opt"
                                      onClick={async () => {
                                        const ok = await writeToClipboard(postText(posts[activeDay]));
                                        setCopyMenuOpen(false);
                                        if (ok) toast.success("Copied as plain text ✓");
                                        else toast.error("Could not copy");
                                      }}
                                    >
                                      Copy as plain text (no formatting)
                                    </button>
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="time-row">
                      <span className="time-label">Post time</span>
                      <input
                        type="time"
                        className="time-input"
                        value={postTimes[String(p.day)] || suggestedTimeForDay(p.day)}
                        onChange={e => setPostTimes(prev => ({ ...prev, [String(p.day)]: e.target.value }))}
                      />
                      <span className="time-hint">{shortDateLabel(dateForDow(weekStartDate, p.dow))} at {postTimes[String(p.day)] || suggestedTimeForDay(p.day)}</span>
                    </div>

                    <div className="ptitle" style={{ marginTop: 18 }}>{p.title}</div>

                    <div className="blabel">Hook</div>
                    <div className="hook-block"><div className="hook-text">{p.hook}</div></div>

                    <div className="blabel">Post body</div>
                    <div className="body-text">{p.body}</div>

                    <div className="blabel">CTA</div>
                    <div className="cta-block">{p.cta}</div>

                    <div className="blabel">Hashtags</div>
                    <div className="htags">{p.hashtags}</div>

                    <div className="blabel" style={{ marginTop: 16 }}>Why this works</div>
                    <button
                      type="button"
                      className="restart"
                      onClick={() => setShowRationale(v => !v)}
                      style={{ marginTop: 0 }}
                    >
                      {showRationale ? "Hide reasoning ↑" : "See why this works →"}
                    </button>
                    {showRationale && <div className="rationale">{p.rationale}</div>}

                    <PerformanceScoreCard post={p} topic={form.coreIdea} />
                    <div style={{ marginTop: 12 }}>
                      <PostInsights post={p} platform={form.platform} topic={form.coreIdea} />
                    </div>
                  </div>

                  <ToneConsistencyChecker posts={posts} />
                  </div>
                )}

                <div className="bbar">
                  <button className="restart" onClick={() => { clearDraft(); setPostsWithHistory([]); setActiveDay(0); setSavedId(null); setLockedDays(new Set()); setSampleMode(false); setStep(1); setError(""); }}>← Start over</button>
                  <button className="restart" onClick={() => { setError(""); setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ marginLeft: 8 }}>✎ Edit inputs</button>
                  <div className="bactions">
                    <button className="dlbtn" onClick={saveCalendar} disabled={saving || !!savedId || sampleMode} title={sampleMode ? "Sample mode — start your own to save" : ""}>
                      {sampleMode ? "Save (sample only)" : savedId ? "Saved ✓" : saving ? "Saving…" : "Save calendar"}
                    </button>
                    <button className="dlbtn" onClick={downloadTxt}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6.5 1v7M4 5.5l2.5 2.5L9 5.5M1 9.5v1A1.5 1.5 0 002.5 12h8A1.5 1.5 0 0012 10.5v-1" />
                      </svg>
                      .txt
                    </button>
                    <button
                      className="dlbtn"
                      onClick={() => {
                        try {
                          downloadMd({
                            title: form.coreIdea.slice(0, 80) || `${selectedIndustry?.label || "Calendar"} — ${form.platform}`,
                            industryLabel: selectedIndustry?.label,
                            platform: form.platform,
                            coreIdea: form.coreIdea,
                          }, posts, { style: getClipboardStyle() });
                          toast.success("Downloaded .md ✓");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Download .md failed");
                        }
                      }}
                    >
                      .md
                    </button>
                    <button
                      className="dlbtn"
                      onClick={() => {
                        try {
                          downloadPdf({
                            title: form.coreIdea.slice(0, 80) || `${selectedIndustry?.label || "Calendar"} — ${form.platform}`,
                            industryLabel: selectedIndustry?.label,
                            platform: form.platform,
                            coreIdea: form.coreIdea,
                          }, posts);
                          toast.success("Downloaded .pdf ✓");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Download .pdf failed");
                        }
                      }}
                    >
                      .pdf
                    </button>
                    <button className="dlbtn" onClick={() => { try { exportIcs(); toast.success("Downloaded .ics ✓"); } catch (e) { toast.error(e instanceof Error ? e.message : "Download .ics failed"); } }} title="Export to Google Calendar / Outlook / Apple Cal">
                      📅 .ics
                    </button>
                    <button
                      className="dlbtn"
                      onClick={() => setBatchEditOpen(true)}
                      title="Apply brand mention, hashtag, or CTA to all 7 posts at once (Ctrl+Shift+E)"
                    >
                      ⚙️ Batch edit
                    </button>
                    <button className="btn btn-p" style={{ fontSize: 13 }} onClick={copyAll}>
                      {copiedAll ? "All copied ✓" : `Copy all 7 for ${niceLabelFor(form.platform)}`}
                    </button>
                  </div>
                </div>
              </>
                </div>
                <div className="step4-side">
                  {/* Toggle buttons for Summary / Performance */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <button
                      className={`cpbtn ${!showPerformance ? "done" : ""}`}
                      onClick={() => setShowPerformance(false)}
                      style={{ flex: 1, textAlign: "center" }}
                      title="Week summary and stats"
                    >
                      Week Summary
                    </button>
                    <button
                      className={`cpbtn ${showPerformance ? "done" : ""}`}
                      onClick={() => setShowPerformance(true)}
                      style={{ flex: 1, textAlign: "center" }}
                      title="Performance score for current post"
                      disabled={!posts[activeDay]}
                    >
                      Performance
                    </button>
                  </div>

                  {!showPerformance ? (
                    <div className="summary-card">
                      <div className="summary-head">
                        <div>
                          <div className="sh" style={{ marginBottom: 6 }}>Week at a glance</div>
                          <div className="time-hint">A fast read before you copy, tweak, or save.</div>
                        </div>
                        <div className="summary-stat">
                          <b>{weekSummary.totalPosts}</b>
                          <span>Posts</span>
                        </div>
                      </div>
                      <div className="summary-list">
                        <div className="summary-row"><span>Average length</span><strong>{weekSummary.avgChars} chars</strong></div>
                        <div className="summary-row"><span>Within platform limit</span><strong>{weekSummary.withinLimitPct}%</strong></div>
                        <div className="summary-row"><span>Hashtags per post</span><strong>{weekSummary.hashtagCounts.length ? weekSummary.hashtagCounts.join(" · ") : "—"}</strong></div>
                      </div>
                      <div className="summary-meta">
                        {Object.entries(weekSummary.formatCounts).slice(0, 4).map(([label, count]) => (
                          <span key={label} className="summary-pill">{count} {label.toLowerCase()}</span>
                        ))}
                      </div>
                      <div className="summary-list" style={{ marginTop: 14 }}>
                        {weekSummary.postingTimes.map(slot => (
                          <div key={slot.day} className="summary-row">
                            <span>Day {slot.day} · {slot.dow}</span>
                            <strong>{slot.time}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : posts[activeDay] ? (
                    <>
                      <PerformanceScoreCard post={posts[activeDay]} topic={form.coreIdea} />
                      <div style={{ marginTop: 12 }}>
                        <PostInsights post={posts[activeDay]} platform={form.platform} topic={form.coreIdea} />
                      </div>
                    </>
                  ) : null}

                  {posts[activeDay] && (
                    <div className="li-preview">
                      <div className="li-head">
                        <div className="li-avatar">{(selectedIndustry?.label || form.platform || "C").slice(0, 1)}</div>
                        <div>
                          <div className="li-name">{selectedIndustry?.label || "ContentForge"}</div>
                          <div className="li-meta">{niceLabelFor(form.platform)} preview</div>
                        </div>
                        <div className="li-dot" />
                      </div>
                      <div className="li-body">
                        {(() => {
                          const previewSource = [posts[activeDay].title, posts[activeDay].hook, posts[activeDay].body, posts[activeDay].cta].join("\n\n");
                          const previewPlain = stripMarkdown(previewSource);
                          return (
                            <>
                              <div className="li-content">{renderLinkedInPreviewText(previewSource)}</div>
                              {previewPlain.length > 210 && <><div className="li-fade" /><div className="li-more">See more</div></>}
                            </>
                          );
                        })()}
                      </div>
                      <div className="li-tags">
                        {posts[activeDay].hashtags.split(/\s+/).filter(Boolean).map(tag => <span key={tag} className="li-tag">{tag}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Batch Edit Modal */}
        <BatchEditModal
          isOpen={batchEditOpen}
          onClose={() => setBatchEditOpen(false)}
          onApply={applyBatchEdit}
          totalPosts={posts.length}
          currentPlatform={form.platform}
        />

        {/* Diff View Modal */}
        {diffViewData && (
          <DiffView
            before={diffViewData.before}
            after={diffViewData.after}
            onAccept={() => {
              // Accept the change: apply the new post
              setPostsWithHistory(prev => prev.map((p, i) => (i === diffViewData.dayIndex ? diffViewData.newPost : p)));
              setPostsWithHistory(prev => prev.map((p, i) => (i === diffViewData.dayIndex ? diffViewData.newPost : p)));
              setSavedId(null);
              setDiffViewData(null);
              toast.success(`Day ${posts[diffViewData.dayIndex].day} updated`);
            }}
            onReject={() => {
              // Reject: do not apply the change
              setDiffViewData(null);
              toast.info(`Changes discarded for Day ${posts[diffViewData.dayIndex].day}`);
            }}
            title={`Review changes for Day ${posts[diffViewData.dayIndex].day}`}
          />
        )}

        {/* Keyboard Shortcuts Help (visible on Step 4) */}
        {step === 4 && (
          <div style={{ position: "fixed", bottom: 16, left: 16, fontSize: 10, color: "var(--text3)", zIndex: 999, maxWidth: 200 }}>
            <div style={{ opacity: 0.7 }}>
              <strong>Quick shortcuts:</strong><br/>
              Ctrl+Z = Undo | Ctrl+Y = Redo<br/>
              Ctrl+Shift+E = Batch edit<br/>
              Drag days to reorder
            </div>
          </div>
        )}

        {(step === 1 || step === 2) && (
          <button
            className="btn btn-p"
            style={{ position: "fixed", right: 24, bottom: 28, zIndex: 950, padding: "12px 18px", borderRadius: 12 }}
            onClick={() => generate(false)}
            disabled={isGenerating}
            aria-hidden="true"
            tabIndex={-1}
          >
            {isGenerating ? `⏳ ${genMsg || "Generating..."}` : (form.mode === "day" ? "Generate this post →" : "Generate my week →")}
          </button>
        )}
      </div>
    </WorkspacePage>
  );
};

export default Index;
