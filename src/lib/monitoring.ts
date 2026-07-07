type SentryLike = {
  captureException?: (error: unknown) => void;
  addBreadcrumb?: (entry: { message: string; data?: Record<string, unknown> }) => void;
};

type RuntimeWindow = Window & { __ENV__?: Record<string, string>; Sentry?: SentryLike };

function getSentry(): SentryLike | undefined {
  if (typeof window === "undefined") return (globalThis as { Sentry?: SentryLike }).Sentry;
  return (window as RuntimeWindow).Sentry;
}

export function initMonitoring() {
  const runtimeWindow = typeof window !== "undefined" ? (window as RuntimeWindow) : undefined;
  const dsn = process.env.SENTRY_DSN || runtimeWindow?.__ENV__?.SENTRY_DSN;
  if (!dsn) return;
  const sentry = getSentry();
  sentry?.addBreadcrumb?.({ message: "monitoring_initialized", data: { tracesSampleRate: 0.1 } });
}

export function captureException(e: unknown) {
  getSentry()?.captureException?.(e);
}

export function addBreadcrumb(message: string, data?: Record<string, unknown>) {
  getSentry()?.addBreadcrumb?.({ message, data });
}
