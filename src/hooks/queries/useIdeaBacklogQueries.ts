import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  isE2EMode,
  type ExtractedIdea,
  type IdeaBacklogInsert,
  type IdeaBacklogRow,
} from "./shared";

// Mirrors the localStorage lib's MAX_BACKLOG cap (see the now-removed
// src/lib/ideaBacklog.ts) so the per-user backlog doesn't grow unbounded.
const MAX_BACKLOG = 50;

// Small in-memory fixture store for E2E mode, following the pattern used by
// ./e2eFixtureStore.ts for other domains — kept local here since the idea
// backlog table has no other E2E consumers yet.
let e2eBacklog: IdeaBacklogRow[] = [];

function nowIso() {
  return new Date().toISOString();
}

export function useIdeaBacklogQuery(userId?: string) {
  return useQuery({
    queryKey: ["idea-backlog", userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<IdeaBacklogRow[]> => {
      if (!userId) return [];
      if (isE2EMode()) {
        return e2eBacklog
          .filter((row) => row.user_id === userId)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      }
      const { data, error } = await (supabase.from("idea_backlog" as any) as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as IdeaBacklogRow[]) || [];
    },
  });
}

export function useAddIdeasToBacklogMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ideas,
      sourceText,
      platform,
    }: {
      ideas: ExtractedIdea[];
      sourceText: string;
      platform?: string;
    }): Promise<IdeaBacklogRow[]> => {
      if (!userId) throw new Error("No user ID");
      const snippet = sourceText.slice(0, 120);
      const payload: IdeaBacklogInsert[] = ideas.map((idea) => ({
        user_id: userId,
        angle: idea.title,
        format: idea.format ?? null,
        rationale: idea.rationale ?? null,
        key_points: idea.key_points ?? null,
        source_snippet: snippet,
        platform: platform ?? null,
      }));

      if (isE2EMode()) {
        const created: IdeaBacklogRow[] = payload.map((row, i) => ({
          id: `e2e-idea-${Date.now()}-${i}`,
          user_id: row.user_id,
          angle: row.angle,
          format: row.format ?? null,
          rationale: row.rationale ?? null,
          key_points: row.key_points ?? null,
          source_snippet: row.source_snippet ?? null,
          platform: row.platform ?? null,
          used_at: null,
          created_at: nowIso(),
          updated_at: nowIso(),
        }));
        e2eBacklog = [...created, ...e2eBacklog].slice(0, MAX_BACKLOG);
        return created;
      }

      const { data, error } = await (supabase.from("idea_backlog" as any) as any)
        .insert(payload)
        .select("*");
      if (error) throw error;
      const inserted = (data as unknown as IdeaBacklogRow[]) || [];

      // Trim to the MAX_BACKLOG newest rows per user, mirroring the old
      // localStorage lib's cap. Fetch ids beyond the cap and delete them.
      const { data: allRows, error: fetchError } = await (
        supabase.from("idea_backlog" as any) as any
      )
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (!fetchError && Array.isArray(allRows) && allRows.length > MAX_BACKLOG) {
        const staleIds = (allRows as { id: string }[])
          .slice(MAX_BACKLOG)
          .map((row) => row.id);
        if (staleIds.length > 0) {
          await (supabase.from("idea_backlog" as any) as any)
            .delete()
            .eq("user_id", userId)
            .in("id", staleIds);
        }
      }

      return inserted;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["idea-backlog", userId] });
    },
  });
}

export function useMarkIdeaUsedMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("No user ID");
      if (isE2EMode()) {
        e2eBacklog = e2eBacklog.map((row) =>
          row.id === id && row.user_id === userId
            ? { ...row, used_at: nowIso() }
            : row
        );
        return { id };
      }
      const { error } = await (supabase.from("idea_backlog" as any) as any)
        .update({ used_at: nowIso() })
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["idea-backlog", userId] });
    },
  });
}

export function useRemoveIdeaFromBacklogMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error("No user ID");
      if (isE2EMode()) {
        e2eBacklog = e2eBacklog.filter(
          (row) => !(row.id === id && row.user_id === userId)
        );
        return { id };
      }
      const { error } = await (supabase.from("idea_backlog" as any) as any)
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["idea-backlog", userId] });
    },
  });
}
