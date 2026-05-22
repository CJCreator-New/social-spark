type DraftEnvelope<T> = {
  version: number;
  createdAt: number; // epoch ms
  expiresAt?: number; // epoch ms
  data: T;
};

const PREFIX = "ss:draft:";
const CURRENT_VERSION = 1;

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch (e) {
    return false;
  }
}

function storageKey(key: string) {
  return `${PREFIX}${key}`;
}

export function saveDraft<T>(key: string, data: T, ttlMs?: number) {
  if (!hasLocalStorage()) return;
  const now = Date.now();
  const envelope: DraftEnvelope<T> = {
    version: CURRENT_VERSION,
    createdAt: now,
    expiresAt: ttlMs ? now + ttlMs : undefined,
    data,
  };
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(envelope));
  } catch (err) {
    // best-effort: ignore quota errors
    console.warn("saveDraft failed", err);
  }
}

export function loadDraft<T>(key: string): T | null {
  if (!hasLocalStorage()) return null;
  const raw = window.localStorage.getItem(storageKey(key));
  if (!raw) return null;
  try {
    const env: DraftEnvelope<T> = JSON.parse(raw);
    if (env.expiresAt && Date.now() > env.expiresAt) {
      // expired — cleanup
      window.localStorage.removeItem(storageKey(key));
      return null;
    }
    return env.data as T;
  } catch (err) {
    // corrupted — remove
    window.localStorage.removeItem(storageKey(key));
    return null;
  }
}

export function removeDraft(key: string) {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch (err) {
    // ignore
  }
}

export function cleanupExpiredDrafts() {
  if (!hasLocalStorage()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    const now = Date.now();
    for (const k of keys) {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      try {
        const env = JSON.parse(raw) as DraftEnvelope<unknown>;
        if (env.expiresAt && now > env.expiresAt) {
          window.localStorage.removeItem(k);
        }
      } catch (e) {
        // corrupted — remove
        window.localStorage.removeItem(k);
      }
    }
  } catch (err) {
    // ignore
  }
}

export function listDraftKeys(): string[] {
  if (!hasLocalStorage()) return [];
  const out: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(PREFIX)) out.push(k.substring(PREFIX.length));
  }
  return out;
}

export default {
  saveDraft,
  loadDraft,
  removeDraft,
  cleanupExpiredDrafts,
  listDraftKeys,
};
