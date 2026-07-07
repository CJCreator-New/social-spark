import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { isE2EMode } from "./shared";
import { getE2ECalendars, getE2EScheduleRows, updateE2EScheduleRow } from "./e2eFixtureStore";

export interface ScheduledRow {
  id: string;
  calendar_id: string;
  post_day: number;
  platform: string | null;
  scheduled_at: string;
  status: string;
  workflow_status: string;
  copy_text: string | null;
  post_snapshot: { title?: string; topic?: string; hashtags?: string } | null;
  published_at: string | null;
  failure_reason: string | null;
}

export interface CalendarMeta {
  id: string;
  title: string;
  timezone: string | null;
  tracking_url: string | null;
}

export interface SchedulePage {
  rows: ScheduledRow[];
  calendars: Record<string, CalendarMeta>;
  profileTz: string;
  nextCursor: { scheduled_at: string; id: string } | null;
}

export function useScheduledPostsQuery(calendarId?: string) {
  return useQuery({
    queryKey: ["scheduled-posts-status", calendarId],
    enabled: !!calendarId,
    staleTime: 30 * 1000,
    // F-017: publish status changes server-side (queue-worker cron), outside
    // any user action in this tab — refetch on focus so a user tabbing back
    // sees whether their post actually published while they were away.
    refetchOnWindowFocus: true,
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

export function useScheduleInfiniteQuery(userId?: string, pageSize = 25) {
  return useInfiniteQuery({
    queryKey: ["schedule", userId, pageSize],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    initialPageParam: null as { scheduled_at: string; id: string } | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    queryFn: async ({ pageParam }: { pageParam: { scheduled_at: string; id: string } | null }) => {
      if (!userId) {
        return { rows: [], calendars: {}, profileTz: "", nextCursor: null } as SchedulePage;
      }

      if (isE2EMode()) {
        const rows = getE2EScheduleRows() as ScheduledRow[];
        const calendars: Record<string, CalendarMeta> = {};
        for (const calendar of getE2ECalendars()) {
          calendars[calendar.id] = calendar;
        }
        return {
          rows,
          calendars,
          profileTz: "UTC",
          nextCursor: null,
        } as SchedulePage;
      }

      let scheduleQuery = supabase
        .from("scheduled_posts")
        .select(
          "id, calendar_id, post_day, platform, scheduled_at, status, workflow_status, copy_text, post_snapshot, published_at, failure_reason"
        )
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(pageSize);

      if (pageParam) {
        scheduleQuery = scheduleQuery.or(
          `scheduled_at.gt.${pageParam.scheduled_at},and(scheduled_at.eq.${pageParam.scheduled_at},id.gt.${pageParam.id})`
        );
      }

      const [
        { data: pr, error: profileError },
        { data: schedData, error: scheduleError },
        { data: calData, error: calendarsError },
      ] = await Promise.all([
        supabase.from("profiles").select("default_timezone").eq("user_id", userId).maybeSingle(),
        scheduleQuery,
        supabase.from("saved_calendars").select("id, title, timezone, tracking_url"),
      ]);

      if (profileError) throw profileError;
      if (scheduleError) throw scheduleError;
      if (calendarsError) throw calendarsError;

      const profTz = pr?.default_timezone || "";
      const map: Record<string, CalendarMeta> = {};
      for (const c of (calData ?? []) as CalendarMeta[]) map[c.id] = c;

      const items = (schedData ?? []) as ScheduledRow[];
      const lastItem = items[items.length - 1];
      const nextCursor =
        items.length === pageSize && lastItem?.scheduled_at && lastItem?.id
          ? { scheduled_at: lastItem.scheduled_at, id: lastItem.id }
          : null;

      return { rows: items, calendars: map, profileTz: profTz, nextCursor } as SchedulePage;
    },
  });
}

export function useUpdateScheduledPostStatusMutation(calendarId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Database["public"]["Tables"]["scheduled_posts"]["Update"];
    }) => {
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
      const { error } = await supabase
        .from("scheduled_posts")
        .update({ status: "cancelled" })
        .eq("id", id);
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
      const { error } = await supabase
        .from("scheduled_posts")
        .update({ scheduled_at: scheduledAt })
        .eq("id", id);
      if (error) throw error;
      return { id, scheduledAt };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["schedule"] });
      if (calendarId) qc.invalidateQueries({ queryKey: ["scheduled-posts-status", calendarId] });
    },
  });
}
