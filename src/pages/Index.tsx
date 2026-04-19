import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  other: [],
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
  min-height: 100vh; background: var(--bg); color: var(--text);
  position: relative; overflow-x: hidden;
  font-family: 'Sora', sans-serif; -webkit-font-smoothing: antialiased;
}

.cf-app .bg-grid { position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(200,240,154,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(200,240,154,0.018) 1px,transparent 1px);
  background-size:52px 52px; }
.cf-app .bg-glow { position:fixed;width:700px;height:700px;border-radius:50%;
  background:radial-gradient(circle,rgba(200,240,154,0.035) 0%,transparent 65%);
  pointer-events:none;top:-300px;left:50%;transform:translateX(-50%);z-index:0; }

.cf-app .inner { position:relative;z-index:1;max-width:700px;margin:0 auto;padding:52px 24px 100px; }

.cf-app .brand { margin-bottom:52px; }
.cf-app .brand-eyebrow { font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);font-weight:500;margin-bottom:12px;display:flex;align-items:center;gap:8px; }
.cf-app .brand-eyebrow::before { content:'';display:block;width:22px;height:1px;background:var(--accent); }
.cf-app .brand-title { font-family:'Playfair Display',serif;font-size:38px;font-weight:400;color:var(--text);letter-spacing:-.5px;line-height:1.08;margin:0; }
.cf-app .brand-title em { font-style:italic;color:var(--accent); }
.cf-app .brand-sub { font-size:13px;color:var(--text2);margin-top:10px;font-weight:300;line-height:1.65;max-width:480px; }

.cf-app .stepper { display:flex;align-items:center;margin-bottom:44px; }
.cf-app .snode { display:flex;align-items:center;gap:7px; }
.cf-app .sdot { width:26px;height:26px;border-radius:50%;border:1px solid var(--border2);background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text3);font-weight:600;transition:all .25s;flex-shrink:0; }
.cf-app .sdot.done { background:var(--adim);border-color:rgba(200,240,154,.5);color:var(--accent); }
.cf-app .sdot.active { background:var(--accent);border-color:var(--accent);color:#07080d; }
.cf-app .slabel { font-size:11px;color:var(--text3);letter-spacing:.04em;font-weight:400;transition:color .25s;white-space:nowrap; }
.cf-app .slabel.active { color:var(--text2); } .cf-app .slabel.done { color:rgba(200,240,154,.6); }
.cf-app .sline { flex:1;height:1px;background:var(--border);margin:0 8px;min-width:8px; }
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
.cf-app .ind-card { border:1px solid var(--border);border-radius:var(--r-md);padding:14px 10px;cursor:pointer;text-align:center;background:var(--bg);transition:all .15s; }
.cf-app .ind-card:hover { border-color:var(--border2);background:var(--surface2); }
.cf-app .ind-card.on { border-color:rgba(200,240,154,.35);background:var(--adim); }
.cf-app .ind-icon { font-size:20px;margin-bottom:6px;line-height:1; }
.cf-app .ind-label { font-size:11px;color:var(--text2);font-weight:400;line-height:1.3; }
.cf-app .ind-card.on .ind-label { color:var(--accent); }

.cf-app .plat-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:8px; }
.cf-app .plat-card { border:1px solid var(--border);border-radius:var(--r-md);padding:12px 10px;cursor:pointer;background:var(--bg);transition:all .15s; }
.cf-app .plat-card:hover { border-color:var(--border2); }
.cf-app .plat-card.on { border-color:rgba(200,240,154,.38);background:var(--adim); }
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
.cf-app .ms-tag { background:var(--adim);border:1px solid rgba(200,240,154,.22);color:var(--accent);border-radius:5px;padding:2px 7px;font-size:11px;font-weight:400;display:flex;align-items:center;gap:4px; }
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
.cf-app .prog-track { width:240px;height:2px;background:var(--surface3);border-radius:99px;overflow:hidden;margin:0 auto; }
.cf-app .prog-fill { height:100%;background:var(--accent);border-radius:99px;transition:width .45s ease; }
.cf-app .gen-checklist { margin-top:28px;display:flex;flex-direction:column;gap:7px;align-items:flex-start;max-width:260px; }
.cf-app .gci { font-size:12px;color:var(--text3);display:flex;align-items:center;gap:8px;font-weight:300;transition:color .3s; }
.cf-app .gci.done { color:var(--accent); }
.cf-app .gci-dot { width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0; }

.cf-app .week-strip { display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:18px; }
.cf-app .dtab { padding:10px 4px;border-radius:var(--r-sm);border:1px solid var(--border);text-align:center;cursor:pointer;background:var(--surface);transition:all .15s; }
.cf-app .dtab:hover { border-color:var(--border2); }
.cf-app .dtab.on { background:var(--adim);border-color:rgba(200,240,154,.32); }
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

.cf-app .bbar { display:flex;justify-content:space-between;align-items:center;margin-top:16px;gap:10px;flex-wrap:wrap; }
.cf-app .bactions { display:flex;gap:8px;align-items:center; }
.cf-app .restart { font-size:12px;color:var(--text3);cursor:pointer;background:none;border:none;font-family:'Sora',sans-serif;transition:color .15s; }
.cf-app .restart:hover { color:var(--text2); }
.cf-app .dlbtn { display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:var(--r-sm);border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:13px;font-family:'Sora',sans-serif;cursor:pointer;transition:all .15s;font-weight:400; }
.cf-app .dlbtn:hover { border-color:rgba(200,240,154,.22);color:var(--accent); }

.cf-app .sh { font-family:'Playfair Display',serif;font-size:16px;font-weight:400;color:var(--text);margin-bottom:16px;line-height:1.3; }
.cf-app .sh span { font-style:italic;color:var(--accent); }

@media(max-width:560px){
  .cf-app .ind-grid{grid-template-columns:repeat(3,1fr);}
  .cf-app .plat-grid{grid-template-columns:repeat(2,1fr);}
  .cf-app .g2{grid-template-columns:1fr;}
  .cf-app .inner{padding:36px 16px 80px;}
  .cf-app .brand-title{font-size:30px;}
  .cf-app .stepper .slabel{display:none;}
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
        <select className="sel" value={value} onChange={e => onChange(e.target.value)}>
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
}

function MultiSelect({ label, options, value, onChange, placeholder, max = 6, hint }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (v: string) => {
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
              <span key={v} className="ms-tag">
                {v}
                <span className="ms-x" onClick={e => { e.stopPropagation(); toggle(v); }}>×</span>
              </span>
            ))}
          <span className="ms-caret"><Caret /></span>
        </div>
        {open && (
          <div className="ms-drop">
            {options.map(o => (
              <div key={o} className={`ms-opt ${value.includes(o) ? "sel" : ""}`} onClick={() => toggle(o)}>
                {o}
                <span className="ms-chk">{value.includes(o) && <Check />}</span>
              </div>
            ))}
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
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

const Index = () => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    industry: "",
    platform: "LinkedIn",
    coreIdea: "",
    audiences: [] as string[],
    voice: "",
    style: "",
    goals: ["Awareness", "Engagement"] as string[],
    topics: [] as string[],
    format: "Balanced mix",
    cta: "Share & repost bait",
    length: "medium",
    structure: "mixed",
    extra: "",
  });
  const [customTopic, setCustomTopic] = useState("");
  const [extraTopics, setExtraTopics] = useState<string[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeDay, setActiveDay] = useState(0);
  const [progress, setProgress] = useState(0);
  const [genMsg, setGenMsg] = useState("");
  const [genStep, setGenStep] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const progRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const upd = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));
  const toggleChip = (k: "goals", v: string) =>
    setForm(f => ({ ...f, [k]: f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v] }));

  const setIndustry = (id: string) => {
    setForm(f => ({ ...f, industry: id, topics: [], audiences: [] }));
    setExtraTopics([]);
  };

  const selectedIndustry = INDUSTRIES.find(i => i.id === form.industry);
  const topicPool = form.industry ? [...(INDUSTRY_TOPICS[form.industry] || []), ...extraTopics] : [...extraTopics];
  const audiencePool = form.industry ? (AUDIENCE_PRESETS[form.industry] || AUDIENCE_PRESETS.other) : AUDIENCE_PRESETS.other;

  function addCustomTopic() {
    const v = customTopic.trim();
    if (!v || topicPool.includes(v)) return;
    setExtraTopics(p => [...p, v]);
    setForm(f => ({ ...f, topics: [...f.topics, v] }));
    setCustomTopic("");
  }

  function validate(s: number) {
    if (s === 1) {
      if (!form.industry) { setError("Please select your industry / niche."); return false; }
      if (!form.coreIdea.trim()) { setError("Please describe your core idea."); return false; }
    }
    if (s === 2 && form.topics.length === 0) { setError("Please select at least 1 topic."); return false; }
    setError(""); return true;
  }

  const GEN_MSGS = ["Analysing your niche…", "Mapping topics to days…", "Writing hooks…", "Drafting post bodies…", "Adding CTAs & hashtags…"];
  const GEN_LABELS = ["Niche analysis", "Topic mapping", "Hook writing", "Body drafting", "CTA & hashtags"];

  async function generate() {
    if (!validate(2)) return;
    setStep(3); setProgress(0); setGenStep(0); setGenMsg(GEN_MSGS[0]);

    let pct = 0, mi = 0;
    progRef.current = setInterval(() => {
      pct = Math.min(pct + 2, 90);
      setProgress(Math.round(pct));
      const ni = Math.min(Math.floor(pct / 20), GEN_MSGS.length - 1);
      if (ni > mi) { mi = ni; setGenMsg(GEN_MSGS[ni]); setGenStep(ni); }
    }, 200);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-calendar", {
        body: {
          industry: form.industry,
          industryLabel: selectedIndustry?.label || form.industry,
          platform: form.platform,
          coreIdea: form.coreIdea,
          audiences: form.audiences,
          voice: form.voice,
          style: form.style,
          goals: form.goals,
          topics: form.topics,
          format: form.format,
          cta: form.cta,
          length: form.length,
          structure: form.structure,
          extra: form.extra,
        },
      });

      if (progRef.current) clearInterval(progRef.current);

      if (fnError) {
        setStep(2);
        setError(fnError.message || "Failed to generate calendar.");
        return;
      }
      if (data?.error) {
        setStep(2);
        setError(data.error);
        return;
      }

      const result: Post[] = Array.isArray(data?.posts) ? data.posts : [];
      if (result.length === 0) { setStep(2); setError("Empty response. Please try again."); return; }

      setProgress(100); setGenStep(5);
      setPosts(result); setActiveDay(0);
      setTimeout(() => setStep(4), 450);
    } catch (err) {
      if (progRef.current) clearInterval(progRef.current);
      setStep(2);
      setError(`Connection error: ${err instanceof Error ? err.message : "Unknown"}`);
    }
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
    try { document.execCommand("copy"); cb && cb(); } catch (e) { console.error(e); }
    document.body.removeChild(ta);
  }

  function postText(p: Post) {
    return `${p.title}\n\n${p.hook}\n\n${p.body}\n\n${p.cta}\n\n${p.hashtags}`;
  }

  function copyPost(i: number) {
    copyText(postText(posts[i]), () => { setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); });
  }
  function copyAll() {
    const all = posts.map(p => `=== Day ${p.day} — ${p.dow} | ${p.topic} ===\n${postText(p)}`).join("\n\n\n");
    copyText(all, () => { setCopiedAll(true); setTimeout(() => setCopiedAll(false), 2000); });
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
  }

  const STEP_LABELS = ["Industry", "Topics", "Generate", "Calendar"];
  const p = posts[activeDay];

  return (
    <>
      <style>{css}</style>
      <div className="cf-app">
        <div className="bg-grid" />
        <div className="bg-glow" />

        <div className="inner">
          {/* HEADER */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14, marginBottom: 24, fontSize: 12, color: "#7a7a8e" }}>
            <Link to="/my-calendars" style={{ color: "#7a7a8e", textDecoration: "none" }}>My calendars</Link>
            <span style={{ color: "#3a3a50" }}>·</span>
            <span style={{ color: "#7a7a8e" }}>{user?.email}</span>
            <button onClick={async () => { await signOut(); navigate("/auth"); }} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#7a7a8e", padding: "5px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "Sora, sans-serif" }}>Sign out</button>
          </div>

          {/* BRAND */}
          <div className="brand">
            <div className="brand-eyebrow">AI content studio</div>
            <h1 className="brand-title">Content<em>Forge</em></h1>
            <div className="brand-sub">Generate a full week of platform-native posts for any niche — tailored to your voice, audience, and goals.</div>
          </div>

          {/* STEPPER */}
          <div className="stepper">
            {STEP_LABELS.map((s, i) => (
              <div key={s} className="snode" style={{ flexShrink: 0 }}>
                <div className="snode">
                  <div className={`sdot ${i + 1 === step ? "active" : ""} ${i + 1 < step ? "done" : ""}`}>
                    {i + 1 < step ? <Check /> : i + 1}
                  </div>
                  <div className={`slabel ${i + 1 === step ? "active" : ""} ${i + 1 < step ? "done" : ""}`}>{s}</div>
                </div>
                {i < STEP_LABELS.length - 1 && <div className={`sline ${i + 1 < step ? "done" : ""}`} style={{ flex: 1, minWidth: 8 }} />}
              </div>
            ))}
          </div>

          {/* ── STEP 1 ── */}
          <div className={`screen ${step === 1 ? "active" : ""}`}>
            <div className="card">
              <div className="sh">What's your <span>industry / niche?</span></div>
              <div className="ind-grid">
                {INDUSTRIES.map(ind => (
                  <div key={ind.id} className={`ind-card ${form.industry === ind.id ? "on" : ""}`} onClick={() => setIndustry(ind.id)}>
                    <div className="ind-icon">{ind.icon}</div>
                    <div className="ind-label">{ind.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="sh">Your <span>platform & content</span></div>

              <div className="csect">
                <div className="flabel">Platform</div>
                <div className="plat-grid">
                  {PLATFORM_OPTIONS.map(pl => (
                    <div key={pl.id} className={`plat-card ${form.platform === pl.id ? "on" : ""}`} onClick={() => upd("platform", pl.id)}>
                      <div className="plat-name">{pl.label}</div>
                      <div className="plat-hint">{pl.hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="csect">
                <div className="flabel">Core idea / angle</div>
                <textarea rows={3} placeholder="What's the big idea or angle behind your content? e.g. 'helping early-stage SaaS founders ship better products faster'…" value={form.coreIdea} onChange={e => upd("coreIdea", e.target.value)} />
              </div>

              <div className="csect">
                <MultiSelect label="Target audience" hint="(pick up to 4)" options={audiencePool} value={form.audiences} onChange={v => upd("audiences", v)} placeholder={form.industry ? "Who are you writing for?" : "Select industry first"} max={4} />
              </div>

              <div className="g2">
                <SelectField label="Voice / tone" options={VOICE_OPTIONS} value={form.voice} onChange={v => upd("voice", v)} placeholder="Select a voice…" />
                <SelectField label="Writing style" options={STYLE_OPTIONS} value={form.style} onChange={v => upd("style", v)} placeholder="Select a style…" />
              </div>

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
              <div className="sh">Pick your <span>weekly topics</span></div>
              <div className="csect">
                <MultiSelect
                  label="Topics to cover"
                  hint="(pick up to 7 — 1 per day)"
                  options={topicPool.length > 0 ? topicPool : ["Add custom topics below"]}
                  value={form.topics}
                  onChange={v => upd("topics", v)}
                  placeholder={form.industry ? "Select topics…" : "Select industry first"}
                  max={7}
                />
                <div className="add-row">
                  <input type="text" className="ti" placeholder="+ add a custom topic, press Enter or click Add"
                    value={customTopic}
                    onChange={e => setCustomTopic(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCustomTopic()} />
                  <button className="add-btn" onClick={addCustomTopic}>Add</button>
                </div>
              </div>

              <div className="divider" />

              <div className="g2" style={{ marginBottom: 16 }}>
                <SelectField label="Format mix" options={FORMAT_OPTIONS} value={form.format} onChange={v => upd("format", v)} />
                <SelectField label="CTA style" options={CTA_OPTIONS} value={form.cta} onChange={v => upd("cta", v)} />
              </div>

              <div className="csect">
                <div className="flabel">Post length</div>
                <div className="plat-grid">
                  {LENGTH_OPTIONS.map(o => (
                    <div key={o.id} className={`plat-card ${form.length === o.id ? "on" : ""}`} onClick={() => upd("length", o.id)}>
                      <div className="plat-name">{o.label}</div>
                      <div className="plat-hint">{o.hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="csect">
                <div className="flabel">Structure <span className="fhint">(paragraphs vs bullets)</span></div>
                <div className="plat-grid">
                  {STRUCTURE_OPTIONS.map(o => (
                    <div key={o.id} className={`plat-card ${form.structure === o.id ? "on" : ""}`} onClick={() => upd("structure", o.id)}>
                      <div className="plat-name">{o.label}</div>
                      <div className="plat-hint">{o.hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="csect">
                <div className="flabel">Extra context <span className="fhint">(optional)</span></div>
                <textarea rows={2} placeholder="e.g. reference specific tools, frameworks, local market context, personal story hooks…" value={form.extra} onChange={e => upd("extra", e.target.value)} />
              </div>
            </div>

            {error && <div className="err-box">{error}</div>}
            <div className="brow">
              <button className="btn btn-g" onClick={() => { setError(""); setStep(1); }}>← Back</button>
              <button className="btn btn-p" onClick={generate}>Generate my week →</button>
            </div>
          </div>

          {/* ── STEP 3 ── */}
          <div className={`screen ${step === 3 ? "active" : ""}`}>
            <div className="gen-wrap">
              <div className="gen-orb">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.4">
                  <path d="M12 2l3 7.5L22 12l-7.5 3L12 22l-3-7.5L2 12l7.5-3z" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="gen-title">Writing your week</div>
              <div className="gen-msg">{genMsg}</div>
              <div className="prog-track">
                <div className="prog-fill" style={{ width: progress + "%" }} />
              </div>
              <div className="gen-checklist">
                {GEN_LABELS.map((l, i) => (
                  <div key={i} className={`gci ${i < genStep ? "done" : ""}`}>
                    <span className="gci-dot" />
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── STEP 4 ── */}
          <div className={`screen ${step === 4 ? "active" : ""}`}>
            {posts.length > 0 && (
              <>
                <div className="week-strip">
                  {posts.map((post, i) => (
                    <div key={i} className={`dtab ${i === activeDay ? "on" : ""}`} onClick={() => setActiveDay(i)}>
                      <div className="dtab-dow">{post.dow}</div>
                      <div className="dtab-n">{i + 1}</div>
                    </div>
                  ))}
                </div>

                {p && (
                  <div className="pcard">
                    <div className="ph">
                      <div className="ptags">
                        <span className="ptag pt-day">Day {p.day} · {p.dow}</span>
                        <span className="ptag pt-topic">{p.topic}</span>
                        <span className="ptag pt-fmt">{p.format}</span>
                      </div>
                      <button className={`cpbtn ${copiedIdx === activeDay ? "done" : ""}`} onClick={() => copyPost(activeDay)}>
                        {copiedIdx === activeDay ? "Copied ✓" : "Copy post"}
                      </button>
                    </div>

                    <div className="ptitle">{p.title}</div>

                    <div className="blabel">Hook</div>
                    <div className="hook-block"><div className="hook-text">{p.hook}</div></div>

                    <div className="blabel">Post body</div>
                    <div className="body-text">{p.body}</div>

                    <div className="blabel">CTA</div>
                    <div className="cta-block">{p.cta}</div>

                    <div className="blabel">Hashtags</div>
                    <div className="htags">{p.hashtags}</div>

                    <div className="blabel" style={{ marginTop: 16 }}>Why this works</div>
                    <div className="rationale">{p.rationale}</div>
                  </div>
                )}

                <div className="bbar">
                  <button className="restart" onClick={() => { setPosts([]); setActiveDay(0); setStep(1); setError(""); }}>← Start over</button>
                  <div className="bactions">
                    <button className="dlbtn" onClick={downloadTxt}>
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6.5 1v7M4 5.5l2.5 2.5L9 5.5M1 9.5v1A1.5 1.5 0 002.5 12h8A1.5 1.5 0 0012 10.5v-1" />
                      </svg>
                      Download .txt
                    </button>
                    <button className="btn btn-p" style={{ fontSize: 13 }} onClick={copyAll}>
                      {copiedAll ? "All copied ✓" : "Copy all 7"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Index;
