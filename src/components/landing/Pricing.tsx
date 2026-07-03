import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const TIERS = [
  {
    id: "free",
    name: "Free",
    monthly: "Free",
    annual: "Free",
    desc: "Perfect for solo creators exploring AI content generation.",
    features: [
      "3 posts per week",
      "2 social platforms",
      "Basic brand voice",
    ],
    cta: "Get started",
    ctaTo: "/auth",
    recommended: false,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: "$29",
    annual: "$23",
    desc: "For content creators who want a full week of posts, every week.",
    features: [
      "Unlimited posts",
      "All 6 platforms",
      "Advanced brand voice",
      "Content calendar export",
      "Performance analytics",
      "Priority support",
      "Custom brief templates",
    ],
    cta: "Start Pro free",
    ctaTo: "/auth?plan=pro",
    recommended: true,
  },
  {
    id: "team",
    name: "Team",
    monthly: "$79",
    annual: "$63",
    desc: "For agencies and teams managing multiple brands.",
    features: [
      "Everything in Pro",
      "Up to 5 brand profiles",
      "Team collaboration",
      "Client export packs",
      "API access",
      "Dedicated onboarding",
      "SLA support",
      "Custom integrations",
      "White-label exports",
      "Advanced analytics",
    ],
    cta: "Contact sales",
    ctaTo: "/auth?plan=team",
    recommended: false,
  },
];

export default function Pricing() {
  const sectionRef   = useRef<HTMLElement>(null);
  const [annual, setAnnual] = useState(false);

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

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

  const toggleBilling = () => {
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!noMotion) {
      const amounts = document.querySelectorAll(".ld-w-price-big");
      gsap.fromTo(amounts, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.25, ease: "power2.out" });
    }
    setAnnual(prev => !prev);
  };

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

          {/* Billing toggle */}
          <button
            className={`ld-w-billing-toggle${annual ? " annual" : ""}`}
            onClick={toggleBilling}
            aria-pressed={annual}
            aria-label={annual ? "Switch to monthly billing" : "Switch to annual billing (save 20%)"}
          >
            <span>Monthly</span>
            <div className="ld-w-toggle-track" aria-hidden="true" />
            <span>Annual</span>
            {!annual && <span className="ld-w-save-badge">Save 20%</span>}
          </button>
        </div>

        <div className="ld-w-pricing-grid" role="list">
          {TIERS.map(tier => (
            <div
              key={tier.id}
              className={`ld-w-price-card${tier.recommended ? " recommended" : ""}`}
              role="listitem"
              aria-label={`${tier.name} plan${tier.recommended ? ", most popular" : ""}`}
            >
              {tier.recommended && (
                <>
                  <div className="ld-w-price-conic-border" aria-hidden="true" />
                  <span className="ld-w-recommended-badge" aria-hidden="true">Most popular</span>
                </>
              )}

              <div className="ld-w-price-tier">{tier.name}</div>

              <div className="ld-w-price-amount">
                <span className="ld-w-price-big">
                  {tier.id === "free" ? "Free" : (annual ? tier.annual : tier.monthly)}
                </span>
                {tier.id !== "free" && (
                  <span className="ld-w-price-period">/ month</span>
                )}
              </div>

              <p className="ld-w-price-desc">{tier.desc}</p>

              <hr className="ld-w-price-divider" />

              <ul className="ld-w-price-features" role="list">
                {tier.features.map(f => (
                  <li key={f} role="listitem">
                    <span className="check" aria-hidden="true">✓</span>
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
