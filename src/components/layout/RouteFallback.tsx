import { SkeletonList } from "@/components/SkeletonList";

interface RouteFallbackProps {
  title?: string;
  ariaLabel?: string;
}

export function RouteFallback({ title = "ContentForge", ariaLabel = "Loading page" }: RouteFallbackProps) {
  return (
    <main aria-label={ariaLabel} className="min-h-screen bg-[#07080d] text-[#edeae3] p-6">
      <h1 className="font-serif text-3xl font-normal text-white mb-6" style={{ margin: "24px 24px 12px 24px" }}>
        {title}
      </h1>
      <div className="mx-auto max-w-7xl px-6">
        <SkeletonList rows={3} />
      </div>
    </main>
  );
}

export default RouteFallback;
