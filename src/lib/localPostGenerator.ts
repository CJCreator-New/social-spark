export interface LocalGenerationInput {
  industry: string;
  industryLabel?: string;
  platform: string;
  language?: string;
  coreIdea: string;
  audiences: string[];
  voice?: string;
  style?: string;
  goals: string[];
  topics: string[];
  format: string;
  cta: string;
  length: string;
  structure: string;
  extra?: string;
  bannedWords: string[];
  requiredWords: string[];
  bannedHashtags?: string[];
  requiredHashtags?: string[];
  targetTopic?: string;
  targetDow?: string;
}

export interface GeneratedPost {
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
  image_prompt: string;
  hook_options: string[];
  cta_options: string[];
}

const DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_ANGLES = [
  "the core problem",
  "a practical framework",
  "a common mistake",
  "a realistic example",
  "the numbers behind it",
  "what to do next",
  "the bigger lesson",
];

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

function distributeTopicsAcrossWeek(topics: string[]): string[] {
  const uniqueTopics = uniq(topics);
  if (uniqueTopics.length === 0) {
    return ["your topic"];
  }

  if (uniqueTopics.length <= 7) {
    return Array.from(
      { length: 7 },
      (_, index) =>
        uniqueTopics[index] || uniqueTopics[index % uniqueTopics.length] || uniqueTopics[0]
    );
  }

  const buckets = Array.from({ length: 7 }, () => [] as string[]);
  uniqueTopics.forEach((topic, index) => {
    buckets[index % 7].push(topic);
  });

  return buckets.map((bucket) => bucket.join(" + "));
}

function toTag(value: string): string {
  const clean = String(value || "")
    .replace(/^#+/, "")
    .replace(/[^\w]/g, "")
    .toLowerCase();
  return clean ? `#${clean}` : "";
}

function isLongForm(platform: string): boolean {
  const s = String(platform || "").toLowerCase();
  return s.includes("newsletter") || s.includes("blog");
}

function platformHashtags(input: LocalGenerationInput, topic: string): string {
  if (isLongForm(input.platform)) return "";
  const base = uniq([
    input.industry,
    input.industryLabel || input.industry,
    ...topic.split(/\s+/),
    ...(input.requiredHashtags || []),
  ])
    .map(toTag)
    .filter(Boolean);
  const banned = new Set((input.bannedHashtags || []).map((t) => toTag(t).toLowerCase()));
  const out: string[] = [];
  for (const tag of base) {
    const key = tag.toLowerCase();
    if (out.length >= 4) break;
    if (!tag || banned.has(key) || out.some((v) => v.toLowerCase() === key)) continue;
    out.push(tag);
  }
  return out.join(" ");
}

function titleFor(topic: string, angle: string, platform: string): string {
  const suffix =
    platform === "LinkedIn"
      ? "for professionals"
      : platform === "Twitter/X"
        ? "in 60 seconds"
        : "that lands";
  return `${topic} — ${angle} ${suffix}`;
}

function hookFor(topic: string, angle: string, voice: string): string {
  if (/question/i.test(voice))
    return `Why does ${topic} keep tripping people up? Because most teams skip ${angle}.`;
  if (/data|analytical|technical/i.test(voice))
    return `${topic} gets misread when teams ignore ${angle}. The result is slower growth and noisier decisions.`;
  return `${topic} works best when you focus on ${angle} instead of the hype.`;
}

function bodyFor(
  input: LocalGenerationInput,
  topic: string,
  angle: string,
  length: string,
  structure: string
): string {
  const audience = input.audiences[0] || "the audience";
  const idea = input.coreIdea || input.industryLabel || input.industry || "this topic";
  const baseParagraphs = [
    `For ${audience}, ${topic} is less about theory and more about making a clear decision around ${angle}.`,
    `When you connect it back to ${idea}, the practical win is easier to see: fewer guesses, clearer next steps, and better follow-through.`,
    input.extra
      ? input.extra
      : `A simple way to start is to pick one metric, one action, and one audience signal to test this week.`,
  ];

  if (/bullet/i.test(structure)) {
    return [
      `${topic} is easier to use when you break it into three parts:`,
      `• ${angle}`,
      `• the decision it supports`,
      `• the action you can take this week`,
      `That framing keeps the content practical for ${audience}.`,
    ].join("\n");
  }

  if (length === "long") {
    return (
      baseParagraphs.join("\n\n") +
      `\n\nThe point is not to sound clever. The point is to make the next step obvious.`
    );
  }

  if (length === "short") {
    return `${baseParagraphs[0]} ${baseParagraphs[1]}`;
  }

  return baseParagraphs.slice(0, 2).join("\n\n");
}

function ctaOptionsFor(topic: string): string[] {
  return uniq([
    `What’s your take on ${topic}?`,
    `Would you approach ${topic} differently?`,
    `Share this with someone working on ${topic}.`,
  ]);
}

function rationaleFor(topic: string, angle: string, platform: string): string {
  return `${platform} readers respond to specific, useful framing. This version keeps ${topic} tied to ${angle}, gives the post a clear point of view, and ends with an easy next action.`;
}

function imagePromptFor(input: LocalGenerationInput, topic: string, angle: string): string {
  const audience = input.audiences[0] || "the audience";
  const idea = input.coreIdea || input.industryLabel || input.industry || topic;
  const platform = input.platform || "social";
  const aspectRatio = /x|twitter/i.test(platform)
    ? "16:9"
    : /story|reel|tiktok/i.test(platform)
      ? "9:16"
      : "4:5";
  const mood = /data|analytical|technical/i.test(
    String(input.voice || "") + " " + String(input.style || "")
  )
    ? "sharp, high-contrast, precise"
    : /warm|friendly|human/i.test(String(input.voice || "") + " " + String(input.style || ""))
      ? "warm, cinematic, emotionally grounded"
      : "dramatic, polished, and editorial";

  return [
    `Cinematic key art inspired by ${topic} and the idea of ${idea}.`,
    `Create a single, high-end film still that speaks to ${audience} without showing text overlays, UI panels, or infographic elements.`,
    `Art direction: ${mood}, premium editorial photography, realistic depth, layered foreground and background detail, subtle motion, and a sense of scale.`,
    `Lighting: dramatic but controlled, with strong directional light, soft rim light, realistic shadows, and a polished contrast curve.`,
    `Composition: ${angle} as the visual anchor, off-center framing, leading lines, clear focal hierarchy, and shallow depth of field.`,
    `Color palette: rich cinematic tones with deep shadows, accent highlights, and a restrained palette that feels luxurious rather than noisy.`,
    `Atmosphere: dust, haze, glow, texture, and quiet tension that make the scene feel alive and immersive.`,
    `Quality guardrails: no watermark, no collage, no generic stock-photo look, no clutter, no flat lighting, no text in the image. Aspect ratio ${aspectRatio}.`,
  ].join(" ");
}

function normalizeTopic(value: string, fallback: string): string {
  const trimmed = String(value || "").trim();
  return trimmed || fallback;
}

export function generateLocalPosts(input: LocalGenerationInput): GeneratedPost[] {
  const baseTopics = input.topics.length
    ? input.topics
    : [
        input.targetTopic ||
          input.coreIdea ||
          input.industryLabel ||
          input.industry ||
          "your topic",
      ];
  const effectiveTopics = distributeTopicsAcrossWeek(baseTopics);

  return effectiveTopics.map((rawTopic, index) => {
    const day = index + 1;
    const dow = DOWS[index] || input.targetDow || "Mon";
    const topic = normalizeTopic(rawTopic, input.targetTopic || input.coreIdea || "your topic");
    const angle = DAY_ANGLES[index] || `a useful angle`;
    const title = titleFor(topic, angle, input.platform);
    const hook = hookFor(topic, angle, input.voice || "");
    const body = bodyFor(input, topic, angle, input.length || "medium", input.structure || "mixed");
    const hashtags = platformHashtags(input, topic);

    return {
      day,
      dow,
      topic,
      format: `${input.format || "Balanced mix"} — ${input.structure || "mixed"}`,
      title,
      hook,
      body,
      cta: ctaOptionsFor(topic)[0],
      hashtags,
      rationale: rationaleFor(topic, angle, input.platform),
      image_prompt: imagePromptFor(input, topic, angle),
      hook_options: uniq([
        hook,
        `Most people get ${topic} wrong by skipping ${angle}.`,
        `If you only remember one thing about ${topic}, make it this: ${angle}.`,
      ]),
      cta_options: ctaOptionsFor(topic),
    };
  });
}
