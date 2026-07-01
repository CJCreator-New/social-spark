import { useEffect, useRef, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const FooterCanvas = lazy(() => import("./FooterCanvas"));

export default function FinalCTA() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    const copy   = sectionRef.current.querySelector(".ld-w-final-copy");
    const canvas = sectionRef.current.querySelector(".ld-w-final-canvas");

    if (copy) {
      gsap.fromTo(copy, { y: 32, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: sectionRef.current, start: "top 80%", toggleActions: "play none none none" },
      });
    }
    if (canvas) {
      gsap.fromTo(canvas, { opacity: 0 }, {
        opacity: 1, duration: 0.8, delay: 0.3, ease: "power2.out",
        scrollTrigger: { trigger: sectionRef.current, start: "top 80%", toggleActions: "play none none none" },
      });
    }

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="ld-w-final-section ld-w-section"
      aria-labelledby="final-cta-heading"
    >
      <div className="ld-w-wrap">
        <div className="ld-w-final-panel">
          <div className="ld-w-final-grid">
            {/* Copy */}
            <div className="ld-w-final-copy">
              <span className="ld-w-eyebrow">Get Started Today</span>
              <h2 id="final-cta-heading" className="ld-w-final-h2">
                Start creating <em>brilliant</em> content today.
              </h2>
              <p className="ld-w-final-sub">
                Join thousands of content creators who ship a full week of posts in under a minute. Free to start, no credit card required.
              </p>
              <div className="ld-w-final-actions">
                <Link
                  to="/auth"
                  className="ld-w-cta-primary"
                  aria-label="Get started free with ContentForge"
                >
                  Get started free
                </Link>
                <a href="#how-it-works" className="ld-w-final-link" aria-label="See how ContentForge works">
                  See a demo <ArrowRight size={14} aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* Canvas */}
            <div className="ld-w-final-canvas" aria-hidden="true">
              <Suspense fallback={null}>
                <FooterCanvas />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
