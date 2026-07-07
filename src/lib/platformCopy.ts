// Platform-ready copy formatter. Turns a generated post into clipboard-ready
// text matching each network's conventions. No markdown, no leftover hashes.

export type PlatformKey = "facebook" | "instagram" | "linkedin" | "twitter" | "tiktok";

export const PLATFORM_LIMITS: Record<PlatformKey, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  twitter: 280,
  tiktok: 2200,
};

export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "X",
  tiktok: "TikTok",
};

export interface PostLike {
  title?: string;
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string | string[];
}

export interface FormattedCopy {
  text: string;
  charCount: number;
  truncated: boolean;
  limit: number;
  platform: PlatformKey;
  platformLabel: string;
}

// Map a free-form platform string (from the wizard / saved calendar) to a key.
// Falls back to facebook (most permissive) for newsletter / blog / unknown.
export function resolvePlatform(input?: string | null): PlatformKey {
  const s = (input || "").toLowerCase();
  if (s.includes("linkedin")) return "linkedin";
  if (s.includes("instagram") || s === "ig") return "instagram";
  if (
    s.includes("twitter") ||
    s.includes("x/") ||
    s === "x" ||
    s.startsWith("x ") ||
    s.includes("/x")
  )
    return "twitter";
  if (s.includes("facebook") || s === "fb") return "facebook";
  if (s.includes("tiktok") || s === "tt") return "tiktok";
  return "facebook";
}

// Friendly label for buttons / chips ("X" instead of "Twitter").
export function niceLabelFor(input?: string | null): string {
  return PLATFORM_LABELS[resolvePlatform(input)];
}

export function stripMarkdown(input: string): string {
  if (!input) return "";
  let s = input;
  // Code fences and inline code
  s = s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "").trim());
  s = s.replace(/`([^`]+)`/g, "$1");
  // Bold / italic / strike
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?;:]|$)/g, "$1$2");
  s = s.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?;:]|$)/g, "$1$2");
  s = s.replace(/~~([^~]+)~~/g, "$1");
  // Links: [text](url) -> text (url)  ; bare ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
  // Headings, blockquotes, list bullets at line starts
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  s = s.replace(/^\s{0,3}[-*+]\s+/gm, "• ");
  s = s.replace(/^\s{0,3}\d+\.\s+/gm, (m) => m.trim() + " ");
  // HR
  s = s.replace(/^\s*([-*_])\1{2,}\s*$/gm, "");
  return s;
}

function tidy(input: string): string {
  return input
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function normalizeHashtags(input: string | string[] | undefined, max: number): string[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input.join(" ") : input;
  const parts = raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t.replace(/^#+/, "")}`))
    .map((t) => t.replace(/[^#\w]/g, ""))
    .filter((t) => t.length > 1);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of parts) {
    const k = tag.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

// Break body into chunks of 1–2 sentences (LinkedIn breathing room).
function breakSentences(body: string): string {
  const cleaned = stripMarkdown(body || "").trim();
  if (!cleaned) return "";
  // Preserve user's existing paragraph breaks
  const paragraphs = cleaned.split(/\n{2,}/);
  return paragraphs
    .map((para) => {
      const sentences = para.match(/[^.!?]+[.!?]+(?:["')\]]+)?|\S[^.!?]*$/g) || [para];
      const grouped: string[] = [];
      for (let i = 0; i < sentences.length; i += 2) {
        grouped.push(
          sentences
            .slice(i, i + 2)
            .join(" ")
            .trim()
        );
      }
      return grouped.filter(Boolean).join("\n\n");
    })
    .join("\n\n");
}

function buildLinkedIn(post: PostLike): string {
  const hook = stripMarkdown(post.hook || "").trim();
  const body = breakSentences(post.body || "");
  const cta = stripMarkdown(post.cta || "").trim();
  const tags = normalizeHashtags(post.hashtags, 5).join(" ");
  return tidy([hook, body, cta, tags].filter(Boolean).join("\n\n"));
}

function buildInstagram(post: PostLike): string {
  const hook = stripMarkdown(post.hook || "").trim();
  const body = stripMarkdown(post.body || "").trim();
  const cta = stripMarkdown(post.cta || "").trim();
  const tags = normalizeHashtags(post.hashtags, 15).join(" ");
  const main = [hook, body].filter(Boolean).join("\n\n");
  const separator = "⠀\n⠀\n.\n.\n.";
  const blocks = [main, cta, tags ? `${separator}\n${tags}` : ""].filter(Boolean);
  return tidy(blocks.join("\n\n"));
}

function buildFacebook(post: PostLike): string {
  const hook = stripMarkdown(post.hook || "").trim();
  const body = stripMarkdown(post.body || "").trim();
  const cta = stripMarkdown(post.cta || "").trim();
  const tags = normalizeHashtags(post.hashtags, 3).join(" ");
  return tidy([hook, body, cta, tags].filter(Boolean).join("\n\n"));
}

function buildTwitter(post: PostLike): { text: string; truncated: boolean } {
  const limit = PLATFORM_LIMITS.twitter;
  const hook = stripMarkdown(post.hook || "").trim();
  const body = stripMarkdown(post.body || "")
    .trim()
    .replace(/\s*\n+\s*/g, " ");
  const cta = stripMarkdown(post.cta || "").trim();
  const tags = normalizeHashtags(post.hashtags, 2);

  const condensed = tidy([hook, body, cta].filter(Boolean).join(" ")).replace(/\s+/g, " ").trim();
  const tagSuffix = tags.length ? ` ${tags.join(" ")}` : "";

  let text = `${condensed}${tagSuffix}`;
  let truncated = false;
  if (text.length > limit) {
    truncated = true;
    // Try to keep at least one hashtag if possible
    const reserve = tagSuffix.length;
    if (reserve > 0 && reserve < limit - 20) {
      const room = limit - reserve - 1; // 1 for ellipsis
      const trimmedBody = condensed.slice(0, Math.max(0, room)).replace(/\s+\S*$/, "");
      text = `${trimmedBody}…${tagSuffix}`;
    } else {
      const trimmed = text.slice(0, limit - 1).replace(/\s+\S*$/, "");
      text = `${trimmed}…`;
    }
  }
  return { text, truncated };
}

import { FontStyle, applyStyle } from "./unicodeFonts";

export function formatForPlatform(
  post: PostLike,
  platformInput?: string | null,
  options?: { style?: FontStyle }
): FormattedCopy {
  const platform = resolvePlatform(platformInput);
  const limit = PLATFORM_LIMITS[platform];
  const platformLabel = PLATFORM_LABELS[platform];

  let text = "";
  let truncated = false;

  switch (platform) {
    case "linkedin":
      text = buildLinkedIn(post);
      break;
    case "instagram":
      text = buildInstagram(post);
      break;
    case "tiktok":
      text = buildFacebook(post); // Reuse general clean paragraph structure for TikTok description
      break;
    case "twitter": {
      const r = buildTwitter(post);
      text = r.text;
      truncated = r.truncated;
      break;
    }
    case "facebook":
    default:
      text = buildFacebook(post);
      break;
  }

  // Soft check for non-twitter platforms
  if (!truncated && text.length > limit) {
    truncated = true;
    text = text.slice(0, limit - 1).replace(/\s+\S*$/, "") + "…";
  }

  // Apply unicode styling if requested
  if (options?.style && options.style !== FontStyle.None) {
    try {
      text = applyStyle(text, options.style);
    } catch {
      // noop on failure — fall back to plain text
    }
  }

  return {
    text,
    charCount: text.length,
    truncated,
    limit,
    platform,
    platformLabel,
  };
}

// Raw markdown / unformatted dump — useful when pasting into Notion, Buffer,
// or anywhere the user wants to keep the original structure & headings.
export function buildRawMarkdown(post: PostLike): string {
  const parts: string[] = [];
  if (post.title) parts.push(`# ${post.title}`);
  if (post.hook) parts.push(`> ${String(post.hook).replace(/\n/g, "\n> ")}`);
  if (post.body) parts.push(String(post.body));
  if (post.cta) parts.push(`**CTA:** ${post.cta}`);
  const tags = Array.isArray(post.hashtags) ? post.hashtags.join(" ") : post.hashtags || "";
  if (tags.trim()) parts.push(tags.trim());
  return parts.join("\n\n").trim();
}

// Convenience: copy text to clipboard with a graceful execCommand fallback.
export async function writeToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0;";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}
