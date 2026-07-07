import { Skeleton } from "@/components/ui/skeleton";

interface ScheduleSkeletonProps {
  rows?: number;
}

/**
 * Mirrors the real Schedule table row layout (.sc-row in Schedule.tsx):
 * a time column, a meta column (title + platform tag + status chip), and
 * trailing action buttons.
 */
export function ScheduleSkeleton({ rows = 5 }: ScheduleSkeletonProps) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border p-4 flex gap-4 items-start flex-wrap"
        >
          {/* Time column */}
          <div className="flex flex-col gap-1 min-w-[88px]">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>

          {/* Meta column: title + platform tag + status chip */}
          <div className="flex-1 min-w-[200px] space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-shrink-0">
            <Skeleton className="h-7 w-14 rounded-md" />
            <Skeleton className="h-7 w-14 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default ScheduleSkeleton;
