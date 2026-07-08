import { useEffect, useRef } from "react";
import {
  useBrandSlotsQuery,
  useEnsureDefaultBrandSlotMutation,
  type EnsureDefaultBrandSlotProfileData,
} from "./useBrandSlotQueries";

/**
 * Thin convenience wrapper meant to be called from page components (e.g.
 * Index.tsx, Profile.tsx): fires `useEnsureDefaultBrandSlotMutation` at most
 * once per mount if the brand-slots query has resolved with zero rows,
 * guaranteeing every account ends up with a default slot without requiring
 * each page to duplicate this bootstrap logic.
 *
 * Deliberately NOT a `useEffect`-driven state sync between two stores (which
 * would violate the "no fragile side effects" rule) — this only fires a
 * one-shot store *action* (the mutation) exactly once per mount, guarded by
 * a ref, in response to a query settling. No component state is derived or
 * mirrored here.
 */
export function useEnsureDefaultBrandSlot(
  userId: string | undefined,
  profileData: EnsureDefaultBrandSlotProfileData
) {
  const slotsQuery = useBrandSlotsQuery(userId);
  const ensureMutation = useEnsureDefaultBrandSlotMutation(userId);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (!userId) return;
    if (!slotsQuery.isSuccess) return;
    if ((slotsQuery.data ?? []).length > 0) return;

    firedRef.current = true;
    ensureMutation.mutate(profileData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, slotsQuery.isSuccess, slotsQuery.data]);

  return slotsQuery;
}
