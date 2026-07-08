// Draft version history — keeps up to MAX_SNAPSHOTS chronological snapshots
// per calendar ID. Stored in localStorage under cf:draft-snapshots:{calendarId}.

const MAX_SNAPSHOTS = 10;
const SNAPSHOT_KEY = (calendarId: string) => `cf:draft-snapshots:${calendarId}`;

export interface DraftSnapshot {
  id: string;       // uuid
  savedAt: string;  // ISO string
  label: string;    // e.g. "Auto-save" or "Before batch regenerate"
  posts: unknown[]; // the full posts array at save time
}

export function readSnapshots(calendarId: string): DraftSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY(calendarId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as DraftSnapshot[];
  } catch {
    return [];
  }
}

export function saveSnapshot(calendarId: string, posts: unknown[], label: string): void {
  const existing = readSnapshots(calendarId);
  const newSnapshot: DraftSnapshot = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    label,
    posts,
  };
  const next = [newSnapshot, ...existing].slice(0, MAX_SNAPSHOTS);
  try {
    localStorage.setItem(SNAPSHOT_KEY(calendarId), JSON.stringify(next));
  } catch {
    // Silently ignore storage quota errors
  }
}

export function deleteSnapshot(calendarId: string, snapshotId: string): void {
  const existing = readSnapshots(calendarId);
  const next = existing.filter((s) => s.id !== snapshotId);
  try {
    localStorage.setItem(SNAPSHOT_KEY(calendarId), JSON.stringify(next));
  } catch {
    // Silently ignore storage quota errors
  }
}

export function clearAllSnapshots(calendarId: string): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY(calendarId));
  } catch {
    // Silently ignore errors
  }
}
