import { Link } from "react-router-dom";
import { Linkedin, Twitter, Github } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { APP_NAME } from "@/constants/branding";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing",  href: "#pricing" },
  { label: "Docs",     href: "#" },
  { label: "Privacy",  href: "/privacy" },
  { label: "Terms",    href: "/terms" },
];

const SOCIALS = [
  { icon: Linkedin, href: "#", label: "ContentForge on LinkedIn" },
  { icon: Twitter,  href: "#", label: "ContentForge on X (Twitter)" },
  { icon: Github,   href: "#", label: "ContentForge on GitHub" },
];

export default function LandingFooter() {
  return (
    <footer className="ld-w-footer" aria-label="Site footer">
      <div className="ld-w-wrap">
        <div className="ld-w-footer-top">
          {/* Logo */}
          <Logo variant="full" size="lg" href="/" className="ld-w-logo" />

          {/* Nav links */}
          <nav className="ld-w-footer-links" aria-label="Footer navigation">
            {NAV_LINKS.map(link => (
              <a key={link.label} href={link.href} className="ld-w-footer-link">
                {link.label}
              </a>
            ))}
          </nav>

          {/* Social icons */}
          <div className="ld-w-footer-socials" role="list" aria-label="ContentForge on social media">
            {SOCIALS.map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                className="ld-w-footer-social"
                aria-label={label}
                role="listitem"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon size={17} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>

        <hr className="ld-w-footer-divider" />

        <div className="ld-w-footer-bottom">
          <span>© {new Date().getFullYear()} {APP_NAME} · Built for content creators</span>
          <span className="ld-w-footer-made">Crafted with care ♥</span>
        </div>
      </div>
    </footer>
  );
}
