import * as Sentry from '@sentry/react';

export function initMonitoring() {
  const dsn = process.env.SENTRY_DSN || (typeof window !== 'undefined' && (window as any)?.__ENV__?.SENTRY_DSN);
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
}

export function captureException(e: unknown) {
  if ((Sentry as any).captureException) (Sentry as any).captureException(e);
}

export function addBreadcrumb(message: string, data?: Record<string, any>) {
  if ((Sentry as any).addBreadcrumb) (Sentry as any).addBreadcrumb({ message, data });
}
