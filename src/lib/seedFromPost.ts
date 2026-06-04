import { Post } from "@/components/wizard/constants";

export interface WizardFormSeed {
  coreIdea: string;
  topic?: string;
  format?: string;
  platform?: string;
}

/**
 * Creates a derivative seed from a post.
 */
export function createSeedFromPost(post: Post, platform?: string): WizardFormSeed {
  // Clean hook to make a readable prompt prefix
  const cleanHook = (post.hook || "")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .trim();
  const truncated = cleanHook.length > 80 ? cleanHook.slice(0, 80) + "..." : cleanHook;
  const coreIdea = truncated ? `Build on this: "${truncated}"` : `Build on topic: ${post.topic}`;
  
  return {
    coreIdea,
    topic: post.topic,
    format: post.format,
    platform: platform || post.platform || "LinkedIn",
  };
}

/**
 * Stores the seed in localStorage.
 */
export function storeSeed(seed: WizardFormSeed, userId?: string): void {
  if (typeof window === "undefined") return;
  const key = `ss:wizard_seed:${userId || "guest"}`;
  try {
    window.localStorage.setItem(key, JSON.stringify(seed));
  } catch (e) {
    console.warn("Failed to store wizard seed", e);
  }
}

/**
 * Reads and clears seed from localStorage.
 */
export function readAndClearSeed(userId?: string): WizardFormSeed | null {
  if (typeof window === "undefined") return null;
  const key = `ss:wizard_seed:${userId || "guest"}`;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      window.localStorage.removeItem(key);
      return JSON.parse(raw) as WizardFormSeed;
    }
  } catch (e) {
    console.warn("Failed to read wizard seed", e);
  }
  return null;
}
