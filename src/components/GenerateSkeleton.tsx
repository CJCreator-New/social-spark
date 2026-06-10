import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the two-column results layout (see IndexResults.tsx / .step4-layout):
 * a wider main column with the post detail card (week strip, hook, body, cta, tags)
 * and a narrower sticky side column with smaller summary cards.
 */
export default function GenerateSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-4 items-start mt-4">
      {/* Main column */}
      <div className="min-w-0 space-y-4">
        {/* Reformat / toolbar bar */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-44 rounded-lg ml-auto" />
        </div>

        {/* Week strip */}
        <div className="flex gap-2 overflow-x-auto">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-20 flex-shrink-0 rounded-lg" />
          ))}
        </div>

        {/* Post detail card */}
        <div className="rounded-2xl border border-border p-6 space-y-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <div className="flex gap-2 flex-wrap">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Side column */}
      <div className="space-y-4">
        <div className="rounded-2xl border border-border p-4 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
        <div className="rounded-2xl border border-border p-4 space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <div className="rounded-2xl border border-border p-4 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
