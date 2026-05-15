import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
