import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SavedCalendarInsert = Database["public"]["Tables"]["saved_calendars"]["Insert"];
type SavedCalendarUpdate = Database["public"]["Tables"]["saved_calendars"]["Update"];

export function useCreateCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SavedCalendarInsert) => {
      const { data, error } = await supabase.from("saved_calendars").insert([payload]).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recent-calendars"] }),
  });
}

export function useUpdateCalendar(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: SavedCalendarUpdate }) => {
      const { error } = await supabase.from("saved_calendars").update(patch).eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-calendars", id] }),
  });
}

export function useDeleteCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_calendars").delete().eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recent-calendars"] }),
  });
}

export default { useCreateCalendar, useUpdateCalendar, useDeleteCalendar };
