import { useEffect, useRef } from "react";
import { gsap } from "gsap";

// Placeholder SVG company logos
const LOGOS = [
  { name: "Acme Corp",    svg: <text x="0" y="18" fontSize="18" fontWeight="700" fontFamily="Inter, system-ui, sans-serif" fill="currentColor">Acme Corp</text> },
  { name: "Contoso",      svg: <text x="0" y="18" fontSize="18" fontWeight="700" fontFamily="Inter, system-ui, sans-serif" fill="currentColor">Contoso</text> },
  { name: "Northwind",    svg: <text x="0" y="18" fontSize="18" fontWeight="700" fontFamily="Inter, system-ui, sans-serif" fill="currentColor">Northwind</text> },
  { name: "Fabrikam",     svg: <text x="0" y="18" fontSize="18" fontWeight="700" fontFamily="Inter, system-ui, sans-serif" fill="currentColor">Fabrikam</text> },
  { name: "Tailspin",     svg: <text x="0" y="18" fontSize="18" fontWeight="700" fontFamily="Inter, system-ui, sans-serif" fill="currentColor">Tailspin</text> },
  { name: "AdventureWks", svg: <text x="0" y="18" fontSize="18" fontWeight="700" fontFamily="Inter, system-ui, sans-serif" fill="currentColor">Adventure</text> },
];

// Duplicate for seamless loop
const ALL_LOGOS = [...LOGOS, ...LOGOS];

export default function SocialProofBar() {
  const innerRef  = useRef<HTMLDivElement>(null);
  const tweenRef  = useRef<gsap.core.Tween | null>(null);
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;

  useEffect(() => {
    if (!innerRef.current || !isDesktop) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    tweenRef.current = gsap.to(innerRef.current, {
      x: "-50%",
      duration: 30,
      ease: "none",
      repeat: -1,
    });

    return () => { tweenRef.current?.kill(); };
  }, [isDesktop]);

  const pauseTicker = () => tweenRef.current?.pause();
  const resumeTicker = () => tweenRef.current?.resume();

  return (
    <section
      className="ld-w-proof ld-w-section"
      aria-label="Trusted by content teams"
      onMouseEnter={pauseTicker}
      onMouseLeave={resumeTicker}
    >
      <p className="ld-w-proof-label">Trusted by content teams at</p>
      <div className="ld-w-logos-track" aria-hidden="true">
        <div ref={innerRef} className="ld-w-logos-inner">
          {ALL_LOGOS.map((logo, i) => (
            <div
              key={`${logo.name}-${i}`}
              className="ld-w-logo-item"
              title={logo.name}
            >
              <svg
                viewBox="0 0 120 24"
                width="120"
                height="24"
                style={{ color: "#5a5753" }}
              >
                {logo.svg}
              </svg>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
