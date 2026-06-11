import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getE2EAuthFlag, E2E_CALENDAR, E2E_SCHEDULE_ROWS } from "@/lib/e2eFixtures";
import { useWizardStore } from "@/stores/useWizardStore";

function isE2EMode() {
  return import.meta.env.DEV && typeof window !== "undefined" && window.localStorage.getItem(getE2EAuthFlag()) === "true";
}

type E2ECalendar = typeof E2E_CALENDAR;
type E2EScheduleRow = (typeof E2E_SCHEDULE_ROWS)[number];
type Tables = Database["public"]["Tables"];
type SavedCalendarRow = Tables["saved_calendars"]["Row"];
type SavedCalendarInsert = Tables["saved_calendars"]["Insert"];
type SavedCalendarUpdate = Tables["saved_calendars"]["Update"];
type ProfileRow = Tables["profiles"]["Row"];
type SavedCalendarListItem = Pick<SavedCalendarRow, "id" | "title" | "industry_label" | "platform" | "core_idea" | "created_at" | "is_favorite" | "posts">;
type RecentCalendarItem = { id: string; title: string; platform: string | null; industry_label: string | null; created_at: string; is_favorite?: boolean };
type GeneratedPostPayload = {
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

type RepurposePayload = {
  post: GeneratedPostPayload;
  targetPlatform: string;
  platform?: string;
  context?: Record<string, unknown>;
  [key: string]: unknown;
};

type GeneratePostImagePayload = {
  calendarId: string;
  postDay: number;
  post: GeneratedPostPayload;
  prompt: string;
  platform?: string;
  aspectRatio?: string;
};

type InlineRewritePayload = {
  text: string;
  instruction: string;
  field: "title" | "hook" | "body" | "cta";
  platform?: string;
  post?: GeneratedPostPayload;
  context?: Record<string, unknown>;
};

type GeneratedResponse<T> = { post?: T; rewrittenText?: string };

let e2eCalendars: E2ECalendar[] = [];
let e2eScheduleRows: E2EScheduleRow[] = [];

const E2E_CALENDARS_KEY = "ss:e2e-calendars";
const E2E_SCHEDULE_ROWS_KEY = "ss:e2e-schedule-rows";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function readPersistedE2E<T>(key: string): T[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : null;
  } catch {
    return null;
  }
}

function writePersistedE2E<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* best effort */
  }
}

function seedE2EStores() {
  if (e2eCalendars.length === 0) {
    const persistedCalendars = readPersistedE2E<E2ECalendar>(E2E_CALENDARS_KEY);
    e2eCalendars = persistedCalendars && persistedCalendars.length > 0 ? persistedCalendars : [clone(E2E_CALENDAR)];
  }
  if (e2eScheduleRows.length === 0) {
    const persistedRows = readPersistedE2E<E2EScheduleRow>(E2E_SCHEDULE_ROWS_KEY);
    e2eScheduleRows = persistedRows && persistedRows.length > 0 ? persistedRows : clone(E2E_SCHEDULE_ROWS);
  }
  writePersistedE2E(E2E_CALENDARS_KEY, e2eCalendars);
  writePersistedE2E(E2E_SCHEDULE_ROWS_KEY, e2eScheduleRows);
}

function getE2ECalendars() {
  seedE2EStores();
  return clone(e2eCalendars);
}

function getE2EScheduleRows() {
  seedE2EStores();
  return clone(e2eScheduleRows);
}

function findE2ECalendar(id: string) {
  seedE2EStores();
  const calendar = e2eCalendars.find((item) => item.id === id);
  if (!calendar && id === E2E_CALENDAR.id) {
    return clone(E2E_CALENDAR);
  }
  return calendar ? clone(calendar) : null;
}

function updateE2ECalendar(id: string, patch: Partial<E2ECalendar>) {
  seedE2EStores();
  e2eCalendars = e2eCalendars.map((calendar) => (calendar.id === id ? { ...calendar, ...patch } : calendar));
  writePersistedE2E(E2E_CALENDARS_KEY, e2eCalendars);
}

function deleteE2ECalendar(id: string) {
  seedE2EStores();
  e2eCalendars = e2eCalendars.filter((calendar) => calendar.id !== id);
  e2eScheduleRows = e2eScheduleRows.filter((row) => row.calendar_id !== id);
  writePersistedE2E(E2E_CALENDARS_KEY, e2eCalendars);
  writePersistedE2E(E2E_SCHEDULE_ROWS_KEY, e2eScheduleRows);
}

function insertE2ECalendar(calendar: SavedCalendarInsert | Partial<E2ECalendar>) {
  seedE2EStores();
  const posts = Array.isArray((calendar as { posts?: unknown }).posts)
    ? clone((calendar as { posts?: unknown[] }).posts)
    : clone(E2E_CALENDAR.posts);
  const next = {
    ...clone(E2E_CALENDAR),
    ...calendar,
    posts,
    id: calendar.id || `e2e-calendar-${Date.now()}`,
  } as E2ECalendar;
  e2eCalendars = [next, ...e2eCalendars.filter((existing) => existing.id !== next.id)];
  writePersistedE2E(E2E_CALENDARS_KEY, e2eCalendars);
  return next;
}

function updateE2EScheduleRow(id: string, patch: Record<string, unknown>) {
  seedE2EStores();
  e2eScheduleRows = e2eScheduleRows.map((row) => (row.id === id ? { ...row, ...patch } : row));
  writePersistedE2E(E2E_SCHEDULE_ROWS_KEY, e2eScheduleRows);
}

export function useProfileQuery(userId?: string) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return null;
      if (isE2EMode()) {
        return {
          display_name: "E2E User",
          avatar_url: null,
          default_voice: "professional",
          default_style: "informative",
          default_audiences: [],
          default_goals: [],
          banned_hashtags: [],
          required_hashtags: [],
          default_timezone: "UTC",
          brand_examples: null,
          default_framework: null,
          forbidden_phrases: null,
          proof_points: null,
          cta_preferences: null,
          preferred_structures: null,
        };
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, default_voice, default_style, default_audiences, default_goals, banned_hashtags, required_hashtags, default_timezone, brand_examples, default_framework, forbidden_phrases, proof_points, cta_preferences, preferred_structures")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCalendarQuery(id?: string) {
  return useQuery({
    queryKey: ["calendar", id],
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!id) throw new Error("No calendar ID");
      if (isE2EMode()) {
        const e2eCalendar = findE2ECalendar(id);
        if (e2eCalendar) return e2eCalendar;
      }
      const { data, error } = await supabase.from("saved_calendars").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Calendar not found");
      return data;
    },
  });
}

export function useScheduledPostsQuery(calendarId?: string) {
  return useQuery({
    queryKey: ["scheduled-posts-status", calendarId],
    enabled: !!calendarId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!calendarId) return [];
      if (isE2EMode()) {
        const rows = getE2EScheduleRows().filter(
          (row) => row.calendar_id === calendarId && row.status !== "cancelled"
        );
        return rows.map((row) => ({
          post_day: row.post_day,
          workflow_status: row.workflow_status,
        }));
      }
      const { data, error } = await supabase
        .from("scheduled_posts")
        .select("post_day, workflow_status")
        .eq("calendar_id", calendarId)
        .neq("status", "cancelled");
      if (error) throw error;
      return data || [];
    },
  });
}

type SavedCalendarsCursor = { created_at: string; id: string } | null;

export function useSavedCalendarsInfiniteQuery(userId?: string, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: ["saved-calendars", userId, pageSize],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    initialPageParam: null as SavedCalendarsCursor,
    getNextPageParam: (lastPage: { items: SavedCalendarListItem[]; nextCursor: SavedCalendarsCursor }) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => {
      if (!userId) return { items: [], nextCursor: null as SavedCalendarsCursor };
      if (isE2EMode()) {
        const calendars = getE2ECalendars() as SavedCalendarListItem[];
        return { items: calendars, nextCursor: null as SavedCalendarsCursor };
      }
      let query = supabase
        .from("saved_calendars")
        .select("id, title, industry_label, platform, core_idea, created_at, is_favorite, posts")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(pageSize);

      if (pageParam) {
        const { created_at, id } = pageParam;
        query = query.or(`created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const items = (data as SavedCalendarListItem[] | null) || [];
      const last = items[items.length - 1] as { created_at?: string; id?: string } | undefined;
      const nextCursor = items.length === pageSize && last?.created_at && last?.id
        ? { created_at: last.created_at, id: last.id }
        : null;
      return { items, nextCursor };
    },
  });
}

export function useScheduleInfiniteQuery(userId?: string, pageSize = 25) {
  return useInfiniteQuery({
    queryKey: ["schedule", userId, pageSize],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    initialPageParam: null as { scheduled_at: string; id: string } | null,
    getNextPageParam: (lastPage: { nextCursor: { scheduled_at: string; id: string } | null; rows: unknown[]; calendars: Record<string, { id: string; title: string; timezone: string | null; tracking_url: string | null }>; profileTz: string }) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => {
      if (!userId) {
        return { rows: [], calendars: {}, profileTz: "", nextCursor: null };
      }

      if (isE2EMode()) {
        const rows = getE2EScheduleRows();
        const calendars: Record<string, { id: string; title: string; timezone: string | null; tracking_url: string | null }> = {};
        for (const calendar of getE2ECalendars()) {
          (calendars as Record<string, unknown>)[calendar.id] = calendar;
        }
        return {
          rows,
          calendars,
          profileTz: "UTC",
          nextCursor: null,
        };
      }

      let scheduleQuery = supabase.from("scheduled_posts")
        .select("id, calendar_id, post_day, platform, scheduled_at, status, workflow_status, copy_text, post_snapshot, published_at, failure_reason")
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(pageSize);

      if (pageParam) {
        scheduleQuery = scheduleQuery.or(`scheduled_at.gt.${pageParam.scheduled_at},and(scheduled_at.eq.${pageParam.scheduled_at},id.gt.${pageParam.id})`);
      }

      const [{ data: pr, error: profileError }, { data: schedData, error: scheduleError }, { data: calData, error: calendarsError }] = await Promise.all([
        supabase.from("profiles").select("default_timezone").eq("user_id", userId).maybeSingle(),
        scheduleQuery,
        supabase.from("saved_calendars").select("id, title, timezone, tracking_url"),
      ]);

      if (profileError) throw profileError;
      if (scheduleError) throw scheduleError;
      if (calendarsError) throw calendarsError;

      const profTz = (pr as { default_timezone?: string | null } | null)?.default_timezone || "";
      const map: Record<string, { id: string; title: string; timezone: string | null; tracking_url: string | null }> = {};
      for (const c of (calData as Array<{ id: string; title: string; timezone: string | null; tracking_url: string | null }>) || []) map[c.id] = c;

      const items = (schedData as unknown[] | null) || [];
      const lastItem = items[items.length - 1] as { scheduled_at?: string; id?: string } | undefined;
      const nextCursor = items.length === pageSize && lastItem?.scheduled_at && lastItem?.id ? { scheduled_at: lastItem.scheduled_at, id: lastItem.id } : null;

      return {
        rows: items,
        calendars: map,
        profileTz: profTz,
        nextCursor,
      };
    },
  });
}

export function useProfileUpdateMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Database["public"]["Tables"]["profiles"]["Update"]) => {
      if (!userId) throw new Error("No user ID");
      const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId);
      if (error) throw error;
      return updates;
    },
    onMutate: async (updates) => {
      if (!userId) return;
      await qc.cancelQueries({ queryKey: ["profile", userId] });
      const previous = qc.getQueryData(["profile", userId]);
      qc.setQueryData(["profile", userId], (old: ProfileRow | null | undefined) => ({ ...(old || {}), ...updates }));
      return { previous };
    },
    onError: (_err, _updates, ctx) => {
      if (userId && ctx?.previous) qc.setQueryData(["profile", userId], ctx.previous);
    },
    onSettled: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
}

export function useCreateCalendarMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SavedCalendarInsert) => {
      if (isE2EMode()) {
        const created = insertE2ECalendar(payload);
        return { id: created.id };
      }
      const { data, error } = await supabase.from("saved_calendars").insert([payload]).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ["recent-calendars", payload?.user_id] });
      qc.invalidateQueries({ queryKey: ["calendar", payload?.id] });
    },
  });
}

export function useToggleCalendarFavoriteMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      if (isE2EMode()) {
        updateE2ECalendar(id, { is_favorite: isFavorite });
        return { id, isFavorite };
      }
      const { error } = await supabase.from("saved_calendars").update({ is_favorite: isFavorite }).eq("id", id);
      if (error) throw error;
      return { id, isFavorite };
    },
    onMutate: async ({ id, isFavorite }) => {
      if (!userId) return;
      await qc.cancelQueries({ queryKey: ["saved-calendars", userId] });
      await qc.cancelQueries({ queryKey: ["recent-calendars", userId] });

      const previousSaved = qc.getQueryData(["saved-calendars", userId]);
      const previousRecent = qc.getQueryData(["recent-calendars", userId]);

      qc.setQueryData(
        ["saved-calendars", userId],
        (old: InfiniteData<{ items: SavedCalendarListItem[]; nextCursor: SavedCalendarsCursor }> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === id ? { ...item, is_favorite: isFavorite } : item
              ),
            })),
          };
        }
      );

      qc.setQueryData(["recent-calendars", userId], (old: RecentCalendarItem[] | undefined) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === id ? { ...item, is_favorite: isFavorite } : item
        );
      });

      return { previousSaved, previousRecent };
    },
    onError: (_err, _variables, context) => {
      if (userId && context?.previousSaved) {
        qc.setQueryData(["saved-calendars", userId], context.previousSaved);
      }
      if (userId && context?.previousRecent) {
        qc.setQueryData(["recent-calendars", userId], context.previousRecent);
      }
    },
    onSettled: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: ["saved-calendars", userId] });
        qc.invalidateQueries({ queryKey: ["recent-calendars", userId] });
      }
    },
  });
}

export function useDeleteCalendarMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isE2EMode()) {
        deleteE2ECalendar(id);
        return id;
      }
      const { error } = await supabase.from("saved_calendars").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["saved-calendars", userId] });
      if (userId) qc.invalidateQueries({ queryKey: ["recent-calendars", userId] });
    },
  });
}

export function useRestoreCalendarMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SavedCalendarInsert) => {
      if (isE2EMode()) {
        insertE2ECalendar(payload);
        return payload;
      }
      const { error } = await supabase.from("saved_calendars").insert([payload]);
      if (error) throw error;
      return payload;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["saved-calendars", userId] });
    },
  });
}

export function useRenameCalendarMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      if (isE2EMode()) {
        updateE2ECalendar(id, { title });
        return { id, title };
      }
      const { error } = await supabase.from("saved_calendars").update({ title }).eq("id", id);
      if (error) throw error;
      return { id, title };
    },
    onMutate: async ({ id, title }) => {
      if (!userId) return;
      await qc.cancelQueries({ queryKey: ["saved-calendars", userId] });
      await qc.cancelQueries({ queryKey: ["recent-calendars", userId] });

      const previousSaved = qc.getQueryData(["saved-calendars", userId]);
      const previousRecent = qc.getQueryData(["recent-calendars", userId]);

      qc.setQueryData(
        ["saved-calendars", userId],
        (old: InfiniteData<{ items: SavedCalendarListItem[]; nextCursor: SavedCalendarsCursor }> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === id ? { ...item, title } : item
              ),
            })),
          };
        }
      );

      qc.setQueryData(["recent-calendars", userId], (old: RecentCalendarItem[] | undefined) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === id ? { ...item, title } : item
        );
      });

      return { previousSaved, previousRecent };
    },
    onError: (_err, _variables, context) => {
      if (userId && context?.previousSaved) {
        qc.setQueryData(["saved-calendars", userId], context.previousSaved);
      }
      if (userId && context?.previousRecent) {
        qc.setQueryData(["recent-calendars", userId], context.previousRecent);
      }
    },
    onSettled: () => {
      if (userId) {
        qc.invalidateQueries({ queryKey: ["saved-calendars", userId] });
        qc.invalidateQueries({ queryKey: ["recent-calendars", userId] });
      }
    },
  });
}

export function useDuplicateCalendarMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SavedCalendarInsert) => {
      if (isE2EMode()) {
        insertE2ECalendar(payload);
        return payload;
      }
      const { error } = await supabase.from("saved_calendars").insert([payload]);
      if (error) throw error;
      return payload;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["saved-calendars", userId] });
    },
  });
}

export function useUpdateSavedCalendarMutation(calendarId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: SavedCalendarUpdate) => {
      if (!calendarId) throw new Error("No calendar ID");
      const { error } = await supabase.from("saved_calendars").update(patch).eq("id", calendarId);
      if (error) throw error;
      return patch;
    },
    onSuccess: () => {
      if (calendarId) {
        qc.invalidateQueries({ queryKey: ["calendar", calendarId] });
      }
    },
  });
}

export function useTemplatesQuery(userId?: string) {
  return useQuery({
    queryKey: ["templates", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return [];
      if (isE2EMode()) {
        return [];
      }
      const { data, error } = await supabase.from("templates").select("id, name, description, config, created_at").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useDeleteTemplateMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isE2EMode()) {
        return id;
      }
      const { error } = await supabase.from("templates").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["templates", userId] });
    },
  });
}

export function useUpdateScheduledPostStatusMutation(calendarId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Database["public"]["Tables"]["scheduled_posts"]["Update"] }) => {
      if (isE2EMode()) {
        updateE2EScheduleRow(id, patch);
        return { id, patch };
      }
      const { error } = await supabase.from("scheduled_posts").update(patch).eq("id", id);
      if (error) throw error;
      return { id, patch };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      if (calendarId) qc.invalidateQueries({ queryKey: ["scheduled-posts-status", calendarId] });
    },
  });
}

export function useCancelScheduledPostMutation(calendarId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isE2EMode()) {
        updateE2EScheduleRow(id, { status: "cancelled" });
        return id;
      }
      const { error } = await supabase.from("scheduled_posts").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      if (calendarId) qc.invalidateQueries({ queryKey: ["scheduled-posts-status", calendarId] });
    },
  });
}

export function useUpdateScheduledPostTimeMutation(calendarId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: string }) => {
      if (isE2EMode()) {
        updateE2EScheduleRow(id, { scheduled_at: scheduledAt });
        return { id, scheduledAt };
      }
      const { error } = await supabase.from("scheduled_posts").update({ scheduled_at: scheduledAt }).eq("id", id);
      if (error) throw error;
      return { id, scheduledAt };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      if (calendarId) qc.invalidateQueries({ queryKey: ["scheduled-posts-status", calendarId] });
    },
  });
}

export function useRegeneratePostMutation(calendarId?: string) {
  const qc = useQueryClient();
  const setKeySource = useWizardStore((state) => state.setKeySource);
  const setKeyMode = useWizardStore((state) => state.setKeyMode);
  
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (isE2EMode()) {
        // Return a deterministic regenerated post in E2E mode
        const incoming = payload?.post as { title?: string; body?: string } | undefined;
        const post = incoming
          ? { ...incoming, title: `${incoming.title || 'E2E regenerated'}`, body: incoming.body || 'E2E regenerated body' }
          : { id: `e2e-reg-${Date.now()}`, day: 1, title: 'E2E regenerated', hook: 'E2E hook', body: 'E2E regenerated body', cta: 'No CTA' };
        return post;
      }

      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback("regenerate-post", payload);
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);
      return (data as GeneratedResponse<GeneratedPostPayload>).post;
    },
    onSuccess: () => {
      if (calendarId) qc.invalidateQueries({ queryKey: ["calendar", calendarId] });
    },
  });
}

export function useRepurposePostMutation() {
  const setKeySource = useWizardStore((state) => state.setKeySource);
  const setKeyMode = useWizardStore((state) => state.setKeyMode);
  return useMutation({
    mutationFn: async (payload: RepurposePayload) => {
      if (isE2EMode()) {
        const post = payload.post || {};
        const target = payload.targetPlatform || "LinkedIn";
        return {
          ...post,
          format: target === "Instagram" ? "Instagram carousel script" : `${target} version`,
          title: `${post.title || post.topic || "Repurposed post"} (${target})`,
          body: `[${target}] ${post.body || post.hook || "Repurposed body"}`,
          cta: post.cta || "Save this for later.",
        };
      }
      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback("repurpose-post", payload);
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);
      return (data as GeneratedResponse<GeneratedPostPayload>).post;
    },
  });
}

export function useGeneratePostImageMutation() {
  return useMutation({
    mutationFn: async (payload: GeneratePostImagePayload) => {
      if (isE2EMode()) {
        return {
          publicUrl: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1200'%20height='1200'%20viewBox='0%200%201200%201200'%3E%3Crect%20width='1200'%20height='1200'%20fill='%2307080d'/%3E%3Crect%20x='80'%20y='80'%20width='1040'%20height='1040'%20rx='48'%20fill='%23181a26'/%3E%3Ctext%20x='600'%20y='580'%20fill='%23c8f09a'%20font-family='Arial'%20font-size='48'%20text-anchor='middle'%3EGenerated%20visual%3C/text%3E%3Ctext%20x='600'%20y='650'%20fill='%23edeae3'%20font-family='Arial'%20font-size='28'%20text-anchor='middle'%3EE2E%20placeholder%3C/text%3E%3C/svg%3E",
          storagePath: `e2e/${payload.calendarId}/${payload.postDay}.svg`,
          aspectRatio: payload.aspectRatio || "1:1",
          prompt: payload.prompt,
        };
      }
      const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
      const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-post-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || `Image generation failed (${res.status})`);
      return data;
    },
  });
}

export function useInlineRewriteMutation() {
  const setKeySource = useWizardStore((state) => state.setKeySource);
  const setKeyMode = useWizardStore((state) => state.setKeyMode);
  return useMutation({
    mutationFn: async (payload: InlineRewritePayload) => {
      if (isE2EMode()) {
        return `${payload.text.trim()} (${payload.instruction})`;
      }
      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback("inline-rewrite", payload);
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);
      return String((data as GeneratedResponse<never>).rewrittenText || "");
    },
  });
}
