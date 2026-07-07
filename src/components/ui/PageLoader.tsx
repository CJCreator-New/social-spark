import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  /** Screen-reader-only label; also used as aria-live announcement. */
  label?: string;
  /** Icon size in px. */
  size?: number;
  /** Set false to render inline (e.g. inside a Suspense boundary section) instead of min-h-screen. */
  fullScreen?: boolean;
  className?: string;
}

/** Shared warm-editorial loading spinner for full-page and section-level loading states. */
export function PageLoader({
  label = "Loading…",
  size = 28,
  fullScreen = true,
  className = "",
}: PageLoaderProps) {
  return (
    <div
      className={`flex items-center justify-center bg-background ${fullScreen ? "min-h-screen" : "min-h-[200px]"} ${className}`}
      aria-live="polite"
    >
      <Loader2 className="animate-spin text-primary" size={size} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default PageLoader;
