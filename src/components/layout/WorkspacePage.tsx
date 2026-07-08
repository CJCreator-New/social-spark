import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type WorkspacePageSize = "narrow" | "medium" | "wide" | "xwide";

const MAX_WIDTHS: Record<WorkspacePageSize, string> = {
  narrow: "560px",
  medium: "760px",
  wide: "880px",
  xwide: "1120px",
};

interface WorkspacePageProps {
  children: ReactNode;
  size?: WorkspacePageSize;
  className?: string;
}

export function WorkspacePage({ children, size = "medium", className }: WorkspacePageProps) {
  // Intentionally a <div> — AppShell already renders the <main> landmark.
  // Adding a second <main> here would create nested mains, violating HTML5 spec.
  return (
    <div className={cn("page-shell", className)}>
      <div
        className="relative z-10 mx-auto w-full px-4 py-8 sm:px-6"
        style={{ maxWidth: MAX_WIDTHS[size], paddingBottom: "var(--space-16, 64px)" }}
      >
        {children}
      </div>
    </div>
  );
}
