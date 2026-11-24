/**
 * Pure decision logic for wizard draft recovery.
 *
 * Given the draft stored in this browser (local) and the draft stored on the
 * user's account (server), decide whether to restore silently, ask the user, or
 * do nothing. Drafts older than `maxAgeMs` are ignored and reported via `expired`.
 */

export interface DraftCandidate<T = unknown> {
  savedAt: number;
  data: T;
}

export type DraftConflictKind = "none" | "use-local" | "use-server" | "ask";

export interface DraftConflictResult<T = unknown> {
  kind: DraftConflictKind;
  local: DraftCandidate<T> | null;
  server: DraftCandidate<T> | null;
  /** Which sides held a draft that was dropped because it was too old. */
  expired: { local: boolean; server: boolean };
  /** Both sides hold the same data. kind is "none" (nothing to choose), but a draft still exists. */
  identical: boolean;
}

export const DRAFT_DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** JSON.stringify with sorted keys, so jsonb key reordering does not look like a change. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** Compare drafts ignoring the snapshot's own top-level `savedAt` stamp. */
export function draftDataEqual(a: unknown, b: unknown): boolean {
  const strip = (v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const { savedAt: _ignored, ...rest } = v as Record<string, unknown>;
      return rest;
    }
    return v;
  };
  return stableStringify(strip(a)) === stableStringify(strip(b));
}

export function resolveDraftConflict<T>(
  local: DraftCandidate<T> | null | undefined,
  server: DraftCandidate<T> | null | undefined,
  opts: { now?: number; maxAgeMs?: number } = {}
): DraftConflictResult<T> {
  const now = opts.now ?? Date.now();
  const maxAge = opts.maxAgeMs ?? DRAFT_DEFAULT_MAX_AGE_MS;
  const isExpired = (d: DraftCandidate<T>) => now - d.savedAt > maxAge;

  const expired = {
    local: !!local && isExpired(local),
    server: !!server && isExpired(server),
  };
  const liveLocal = local && !expired.local ? local : null;
  const liveServer = server && !expired.server ? server : null;

  let kind: DraftConflictKind;
  if (!liveLocal && !liveServer) kind = "none";
  else if (liveLocal && !liveServer) kind = "use-local";
  else if (!liveLocal && liveServer) kind = "use-server";
  else if (draftDataEqual(liveLocal!.data, liveServer!.data)) kind = "none";
  else kind = "ask";

  const identical = !!liveLocal && !!liveServer && kind === "none";
  return { kind, local: liveLocal, server: liveServer, expired, identical };
}
