import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  isE2EMode,
  type ProfileRow,
  type SavedCalendarInsert,
  type SavedCalendarListItem,
  type SavedCalendarsCursor,
  type SavedCalendarUpdate,
  type RecentCalendarItem,
} from "./shared";
import {
  deleteE2ECalendar,
  findE2ECalendar,
  getE2ECalendars,
  insertE2ECalendar,
  updateE2ECalendar,
} from "./e2eFixtureStore";

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
