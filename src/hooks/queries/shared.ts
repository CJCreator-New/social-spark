import { getE2EAuthFlag } from "@/lib/e2eFixtures";
import type { Database } from "@/integrations/supabase/types";

export function isE2EMode() {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    window.localStorage.getItem(getE2EAuthFlag()) === "true"
  );
}

type Tables = Database["public"]["Tables"];
export type SavedCalendarRow = Tables["saved_calendars"]["Row"];
export type SavedCalendarInsert = Tables["saved_calendars"]["Insert"];
export type SavedCalendarUpdate = Tables["saved_calendars"]["Update"];
export type ProfileRow = Tables["profiles"]["Row"];
export type SavedCalendarListItem = Pick<
  SavedCalendarRow,
  | "id"
  | "title"
  | "industry_label"
  | "platform"
  | "core_idea"
  | "created_at"
  | "is_favorite"
  | "posts"
>;
export type RecentCalendarItem = {
  id: string;
  title: string;
  platform: string | null;
  industry_label: string | null;
  created_at: string;
  is_favorite?: boolean;
};
export type SavedCalendarsCursor = { created_at: string; id: string } | null;

export type GeneratedPostPayload = {
  day?: number;
  dow?: string;
  topic?: string;
  format?: string;
  title?: string;
  hook?: string;
  body?: string;
  cta?: string;
  hashtags?: string;
  rationale?: string;
  image_prompt?: string;
  [key: string]: unknown;
};

export type RepurposePayload = {
  post: GeneratedPostPayload;
  targetPlatform: string;
  platform?: string;
  context?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ExtractedIdea = {
  title: string;
  format: string;
  rationale: string;
  key_points: string;
};

export type ExtractIdeasPayload = {
  source: string;
  count: number;
  platform?: string;
  [key: string]: unknown;
};

export type GeneratePostImagePayload = {
  calendarId: string;
  postDay: number;
  post: GeneratedPostPayload;
  prompt: string;
  platform?: string;
  aspectRatio?: string;
};

export type InlineRewritePayload = {
  text: string;
  instruction: string;
  field: "title" | "hook" | "body" | "cta";
  platform?: string;
  post?: GeneratedPostPayload;
  context?: Record<string, unknown>;
};

export type GeneratedResponse<T> = { post?: T; rewrittenText?: string };
