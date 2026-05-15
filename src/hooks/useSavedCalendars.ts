import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useCreateCalendar() {
  const qc = useQueryClient();
  return useMutation(async (payload: any) => {
    const { data, error } = await supabase.from("saved_calendars").insert([payload]).select("id").single();
    if (error) throw error;
    return data;
  }, {
    onSuccess: () => qc.invalidateQueries(["recent-calendars"]),
  });
}

export function useUpdateCalendar(id?: string) {
  const qc = useQueryClient();
  return useMutation(async ({ id, patch }: { id: string; patch: any }) => {
    const { error } = await supabase.from("saved_calendars").update(patch).eq("id", id);
    if (error) throw error;
    return true;
  }, {
    onSuccess: () => qc.invalidateQueries(["saved-calendars"]),
  });
}

export function useDeleteCalendar() {
  const qc = useQueryClient();
  return useMutation(async (id: string) => {
    const { error } = await supabase.from("saved_calendars").delete().eq("id", id);
    if (error) throw error;
    return true;
  }, {
    onSuccess: () => qc.invalidateQueries(["recent-calendars"]),
  });
}

export default { useCreateCalendar, useUpdateCalendar, useDeleteCalendar };
