/**
 * Idea Backlog Service
 *
 * Persists extracted content ideas (angles) from the Source-to-Post feature
 * to localStorage on a per-user basis. Ideas are saved when extracted and can
 * be drafted or removed later.
 *
 * Usage:
 * ```typescript
 * import { addIdeasToBacklog, readIdeaBacklog } from '@/lib/ideaBacklog';
 *
 * // Save ideas from an extraction
 * const backlog = addIdeasToBacklog(userId, ideas, sourceText, 'linkedin');
 *
 * // Read the current backlog
 * const items = readIdeaBacklog(userId);
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export interface IdeaBacklogItem {
  /** Unique ID for this idea (UUID) */
  id: string;
  /** The idea / angle text */
  angle: string;
  /** First 120 chars of the source text that generated this idea */
  sourceSnippet: string;
  /** Optional platform this idea is targeted at */
  platform?: string;
  /** ISO date string of when the idea was created */
  createdAt: string;
  /** ISO date string of when the idea was drafted (undefined = not yet used) */
  usedAt?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BACKLOG_KEY = (userId: string) => `cf:idea-backlog:${userId}`;
const MAX_BACKLOG = 50;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Read the current idea backlog for a user from localStorage.
 * Returns an empty array on any parse / access error.
 *
 * @param userId The authenticated user's ID
 * @returns Array of IdeaBacklogItem (newest-first)
 */
export function readIdeaBacklog(userId: string): IdeaBacklogItem[] {
  try {
    const raw = localStorage.getItem(BACKLOG_KEY(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as IdeaBacklogItem[];
  } catch {
    return [];
  }
}

/**
 * Add a batch of ideas to the backlog.
 * New items are prepended so they appear at the top. The list is capped at
 * MAX_BACKLOG (50) entries to avoid unbounded localStorage growth.
 *
 * @param userId      The authenticated user's ID
 * @param ideas       Array of idea / angle strings to save
 * @param sourceText  The original source text (first 120 chars stored)
 * @param platform    Optional platform label (e.g. "linkedin")
 * @returns The updated backlog array
 */
export function addIdeasToBacklog(
  userId: string,
  ideas: string[],
  sourceText: string,
  platform?: string
): IdeaBacklogItem[] {
  const existing = readIdeaBacklog(userId);
  const snippet = sourceText.slice(0, 120);
  const now = new Date().toISOString();

  const newItems: IdeaBacklogItem[] = ideas.map((angle) => ({
    id: crypto.randomUUID(),
    angle,
    sourceSnippet: snippet,
    platform,
    createdAt: now,
  }));

  // Prepend new items, then cap
  const updated = [...newItems, ...existing].slice(0, MAX_BACKLOG);
  _save(userId, updated);
  return updated;
}

/**
 * Mark an idea as used / drafted.
 * Sets the `usedAt` field to the current ISO timestamp.
 *
 * @param userId  The authenticated user's ID
 * @param ideaId  The ID of the idea to mark as used
 */
export function markIdeaAsUsed(userId: string, ideaId: string): void {
  const backlog = readIdeaBacklog(userId);
  const updated = backlog.map((item) =>
    item.id === ideaId ? { ...item, usedAt: new Date().toISOString() } : item
  );
  _save(userId, updated);
}

/**
 * Permanently remove an idea from the backlog.
 *
 * @param userId  The authenticated user's ID
 * @param ideaId  The ID of the idea to remove
 */
export function removeIdeaFromBacklog(userId: string, ideaId: string): void {
  const backlog = readIdeaBacklog(userId);
  const updated = backlog.filter((item) => item.id !== ideaId);
  _save(userId, updated);
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

function _save(userId: string, backlog: IdeaBacklogItem[]): void {
  try {
    localStorage.setItem(BACKLOG_KEY(userId), JSON.stringify(backlog));
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}
