let sentryLoaded = false;

type SentryClient = {
  init: (options: { dsn: string }) => void;
  captureException: (err: unknown, options?: { extra?: Record<string, unknown> }) => void;
};

let Sentry: SentryClient | null = null;

export function initSentry(dsn?: string) {
  if (!dsn) return;
  const maybe = (globalThis as { Sentry?: SentryClient }).Sentry;
  if (maybe) {
    Sentry = maybe;
    maybe.init({ dsn });
    sentryLoaded = true;
  } else {
    console.warn("Sentry not initialized");
  }
}

export function captureException(err: unknown, ctx?: Record<string, unknown>) {
  if (sentryLoaded && Sentry) {
    Sentry.captureException(err, { extra: ctx });
  } else {
    console.error("Captured exception", err, ctx || "");
  }
}

export default { initSentry, captureException };
