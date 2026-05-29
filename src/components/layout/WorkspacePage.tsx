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
  return (
    <main className={cn("page-shell", className)}>
      <h1 className="sr-only">Social Spark workspace</h1>
      <div
        className="relative z-10 mx-auto w-full px-4 py-[52px] sm:px-6"
        style={{ maxWidth: MAX_WIDTHS[size], paddingBottom: "100px" }}
      >
        {children}
      </div>
    </main>
  );
}