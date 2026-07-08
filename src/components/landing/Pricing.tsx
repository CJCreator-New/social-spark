import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { PLAN_TIERS, type PlanTierId } from "@/constants/plans";

gsap.registerPlugin(ScrollTrigger);

const TIER_META: Record<
  PlanTierId,
  { desc: string; cta: string; ctaTo: string; recommended: boolean }
> = {
  free: {
    desc: "Perfect for solo creators exploring AI content generation.",
    cta: "Get started",
    ctaTo: "/auth",
    recommended: false,
  },
  starter: {
    desc: "For growing creators who want consistent platform updates.",
    cta: "Choose Starter",
    ctaTo: "/auth?plan=starter",
    recommended: false,
  },
  pro: {
    desc: "For content teams and creators with high-volume pipelines.",
    cta: "Get Pro Now",
    ctaTo: "/auth?plan=pro",
    recommended: true,
  },
};

const TIERS = PLAN_TIERS.map((tier) => ({ ...tier, ...TIER_META[tier.id] }));

export default function Pricing() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    const cards = sectionRef.current.querySelectorAll(".ld-w-price-card");
    gsap.fromTo(
      cards,
      { y: 48, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.12,
        duration: 0.85,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 78%",
          toggleActions: "play none none none",
        },
      }
    );

    const featureItems = sectionRef.current.querySelectorAll(".ld-w-price-features li");
    gsap.fromTo(
      featureItems,
      { x: -8, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        stagger: 0.03,
        duration: 0.4,
        ease: "power2.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 70%",
          toggleActions: "play none none none",
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="ld-w-pricing-section ld-w-section"
      aria-labelledby="pricing-heading"
      id="pricing"
    >
      <div className="ld-w-wrap">
        <div className="ld-w-pricing-head">
          <span className="ld-w-eyebrow">Pricing</span>
          <h2 id="pricing-heading" className="ld-w-h2">
            Simple, <em>transparent</em> pricing
          </h2>
          <p className="ld-w-pricing-sub">Start free. Upgrade when you need it. No hidden fees.</p>
        </div>

        <div className="ld-w-pricing-grid" role="list">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`ld-w-price-card${tier.recommended ? " recommended" : ""}`}
              role="listitem"
              aria-label={`${tier.name} plan${tier.recommended ? ", most popular" : ""}`}
            >
              {tier.recommended && (
                <>
                  <div className="ld-w-price-conic-border" aria-hidden="true" />
                  <span className="ld-w-recommended-badge" aria-hidden="true">
                    Most popular
                  </span>
                </>
              )}

              <div className="ld-w-price-tier">{tier.name}</div>

              <div className="ld-w-price-amount">
                <span className="ld-w-price-big">
                  {tier.price}
                </span>
                {tier.id !== "free" && <span className="ld-w-price-period">/ month</span>}
              </div>

              <p className="ld-w-price-desc">{tier.desc}</p>

              <hr className="ld-w-price-divider" />

              <ul className="ld-w-price-features" role="list">
                {tier.features.map((f) => (
                  <li key={f} role="listitem">
                    <span className="check" aria-hidden="true">
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="ld-w-price-cta">
                {tier.recommended ? (
                  <Link to={tier.ctaTo} className="ld-w-price-btn-primary">
                    {tier.cta}
                  </Link>
                ) : (
                  <Link to={tier.ctaTo} className="ld-w-price-btn-ghost">
                    {tier.cta}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
