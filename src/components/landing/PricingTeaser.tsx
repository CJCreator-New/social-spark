import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck } from "lucide-react";

interface PricingTeaserProps {
  signedIn: boolean;
}

export function PricingTeaser({ signedIn }: PricingTeaserProps) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(10,18,32,0.95),rgba(17,24,39,0.75))] p-8 text-center shadow-[0_24px_80px_rgba(14,165,233,0.14)]">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-cyan-100/80">
          <BadgeCheck className="h-4 w-4" />
          Pricing
        </div>
        <h2 className="mt-6 font-['Manrope'] text-3xl font-extrabold text-white sm:text-4xl">Free during beta</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-foreground/70">
          Use the generator, scheduling helpers, exports, and policy controls while we keep sharpening the product.
        </p>
        <Link
          to={signedIn ? "/app" : "/auth?mode=signup"}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,hsl(199_89%_48%)_0%,hsl(262_83%_58%)_100%)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
        >
          {signedIn ? "Open app" : "Get started"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
