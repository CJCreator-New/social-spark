import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

gsap.registerPlugin(ScrollTrigger);

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing",  href: "#pricing" },
  { label: "Docs",     href: "#" },
];

export default function LandingNav() {
  const navRef   = useRef<HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const firstDrawerLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!navRef.current) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!noMotion) {
      gsap.fromTo(navRef.current, { y: -64, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" });
    }

    ScrollTrigger.create({
      start: "top+=80 top",
      onEnter:     () => navRef.current?.classList.add("scrolled"),
      onLeaveBack: () => navRef.current?.classList.remove("scrolled"),
    });

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

  // Focus management for drawer
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => firstDrawerLinkRef.current?.focus());
    } else {
      document.body.style.overflow = "";
      hamburgerRef.current?.focus();
    }
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setDrawerOpen(false);
  };

  return (
    <>
      <nav ref={navRef} className="ld-w-nav" aria-label="Main navigation">
        <div className="ld-w-nav-inner">
          {/* Logo */}
          <Logo variant="full" size="lg" href="/" className="ld-w-logo" />

          {/* Desktop nav links */}
          <ul className="ld-w-nav-links" role="list">
            {NAV_LINKS.map(link => (
              <li key={link.label}>
                <a href={link.href} className="ld-w-nav-link">{link.label}</a>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link to="/auth" className="ld-w-nav-cta" aria-label="Start your free trial with ContentForge">
              Start free <span className="arrow" aria-hidden="true">→</span>
            </Link>
            {/* Hamburger */}
            <button
              ref={hamburgerRef}
              className="ld-w-nav-hamburger"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="nav-drawer"
              aria-label="Open navigation menu"
            >
              <Menu size={20} color="#57534e" aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>

      {/* Drawer backdrop — rendered BEFORE drawer; z-51 above nav(50) but below drawer(52) */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 51,
          }}
        />
      )}

      {/* Mobile drawer */}
      <div
        id="nav-drawer"
        className={`ld-w-nav-drawer${drawerOpen ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        onKeyDown={handleKeyDown}
      >
        <button
          onClick={() => setDrawerOpen(false)}
          aria-label="Close navigation menu"
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px",
            borderRadius: "8px",
            color: "#57534e",
            zIndex: 1,
          }}
        >
          <X size={22} />
        </button>

        {NAV_LINKS.map((link, i) => (
          <a
            key={link.label}
            href={link.href}
            ref={i === 0 ? firstDrawerLinkRef : undefined}
            onClick={() => setDrawerOpen(false)}
          >
            {link.label}
          </a>
        ))}
        <Link
          to="/auth"
          onClick={() => setDrawerOpen(false)}
          style={{ color: "#c2410c" }}
        >
          Start free →
        </Link>
      </div>
    </>
  );
}
