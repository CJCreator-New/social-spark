import { Link } from "react-router-dom";

interface FooterProps {
  signedIn: boolean;
}

export function Footer({ signedIn }: FooterProps) {
  return (
    <footer className="border-t border-white/10 bg-black/10">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-['Manrope'] text-3xl font-extrabold text-white">Ready to build your next content week?</h2>
            <p className="mt-3 max-w-2xl text-foreground/70">
              Start with the landing page today, end up in a real publishing workflow by the time you’re signed in.
            </p>
          </div>
          <Link
            to={signedIn ? "/app" : "/auth?mode=signup"}
            className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,hsl(199_89%_48%)_0%,hsl(262_83%_58%)_100%)] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {signedIn ? "Open app" : "Get started free"}
          </Link>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-foreground/60 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-4">
            <Link to="/auth" className="transition hover:text-white">Auth</Link>
            {signedIn && <Link to="/profile" className="transition hover:text-white">Profile</Link>}
            <a href="mailto:hello@contentforge.app" className="transition hover:text-white">hello@contentforge.app</a>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="transition hover:text-white">GitHub</a>
          </div>
          <div>ContentForge beta</div>
        </div>
      </div>
    </footer>
  );
}
