export const SCHEDULER_PROVIDERS = ["buffer", "hootsuite"] as const;
export type SchedulerKeyProvider = (typeof SCHEDULER_PROVIDERS)[number];

export const MAX_SCHEDULER_KEY_LENGTH = 512;

export type SchedulerKeyCheck = { ok: true } | { ok: false; reason: string };

export function isSchedulerProvider(value: unknown): value is SchedulerKeyProvider {
  return typeof value === "string" && (SCHEDULER_PROVIDERS as readonly string[]).includes(value);
}

/** Pure validation, mirrored in supabase/functions/save-scheduler-key. */
export function validateSchedulerKey(provider: unknown, key: unknown): SchedulerKeyCheck {
  if (!isSchedulerProvider(provider)) return { ok: false, reason: "Unsupported provider." };
  if (typeof key !== "string" || key.length === 0) {
    return { ok: false, reason: "Enter an access token." };
  }
  if (key.length > MAX_SCHEDULER_KEY_LENGTH) {
    return { ok: false, reason: "That token is too long." };
  }
  if (/\s/.test(key)) {
    return { ok: false, reason: "The token must not contain spaces or line breaks." };
  }
  // Printable ASCII only (no control characters).
  if (!/^[\x21-\x7E]+$/.test(key)) {
    return { ok: false, reason: "The token has characters that are not allowed." };
  }
  return { ok: true };
}
