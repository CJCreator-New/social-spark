import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProfileQuery(userId?: string) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, default_voice, default_style, default_audiences, default_goals, banned_hashtags, required_hashtags, default_timezone")
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

export function useSavedCalendarsInfiniteQuery(userId?: string, pageSize = 20) {
  return useInfiniteQuery({
    queryKey: ["saved-calendars", userId, pageSize],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: { items: unknown[]; nextCursor: string | null }) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => {
      if (!userId) return { items: [], nextCursor: null as string | null };
      let query = supabase
        .from("saved_calendars")
        .select("id, title, industry_label, platform, core_idea, created_at, is_favorite, posts")
        .order("is_favorite", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(pageSize);

      if (pageParam) {
        query = query.lt("created_at", pageParam);
      }

      const { data, error } = await query;
      if (error) throw error;
      const items = (data as unknown[]) || [];
      const nextCursor = items.length === pageSize ? (items[items.length - 1] as { created_at?: string } | undefined)?.created_at || null : null;
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
    getNextPageParam: (lastPage: { nextCursor: { scheduled_at: string; id: string } | null }) => lastPage.nextCursor,
    queryFn: async ({ pageParam }) => {
      if (!userId) {
        return { rows: [], calendars: new Map(), profileTz: "", nextCursor: null };
      }

      const [{ data: pr }, { data: schedData }, { data: calData }] = await Promise.all([
        supabase.from("profiles").select("default_timezone").eq("user_id", userId).maybeSingle(),
        supabase.from("scheduled_posts")
          .select("id, calendar_id, post_day, platform, scheduled_at, status, workflow_status, copy_text, post_snapshot, published_at, failure_reason")
          .neq("status", "cancelled")
          .order("scheduled_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(pageSize)
          .or(pageParam
            ? `scheduled_at.gt.${pageParam.scheduled_at},and(scheduled_at.eq.${pageParam.scheduled_at},id.gt.${pageParam.id})`
            : undefined),
        supabase.from("saved_calendars").select("id, title, timezone, tracking_url"),
      ]);

      const profTz = (pr as { default_timezone?: string | null } | null)?.default_timezone || "";
      const map = new Map<string, { id: string; title: string; timezone: string | null; tracking_url: string | null }>();
      for (const c of (calData as Array<{ id: string; title: string; timezone: string | null; tracking_url: string | null }>) || []) map.set(c.id, c);

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
    mutationFn: async (updates: Record<string, unknown>) => {
      if (!userId) throw new Error("No user ID");
      const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId);
      if (error) throw error;
      return updates;
    },
    onMutate: async (updates) => {
      if (!userId) return;
      await qc.cancelQueries({ queryKey: ["profile", userId] });
      const previous = qc.getQueryData(["profile", userId]);
      qc.setQueryData(["profile", userId], (old: any) => ({ ...(old || {}), ...updates }));
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
    mutationFn: async (payload: any) => {
      const { data, error } = await supabase.from("saved_calendars").insert([payload]).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, payload: any) => {
      qc.invalidateQueries({ queryKey: ["recent-calendars", payload?.user_id] });
      qc.invalidateQueries({ queryKey: ["calendar", payload?.id] });
    },
  });
}

export function useToggleCalendarFavoriteMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isFavorite }: { id: string; isFavorite: boolean }) => {
      const { error } = await supabase.from("saved_calendars").update({ is_favorite: isFavorite }).eq("id", id);
      if (error) throw error;
      return { id, isFavorite };
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["saved-calendars", userId] });
    },
  });
}

export function useDeleteCalendarMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
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
    mutationFn: async (payload: Record<string, unknown>) => {
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
      const { error } = await supabase.from("saved_calendars").update({ title }).eq("id", id);
      if (error) throw error;
      return { id, title };
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["saved-calendars", userId] });
    },
  });
}

export function useDuplicateCalendarMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
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
    mutationFn: async (patch: Record<string, unknown>) => {
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
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("scheduled_posts").update(patch).eq("id", id);
      if (error) throw error;
      return { id, patch };
    },
    onSuccess: () => {
      if (calendarId) qc.invalidateQueries({ queryKey: ["scheduled-posts-status", calendarId] });
    },
  });
}

export function useCancelScheduledPostMutation(calendarId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scheduled_posts").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      if (calendarId) qc.invalidateQueries({ queryKey: ["scheduled-posts-status", calendarId] });
    },
  });
}

export function useUpdateScheduledPostTimeMutation(calendarId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: string }) => {
      const { error } = await supabase.from("scheduled_posts").update({ scheduled_at: scheduledAt }).eq("id", id);
      if (error) throw error;
      return { id, scheduledAt };
    },
    onSuccess: () => {
      if (calendarId) qc.invalidateQueries({ queryKey: ["scheduled-posts-status", calendarId] });
    },
  });
}

export function useRegeneratePostMutation(calendarId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || "";
      const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";
      const res = await fetch(`${SUPABASE_URL}/functions/v1/regenerate-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || `Regenerate failed (${res.status})`);
      return data.post;
    },
    onSuccess: () => {
      if (calendarId) qc.invalidateQueries({ queryKey: ["calendar", calendarId] });
    },
  });
}
