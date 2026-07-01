import { useEffect, useRef, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { Play } from "lucide-react";

const HeroCanvas = lazy(() => import("./HeroCanvas"));

const PREVIEW_POSTS = [
  { day: "Mon", title: "The hook that stops the scroll", desc: "LinkedIn · Thought leadership thread" },
  { day: "Wed", title: "Behind the scenes reveal", desc: "Instagram · Story + carousel" },
  { day: "Fri", title: "Data insight your audience needs", desc: "X · Thread with infographic" },
];

const STATS = [
  { value: "7", label: "Drafts" },
  { value: "4",  label: "Channels" },
  { value: "1",  label: "Week" },
  { value: "<1m", label: "Time" },
];

export default function LandingHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isTouchDevice = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

  // Hero GSAP entrance
  useEffect(() => {
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
    tl.fromTo(".ld-w-eyebrow",        { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, 0.5)
      .fromTo(".ld-w-hero-h1",        { y: 32, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, "-=0.5")
      .fromTo(".ld-w-hero-lede",      { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, "-=0.6")
      .fromTo(".ld-w-ctas",           { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, "-=0.5")
      .fromTo(".ld-w-trust > *",      { y: 12, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.5 }, "-=0.4")
      .fromTo(".ld-w-preview-shell",  { scale: 0.94, opacity: 0, y: 24 }, { scale: 1, opacity: 1, y: 0, duration: 1.2 }, "-=0.9");

    // Delayed post row entrance to simulate AI generation
    setTimeout(() => {
      const rows = document.querySelectorAll(".ld-w-day-row");
      if (noMotion) return;
      gsap.fromTo(rows, { y: 8, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.18, duration: 0.5, ease: "power2.out" });
    }, 1500);

    return () => { tl.kill(); };
  }, []);

  // 3D card tilt on mouse move
  useEffect(() => {
    if (isTouchDevice || !previewRef.current) return;
    const card = previewRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rx = ((e.clientY - cy) / rect.height) * 8;
      const ry = ((e.clientX - cx) / rect.width) * -8;
      card.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.01)`;
    };

    const handleMouseLeave = () => {
      card.style.transform = "perspective(1200px) rotateX(0deg) rotateY(0deg) scale(1)";
      card.style.transition = "transform 0.6s cubic-bezier(0.34,1.56,0.64,1)";
    };

    const section = sectionRef.current;
    section?.addEventListener("mousemove", handleMouseMove);
    section?.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      section?.removeEventListener("mousemove", handleMouseMove);
      section?.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [isTouchDevice]);

  const isWide = typeof window !== "undefined" && window.innerWidth >= 768;

  return (
    <section ref={sectionRef} className="ld-w-hero ld-w-section" aria-labelledby="hero-heading">
      <div className="ld-w-wrap">
        <div className="ld-w-hero-grid">
          {/* Copy */}
          <div className="ld-w-hero-copy">
            <span className="ld-w-eyebrow" aria-label="AI-powered content creation">
              AI-Powered Content Creation
            </span>

            <h1 id="hero-heading" className="ld-w-hero-h1">
              Turn one brief into a week of <em>finished</em> posts.
            </h1>

            <p className="ld-w-hero-lede">
              ContentForge reads your brand voice, respects platform limits, and delivers a full week of draft-ready posts — in under a minute.
            </p>

            <div className="ld-w-ctas">
              <Link
                to="/auth"
                className="ld-w-cta-primary"
                aria-label="Get started free with ContentForge"
              >
                Get started free
              </Link>
              <button
                type="button"
                className="ld-w-cta-secondary"
                aria-label="See how ContentForge works"
                onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
              >
                <Play size={14} className="play-icon" aria-hidden="true" />
                Watch 60s demo
              </button>
            </div>

            <div className="ld-w-trust" role="list" aria-label="Trust indicators">
              <span className="ld-w-trust-chip" role="listitem">
                <span className="check" aria-hidden="true">✓</span> No credit card required
              </span>
              <span className="ld-w-trust-chip" role="listitem">
                <span className="check" aria-hidden="true">✓</span> 7 posts in under 1 minute
              </span>
            </div>
          </div>

          {/* Visual */}
          <div className="ld-w-hero-visual">
            {/* Canvas behind card — only on desktop */}
            {isWide ? (
              <div className="ld-w-hero-canvas-wrap" aria-hidden="true">
                <Suspense fallback={null}>
                  <HeroCanvas />
                </Suspense>
              </div>
            ) : (
              <div className="ld-w-hero-blob" aria-hidden="true" />
            )}

            {/* Product preview card */}
            <div
              ref={previewRef}
              className="ld-w-preview-shell"
              style={{ transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}
              aria-label="ContentForge product preview"
            >
              {/* Platform badges */}
              <div className="ld-w-preview-platforms" role="list" aria-label="Supported platforms">
                <span className="ld-w-platform-chip linkedin" role="listitem">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
                  LinkedIn
                </span>
                <span className="ld-w-platform-chip x" role="listitem">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  X (Twitter)
                </span>
                <span className="ld-w-platform-chip instagram" role="listitem">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path fill="#fff" d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="#fff" strokeWidth="2"/></svg>
                  Instagram
                </span>
              </div>

              {/* Post day rows */}
              <div className="ld-w-day-list" role="list" aria-label="Generated post schedule">
                {PREVIEW_POSTS.map((post) => (
                  <div key={post.day} className="ld-w-day-row" role="listitem">
                    <div className="ld-w-day-num" aria-hidden="true">{post.day}</div>
                    <div>
                      <div className="ld-w-day-title">{post.title}</div>
                      <div className="ld-w-day-desc">{post.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats row */}
              <div className="ld-w-preview-stats" role="list" aria-label="Summary statistics">
                {STATS.map((s) => (
                  <div key={s.label} className="ld-w-preview-stat" role="listitem">
                    <div className="ld-w-preview-stat-value">{s.value}</div>
                    <div className="ld-w-preview-stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
