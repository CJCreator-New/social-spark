import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isE2EMode, type BrandSlotInsert, type BrandSlotRow, type BrandSlotUpdate } from "./shared";

// Small in-memory fixture store for E2E mode, following the pattern used by
// useIdeaBacklogQueries.ts's `e2eBacklog` — seeded lazily on first access so
// specs touching the brand picker have a deterministic default slot without
// needing a real Supabase round trip.
let e2eBrandSlots: BrandSlotRow[] | null = null;

function nowIso() {
  return new Date().toISOString();
}

function getE2EBrandSlots(): BrandSlotRow[] {
  if (e2eBrandSlots === null) {
    const seededAt = nowIso();
    e2eBrandSlots = [
      {
        id: "e2e-default-slot",
        user_id: "e2e-user",
        name: "Default",
        is_default: true,
        forbidden_phrases: [],
        proof_points: [],
        cta_preferences: [],
        preferred_structures: [],
        brand_examples: null,
        default_framework: null,
        created_at: seededAt,
        updated_at: seededAt,
      },
    ];
  }
  return e2eBrandSlots;
}

function sortBrandSlots(rows: BrandSlotRow[]): BrandSlotRow[] {
  return [...rows].sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
  });
}

export function useBrandSlotsQuery(userId?: string) {
  return useQuery({
    queryKey: ["brand-slots", userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<BrandSlotRow[]> => {
      if (!userId) return [];
      if (isE2EMode()) {
        return sortBrandSlots(getE2EBrandSlots().filter((row) => row.user_id === userId));
      }
      const { data, error } = await (supabase.from("brand_slots" as any) as any)
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as BrandSlotRow[]) || [];
    },
  });
}

export function useCreateBrandSlotMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Omit<BrandSlotInsert, "user_id" | "is_default">
    ): Promise<BrandSlotRow> => {
      if (!userId) throw new Error("No user ID");
      // Creating a slot never auto-promotes it to default — the user must
      // explicitly call useSetDefaultBrandSlotMutation.
      const payload: BrandSlotInsert = {
        ...input,
        user_id: userId,
        is_default: false,
      };

      if (isE2EMode()) {
        const created: BrandSlotRow = {
          id: `e2e-slot-${Date.now()}`,
          user_id: userId,
          name: payload.name,
          is_default: false,
          forbidden_phrases: payload.forbidden_phrases ?? [],
          proof_points: payload.proof_points ?? [],
          cta_preferences: payload.cta_preferences ?? [],
          preferred_structures: payload.preferred_structures ?? [],
          brand_examples: payload.brand_examples ?? null,
          default_framework: payload.default_framework ?? null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        e2eBrandSlots = [...getE2EBrandSlots(), created];
        return created;
      }

      const { data, error } = await (supabase.from("brand_slots" as any) as any)
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as BrandSlotRow;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["brand-slots", userId] });
    },
  });
}

export function useUpdateBrandSlotMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: BrandSlotUpdate;
    }): Promise<{ id: string }> => {
      if (!userId) throw new Error("No user ID");
      const payload = { ...patch, updated_at: nowIso() };

      if (isE2EMode()) {
        e2eBrandSlots = getE2EBrandSlots().map((row) =>
          row.id === id && row.user_id === userId ? { ...row, ...payload } : row
        );
        return { id };
      }

      const { error } = await (supabase.from("brand_slots" as any) as any)
        .update(payload)
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["brand-slots", userId] });
    },
  });
}

export function useDeleteBrandSlotMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<{ id: string }> => {
      if (!userId) throw new Error("No user ID");

      if (isE2EMode()) {
        e2eBrandSlots = getE2EBrandSlots().filter(
          (row) => !(row.id === id && row.user_id === userId)
        );
        return { id };
      }

      const { error } = await (supabase.from("brand_slots" as any) as any)
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["brand-slots", userId] });
    },
  });
}

/**
 * Promotes `id` to be the user's default brand slot.
 *
 * Intentionally NOT atomic: this issues two sequential round trips (unmark
 * the current default, then mark the new one) rather than a single
 * transactional statement, because the client has no way to run both writes
 * inside one Postgres transaction through PostgREST. There is a brief window
 * between the two calls (and a failure mode if the second call errors after
 * the first succeeds) where the user has zero rows marked `is_default`.
 * `resolveActiveBrandSlot` (src/lib/brandSlots.ts) is written to tolerate
 * this: it falls back to `slots[0]` when no row has `is_default: true`, so
 * callers never see an "active slot" of `null` just because of this
 * momentary gap.
 */
export function useSetDefaultBrandSlotMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<{ id: string }> => {
      if (!userId) throw new Error("No user ID");

      if (isE2EMode()) {
        e2eBrandSlots = getE2EBrandSlots().map((row) => {
          if (row.user_id !== userId) return row;
          return { ...row, is_default: row.id === id, updated_at: nowIso() };
        });
        return { id };
      }

      const { error: unsetError } = await (supabase.from("brand_slots" as any) as any)
        .update({ is_default: false, updated_at: nowIso() })
        .eq("user_id", userId)
        .eq("is_default", true);
      if (unsetError) throw unsetError;

      const { error: setError } = await (supabase.from("brand_slots" as any) as any)
        .update({ is_default: true, updated_at: nowIso() })
        .eq("id", id)
        .eq("user_id", userId);
      if (setError) throw setError;

      return { id };
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["brand-slots", userId] });
    },
  });
}

export type EnsureDefaultBrandSlotProfileData = {
  forbidden_phrases?: string[] | null;
  proof_points?: string[] | null;
  cta_preferences?: string[] | null;
  preferred_structures?: string[] | null;
  brand_examples?: string[] | null;
  default_framework?: string | null;
} | null;

/**
 * Ensures every account ends up with at least one brand slot by inserting a
 * "Default" slot copying the legacy profile-level brand fields, if any.
 * Reads `profileData` from the already-cached `useProfileQuery` result passed
 * in by the caller — does NOT issue its own profile fetch.
 *
 * If a concurrent call (e.g. two tabs, or a retry) already created the
 * default slot, the partial unique index on `brand_slots` (one
 * `is_default = true` row per user) causes Postgres to raise a unique
 * violation (error code `23505`). That case is treated as a successful
 * no-op rather than surfaced as an error, since the desired end state
 * (a default slot exists) is already satisfied.
 */
export function useEnsureDefaultBrandSlotMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      profileData: EnsureDefaultBrandSlotProfileData
    ): Promise<BrandSlotRow | { skipped: true }> => {
      if (!userId) throw new Error("No user ID");

      const payload: BrandSlotInsert = {
        user_id: userId,
        name: "Default",
        is_default: true,
        forbidden_phrases: profileData?.forbidden_phrases ?? [],
        proof_points: profileData?.proof_points ?? [],
        cta_preferences: profileData?.cta_preferences ?? [],
        preferred_structures: profileData?.preferred_structures ?? [],
        brand_examples: profileData?.brand_examples ?? null,
        default_framework: profileData?.default_framework ?? null,
      };

      if (isE2EMode()) {
        const existing = getE2EBrandSlots().find(
          (row) => row.user_id === userId && row.is_default
        );
        if (existing) return { skipped: true };
        const created: BrandSlotRow = {
          id: `e2e-slot-${Date.now()}`,
          user_id: userId,
          name: payload.name,
          is_default: true,
          forbidden_phrases: payload.forbidden_phrases ?? [],
          proof_points: payload.proof_points ?? [],
          cta_preferences: payload.cta_preferences ?? [],
          preferred_structures: payload.preferred_structures ?? [],
          brand_examples: payload.brand_examples ?? null,
          default_framework: payload.default_framework ?? null,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        e2eBrandSlots = [...getE2EBrandSlots(), created];
        return created;
      }

      const { data, error } = await (supabase.from("brand_slots" as any) as any)
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        // Postgres unique_violation — surfaced by supabase-js/PostgREST as
        // `error.code === "23505"`. A concurrent caller already created the
        // default slot, so treat this as a successful no-op.
        if ((error as { code?: string })?.code === "23505") {
          return { skipped: true };
        }
        throw error;
      }
      return data as unknown as BrandSlotRow;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: ["brand-slots", userId] });
    },
  });
}
