let sentryLoaded = false;
let Sentry: any = null;

export function initSentry(dsn?: string) {
  if (!dsn) return;
  try {
    // Lazy-load @sentry/browser if available
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const maybe = require("@sentry/browser");
    Sentry = maybe;
    Sentry.init({ dsn });
    sentryLoaded = true;
  } catch (e) {
    // not installed or failed — noop
    // eslint-disable-next-line no-console
    console.warn("Sentry not initialized", e);
  }
}

export function captureException(err: unknown, ctx?: Record<string, unknown>) {
  if (sentryLoaded && Sentry) {
    Sentry.captureException(err, { extra: ctx });
  } else {
    // fallback logging
    // eslint-disable-next-line no-console
    console.error("Captured exception", err, ctx || "");
  }
}

export default { initSentry, captureException };
