import { SkeletonList } from "@/components/SkeletonList";
import { LogoMark } from "@/components/brand/Logo";
import { APP_NAME } from "@/constants/branding";

interface RouteFallbackProps {
  title?: string;
  ariaLabel?: string;
  /**
   * Set when this fallback renders inside AppShell's own <main id="main-content">
   * (all authenticated routes). AppShell already owns the landmark there, so
   * rendering a second <main> would nest landmarks while the route chunk loads
   * (confirmed via axe: landmark-main-is-top-level / landmark-no-duplicate-main).
   * Standalone/public routes keep the <main> landmark since nothing else provides one.
   */
  nested?: boolean;
}

export function RouteFallback({
  title = APP_NAME,
  ariaLabel = "Loading page",
  nested = false,
}: RouteFallbackProps) {
  const Tag = nested ? "div" : "main";
  // role="status" only when nested — a <main> already has the landmark role;
  // overriding it with role="status" would strip that role and reintroduce
  // "no main landmark" on standalone/public routes.
  return (
    <Tag
      role={nested ? "status" : undefined}
      aria-label={ariaLabel}
      className="min-h-screen bg-background text-foreground px-4 py-8 md:px-6"
    >
      <div className="mx-auto flex min-h-[70vh] w-full max-w-7xl flex-col justify-center rounded-3xl border border-border bg-card/80 px-4 py-8 shadow-[var(--shadow-card)] backdrop-blur-sm md:px-8">
        <LogoMark size="lg" animated className="mb-4" />
        <h1 className="font-display text-3xl font-normal mb-4 md:text-4xl">{title}</h1>
        <div className="mb-8 max-w-2xl text-sm leading-6 text-muted-foreground">
          Loading the workspace and restoring your session state.
        </div>
        <div className="mx-auto w-full">
          <SkeletonList rows={3} />
        </div>
      </div>
    </Tag>
  );
}

export default RouteFallback;
