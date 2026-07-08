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

// `idea_backlog` row shape from
// supabase/migrations/20260709000000_create_idea_backlog.sql. Not present in
// the generated Supabase types yet (no CLI access to run
// `supabase gen types typescript --linked` in this environment), so the
// table name is cast at the query site (`supabase.from("idea_backlog" as any)`)
// following the same pattern already used for other pre-codegen tables (see
// src/components/InspirationBank.tsx's `trends` table, src/pages/Admin.tsx's
// `admin_payments`/`api_key_audit_log` tables).
// TODO(follow-up): once `supabase gen types typescript --linked` can be run,
// regenerate src/integrations/supabase/types.ts and remove this manual
// interface + the `as any` / `as unknown as` casts in
// src/hooks/queries/useIdeaBacklogQueries.ts in favor of the generated
// Database["public"]["Tables"]["idea_backlog"] Row/Insert types.
export interface IdeaBacklogRow {
  id: string;
  user_id: string;
  angle: string;
  format: string | null;
  rationale: string | null;
  key_points: string | null;
  source_snippet: string | null;
  platform: string | null;
  used_at: string | null;
  created_at: string;
  updated_at: string;
}

export type IdeaBacklogInsert = {
  id?: string;
  user_id: string;
  angle: string;
  format?: string | null;
  rationale?: string | null;
  key_points?: string | null;
  source_snippet?: string | null;
  platform?: string | null;
  used_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

// `brand_slots` row shape from
// supabase/migrations/20260710000000_create_brand_slots.sql. Not present in
// the generated Supabase types yet (no CLI access to run
// `supabase gen types typescript --linked` in this environment), so the
// table name is cast at the query site (`supabase.from("brand_slots" as any)`)
// following the same pattern already used for `idea_backlog` (see
// src/hooks/queries/useIdeaBacklogQueries.ts).
// TODO(follow-up): once `supabase gen types typescript --linked` can be run,
// regenerate src/integrations/supabase/types.ts and remove this manual
// interface + the `as any` / `as unknown as` casts in
// src/hooks/queries/useBrandSlotQueries.ts in favor of the generated
// Database["public"]["Tables"]["brand_slots"] Row/Insert types.
export interface BrandSlotRow {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  forbidden_phrases: string[];
  proof_points: string[];
  cta_preferences: string[];
  preferred_structures: string[];
  brand_examples: string[] | null;
  default_framework: string | null;
  created_at: string;
  updated_at: string;
}

export type BrandSlotInsert = {
  id?: string;
  user_id: string;
  name: string;
  is_default?: boolean;
  forbidden_phrases?: string[];
  proof_points?: string[];
  cta_preferences?: string[];
  preferred_structures?: string[];
  brand_examples?: string[] | null;
  default_framework?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type BrandSlotUpdate = Partial<Omit<BrandSlotRow, "id" | "user_id" | "created_at">>;
