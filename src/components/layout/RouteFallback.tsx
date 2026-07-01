import { SkeletonList } from "@/components/SkeletonList";

interface RouteFallbackProps {
  title?: string;
  ariaLabel?: string;
}

export function RouteFallback({ title = "ContentForge", ariaLabel = "Loading page" }: RouteFallbackProps) {
  return (
    <main aria-label={ariaLabel} className="min-h-screen bg-background text-foreground px-4 py-8 md:px-6">
      <div className="mx-auto flex min-h-[70vh] w-full max-w-7xl flex-col justify-center rounded-3xl border border-border bg-card/80 px-4 py-8 shadow-[var(--shadow-card)] backdrop-blur-sm md:px-8">
        <h1 className="font-display text-3xl font-normal mb-4 md:text-4xl">
          {title}
        </h1>
        <div className="mb-8 max-w-2xl text-sm leading-6 text-muted-foreground">
          Loading the workspace and restoring your session state.
        </div>
        <div className="mx-auto w-full">
          <SkeletonList rows={3} />
        </div>
      </div>
    </main>
  );
}

export default RouteFallback;
