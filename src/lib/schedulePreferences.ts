const STORAGE_PREFIX = "social-spark:schedule:view-timezone";

function storageKey(userId?: string) {
  return `${STORAGE_PREFIX}:${userId || "anonymous"}`;
}

export function loadScheduleTimezone(userId?: string): string | null {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

export function saveScheduleTimezone(userId: string | undefined, timezone: string) {
  if (!userId || !timezone) return;
  try {
    localStorage.setItem(storageKey(userId), timezone);
  } catch {
    // Ignore storage failures; schedule still works without persistence.
  }
}

export function resolveScheduleTimezone(
  userId: string | undefined,
  profileTimezone: string | null | undefined,
  browserTimezone: string
) {
  return loadScheduleTimezone(userId) || profileTimezone || browserTimezone;
}
