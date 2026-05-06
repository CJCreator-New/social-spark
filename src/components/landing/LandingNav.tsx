import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

interface LandingNavProps {
  signedIn: boolean;
}

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav({ signedIn }: LandingNavProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <Link to={signedIn ? "/app" : "/"} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <Sparkles className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <div className="font-['Manrope'] text-lg font-extrabold text-white">ContentForge</div>
            <div className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">AI content studio</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-foreground/75 transition hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {signedIn ? (
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20"
            >
              Open app
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link to="/auth" className="hidden text-sm text-foreground/75 transition hover:text-white sm:inline-flex">
                Sign in
              </Link>
              <Link
                to="/auth?mode=signup"
                className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,hsl(199_89%_48%)_0%,hsl(262_83%_58%)_100%)] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(14,165,233,0.25)] transition hover:brightness-110"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
