const MEDIA_PREFIX = "ss:media:";

export function addMediaRef(key: string, url: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(MEDIA_PREFIX + key) || "[]");
    if (!stored.includes(url)) stored.push(url);
    localStorage.setItem(MEDIA_PREFIX + key, JSON.stringify(stored));
  } catch (e) {
    // ignore
  }
}

export function listMediaRefs(key: string) {
  try {
    return JSON.parse(localStorage.getItem(MEDIA_PREFIX + key) || "[]");
  } catch (e) {
    return [];
  }
}

export function removeMediaRef(key: string, url: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(MEDIA_PREFIX + key) || "[]");
    const next = stored.filter((u: string) => u !== url);
    localStorage.setItem(MEDIA_PREFIX + key, JSON.stringify(next));
  } catch (e) {
    // ignore
  }
}

export async function cleanupOrphanMedia(keys: string[], thresholdMs = 1000 * 60 * 60 * 24 * 7) {
  // keys: list of calendar ids or draft keys to check
  const orphans: string[] = [];
  for (const k of keys) {
    const refs = listMediaRefs(k);
    for (const url of refs) {
      // Simple heuristic: if a ref hasn't been touched (no timestamp tracking here), consider it for manual review
      // In a more complete system we'd track uploadedAt and compare against DB references before deletion.
      orphans.push(url);
    }
  }
  // Return list for caller to decide deletion
  return Array.from(new Set(orphans));
}

export default { addMediaRef, listMediaRefs, removeMediaRef, cleanupOrphanMedia };
