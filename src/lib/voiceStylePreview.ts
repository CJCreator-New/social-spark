// Static 2-line preview samples for tone × structure combinations.
// Pure lookup, no API calls. Used on Step 1 to prevent wasted generations.

const INDUSTRY_OPENERS: Record<string, Record<string, string>> = {
  tech: {
    "Technical & analytical":
      "Most teams measure velocity wrong. Story points without cycle-time context are vanity metrics.",
    "Conversational & warm":
      "Okay, real talk: I rebuilt this dashboard three times before it clicked. Here's what I'd do differently.",
    "PM / product thinking":
      "We shipped the feature nobody asked for, and adoption tripled. Here's what the roadmap missed.",
    "Opinionated & bold":
      "Stop running standups. They're a tax on your senior engineers and a crutch for poor planning.",
    "Data-driven":
      "We analysed 10,400 sign-ups across 6 months. The activation gap wasn't onboarding — it was day 7.",
    "Storytelling-first":
      "It was 11pm on a Tuesday when our biggest customer churned. The post-mortem changed how we hire.",
  },
  health: {
    "Technical & analytical":
      "The real health gap isn't motivation. It's that patients don't get one clear next step after a visit.",
    "Conversational & warm":
      "A lot of people think they need a perfect routine. Usually they just need a smaller one they can repeat.",
    "PM / product thinking":
      "If healthcare is the product, then the first 5 minutes of every patient journey matter more than the brochure.",
    "Opinionated & bold":
      "Wellness advice fails when it asks people to be disciplined before it becomes practical.",
    "Data-driven":
      "When we looked at adherence data, the pattern was obvious: clarity beats complexity every time.",
    "Storytelling-first":
      "One follow-up message changed the way a patient used the care plan. The lesson was bigger than the inbox.",
  },
  finance: {
    "Technical & analytical":
      "Compounding works best when the system is boring. Most portfolios fail because the process is emotional, not mathematical.",
    "Conversational & warm":
      "I used to think investing was about picking winners. It turned out to be about avoiding obvious mistakes.",
    "PM / product thinking":
      "The best fintech products don't feel like finance. They feel like less friction.",
    "Opinionated & bold":
      "If your financial advice only works for rich people, it's not advice — it's decoration.",
    "Data-driven":
      "A small change in saving rate does more long-term damage than most people realise.",
    "Storytelling-first":
      "I made one money mistake that took three years to unwind. The fix was embarrassingly simple.",
  },
  default: {
    "Technical & analytical":
      "Most teams measure the wrong signal first. The real bottleneck usually shows up one step earlier.",
    "Conversational & warm":
      "Okay, real talk: I tried this three different ways before the simpler version finally worked.",
    "PM / product thinking":
      "The roadmaps that win are the ones that stay focused on the user problem, not the internal debate.",
    "Opinionated & bold":
      "Stop optimizing for appearances. Optimize for whether the result actually changes behaviour.",
    "Data-driven":
      "The numbers didn't prove what we expected. They proved what was already happening.",
    "Storytelling-first":
      "It started with one awkward conversation and ended with a complete change in direction.",
  },
};

const STYLE_TAILS: Record<string, { kind: "para" | "bullets"; lines: string[] }> = {
  "Short punchy lines": {
    kind: "para",
    lines: ["No fluff. No throat-clearing. Just the thing that matters."],
  },
  "Long-form narrative": {
    kind: "para",
    lines: [
      "What followed was six months of slow, deliberate rebuilding — and a quieter kind of confidence I didn't know I needed.",
    ],
  },
  "Lists & frameworks": {
    kind: "bullets",
    lines: ["• Define the constraint", "• Measure the slack", "• Re-design around the bottleneck"],
  },
  "Thread-style breakdown": {
    kind: "bullets",
    lines: [
      "1/ The premise everyone gets wrong",
      "2/ What the data actually shows",
      "3/ The one shift that changes everything →",
    ],
  },
  "Stats-led": {
    kind: "para",
    lines: [
      "73% of teams skip this step. The 27% who don't ship 2.4x more often. The math is uncomfortable.",
    ],
  },
  "Case study format": {
    kind: "para",
    lines: [
      "Company: a Series A SaaS. Problem: 11% MoM churn. Fix: one onboarding email. Result: churn at 4% in eight weeks.",
    ],
  },
  "Question-led": {
    kind: "para",
    lines: ["So what would you actually do differently if you knew your roadmap was wrong by Q3?"],
  },
  "First-person story": {
    kind: "para",
    lines: [
      "I almost quit that morning. Then I opened the dashboard, saw one number move, and stayed for another year.",
    ],
  },
  "Industry insight": {
    kind: "para",
    lines: [
      "The shift from feature-led to outcome-led product orgs isn't coming. It's already restructuring how the best teams hire.",
    ],
  },
  "Myth-busting": {
    kind: "bullets",
    lines: [
      "Myth: more meetings → better alignment.",
      "Reality: alignment is a writing problem, not a meeting problem.",
    ],
  },
  "How-to guide": {
    kind: "bullets",
    lines: [
      "Step 1: write the one-pager",
      "Step 2: read it out loud",
      "Step 3: cut everything that doesn't survive",
    ],
  },
  "Behind-the-scenes": {
    kind: "para",
    lines: [
      "Here's the messy version: three Slack threads, one whiteboard photo, and a 2am voice note that became the actual decision.",
    ],
  },
};

const STYLE_PRESETS: Record<string, string> = {
  "Short punchy lines":
    "Keep every sentence short; use strong verbs and quick rhythms — ideal for scroll-stopping social posts.",
  "Long-form narrative":
    "Write an arc: setup, friction, resolution, and a reflective takeaway — suitable for blog excerpts or long captions.",
  "Lists & frameworks":
    "Organize around steps or frameworks; use numbered points or bullets that are immediately actionable.",
  "Thread-style breakdown":
    "Structure as sequenced beats: thesis, evidence, implication, and a concise close for threaded formats.",
  "Stats-led":
    "Lead with a concrete statistic or metric, then interpret it briefly; cite plausibility, avoid invented claims.",
  "Case study format":
    "Frame as Situation → Action → Result → Lesson with concrete outcomes and a clear lesson.",
  "Question-led":
    "Open with a provocative question, then answer it with concise evidence and a suggested action.",
  "First-person story":
    "Tell a brief personal anecdote that reveals a lesson; keep it human, specific, and relatable.",
  "Industry insight":
    "Offer a field note or trend observation with supporting detail and implications for the reader.",
  "Myth-busting":
    "Call out a common myth, then rebut with concise evidence and the correct perspective.",
  "How-to guide":
    "Give step-by-step instructions with clear outcomes and the minimal context needed to act.",
  "Behind-the-scenes":
    "Reveal process details, decisions, and failure points — make it candid and instructive.",
};

export interface VoiceStylePreview {
  hook: string;
  tail: string;
  isBullets: boolean;
  stylePreset?: string;
}

export function getVoiceStylePreview(
  industry: string,
  voice: string,
  style: string
): VoiceStylePreview | null {
  if (!voice && !style) return null;
  const industryKey = (industry || "").toLowerCase();
  const openerSet = INDUSTRY_OPENERS[industryKey] || INDUSTRY_OPENERS.default;
  const hook = openerSet[voice] || openerSet["Conversational & warm"];
  const styleEntry = STYLE_TAILS[style] || STYLE_TAILS["Short punchy lines"];
  const stylePreset = STYLE_PRESETS[style] || "";
  return {
    hook,
    tail: styleEntry.lines.join("\n"),
    isBullets: styleEntry.kind === "bullets",
    stylePreset,
  };
}
