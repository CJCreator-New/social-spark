import { FontStyle } from "@/lib/unicodeFonts";
import { toDateInputValue, nextMonday } from "@/lib/calendarSchedule";

export interface Post {
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
  image_prompt?: string;
  hook_options?: string[];
  cta_options?: string[];
  variant_scores?: Record<string, number>[];
  chosen_index?: number;
  [key: string]: any;
}

export interface WizardForm {
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
  quality?: "draft" | "polished";
}

export interface BrandMemory {
  voice: string;
  style: string;
  copyStyle: string;
  cta: string;
  audiences: string[];
  goals: string[];
  bannedWords: string[];
  requiredWords: string[];
  updatedAt: number;
}

export interface WizardDraftSnapshot {
  savedAt: number;
  form: WizardForm;
  step: number;
  extraTopics: string[];
  posts: Post[];
  activeDay: number;
  postTimes: Record<string, string>;
}

export const INDUSTRIES = [
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

export const INDUSTRY_TOPICS: Record<string, string[]> = {
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

export const PLATFORM_OPTIONS = [
  { id: "LinkedIn", label: "LinkedIn", hint: "Professional long-form" },
  { id: "Twitter/X", label: "Twitter / X", hint: "Short punchy threads" },
  { id: "Instagram", label: "Instagram", hint: "Visual + caption" },
  { id: "Facebook", label: "Facebook", hint: "Community & stories" },
  { id: "Newsletter", label: "Newsletter", hint: "Email-first content" },
  { id: "Blog", label: "Blog / SEO", hint: "Long-form articles" },
];

export const AUDIENCE_PRESETS: Record<string, string[]> = {
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

export const VOICE_OPTIONS = ["Technical & analytical", "Conversational & warm", "PM / product thinking", "Opinionated & bold", "Data-driven", "Storytelling-first", "Educational & clear", "Contrarian / challenger", "Founder POV", "Academic & research-backed", "Humorous & witty", "Inspirational & motivating"];
export const STYLE_OPTIONS = ["Short punchy lines", "Long-form narrative", "Lists & frameworks", "Thread-style breakdown", "Stats-led", "Case study format", "Question-led", "First-person story", "Industry insight", "Myth-busting", "How-to guide", "Behind-the-scenes"];
export const FORMAT_OPTIONS = ["Balanced mix", "Storytelling-led", "Data & insights", "How-it-works", "Opinion / POV", "List posts", "Interviews & Q&A", "Case studies"];
export const CTA_OPTIONS = ["Share & repost bait", "Spark comments & debate", "Drive to profile / newsletter", "Collect leads", "Build community", "No hard CTA"];
export const COPY_STYLE_OPTIONS = ["None", "Bold serif", "Italic", "Bold italic", "Monospace", "Sans-serif bold"];

export const COPY_STYLE_MAP: Record<string, FontStyle> = {
  None: FontStyle.None,
  "Bold serif": FontStyle.BoldSerif,
  Italic: FontStyle.Italic,
  "Bold italic": FontStyle.BoldItalic,
  Monospace: FontStyle.Monospace,
  "Sans-serif bold": FontStyle.SansSerifBold,
};

export const GOAL_OPTIONS = ["Awareness", "Engagement", "Drive traffic", "Lead generation", "Thought leadership", "Community building", "Sales & conversion"];

export const LENGTH_OPTIONS = [
  { id: "short", label: "Short", hint: "80–120 words" },
  { id: "medium", label: "Medium", hint: "160–230 words" },
  { id: "long", label: "Long", hint: "280–380 words" },
  { id: "mixed", label: "Mixed lengths", hint: "Vary across the week" },
];

export const STRUCTURE_OPTIONS = [
  { id: "paragraphs", label: "Paragraphs only", hint: "Flowing prose" },
  { id: "bullets", label: "Bullet points only", hint: "Scannable lists" },
  { id: "mixed", label: "Mix of both", hint: "Paragraphs + bullets" },
  { id: "perPost", label: "Per-post best fit", hint: "AI picks per topic" },
];

export const EMPTY_POST: Post = {
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

export const INITIAL_FORM: WizardForm = {
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
  quality: "draft",
};

export const DRAFT_VERSION = 1;
export const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const WIZARD_DRAFT_PREFIX = "draft:wizard:";
export const WIZARD_SERVER_DRAFT_TABLE = "wizard_drafts";
export const BRAND_MEMORY_PREFIX = "brand-memory:wizard:";
