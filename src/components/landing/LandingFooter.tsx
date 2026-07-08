import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { APP_NAME } from "@/constants/branding";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export default function LandingFooter() {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const heroHeight = window.innerHeight;
    const onScroll = () => setShowBackToTop(window.scrollY > heroHeight);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <footer className="ld-w-footer" aria-label="Site footer">
      <button
        type="button"
        className={`ld-w-back-to-top${showBackToTop ? " visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        tabIndex={showBackToTop ? 0 : -1}
      >
        <ArrowUp size={18} aria-hidden="true" />
      </button>
      <div className="ld-w-wrap">
        <div className="ld-w-footer-top">
          {/* Logo */}
          <Logo variant="full" size="lg" href="/" className="ld-w-logo" />

          {/* Nav links */}
          <nav className="ld-w-footer-links" aria-label="Footer navigation">
            {NAV_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="ld-w-footer-link">
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <hr className="ld-w-footer-divider" />

        <div className="ld-w-footer-bottom">
          <span>
            © {new Date().getFullYear()} {APP_NAME} · Built for content creators
          </span>
          <span className="ld-w-footer-made">Crafted with care ♥</span>
        </div>
      </div>
    </footer>
  );
}
