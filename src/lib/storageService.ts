type DraftEnvelope<T> = {
  version: number;
  createdAt: number; // epoch ms
  expiresAt?: number; // epoch ms
  data: T;
};

const PREFIX = "ss:draft:";
const CURRENT_VERSION = 1;

let memoryToken: string | null = null;
function getMemoryToken(): string {
  if (!memoryToken) {
    memoryToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
  return memoryToken;
}

export function getSessionToken(): string {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return getMemoryToken();
  }
  let token = window.sessionStorage.getItem("ss_session_token");
  if (!token) {
    token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    try {
      window.sessionStorage.setItem("ss_session_token", token);
    } catch (e) {
      console.warn("Failed to write to sessionStorage. Using transient in-memory token.", e);
      return getMemoryToken();
    }
  }
  return token;
}

// Simple symmetric encryption using a session key
export function encryptDraftData(text: string, key: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(unescape(encodeURIComponent(result)));
}

export function decryptDraftData(cipher: string, key: string): string {
  try {
    const raw = decodeURIComponent(escape(atob(cipher)));
    let result = "";
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    return "";
  }
}

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
    const token = getSessionToken();
    const serialized = JSON.stringify(envelope);
    const encrypted = encryptDraftData(serialized, token);
    window.localStorage.setItem(storageKey(key), encrypted);
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
    const token = getSessionToken();
    let decrypted = decryptDraftData(raw, token);
    if (!decrypted) {
      // Backwards compatibility for unencrypted legacy drafts
      if (raw.trim().startsWith("{")) {
        decrypted = raw;
        console.warn("Loaded unencrypted legacy draft configuration.");
      } else {
        throw new Error("Decryption failed");
      }
    }
    const env: DraftEnvelope<T> = JSON.parse(decrypted);
    if (env.expiresAt && Date.now() > env.expiresAt) {
      // expired — cleanup
      window.localStorage.removeItem(storageKey(key));
      return null;
    }
    return env.data as T;
  } catch (err) {
    // corrupted or wrong session — remove
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
