import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const QUOTES = [
  {
    text: "ContentForge turned our painfully slow content process into something I actually enjoy. A week of posts in the time it used to take me to write one.",
    name: "Sarah K.",
    role: "Content Lead at Northwind",
    initials: "SK",
  },
  {
    text: "The brand voice accuracy is uncanny. It sounds like us — not like a generic AI. Our engagement rate is up 40% since we switched.",
    name: "Marcus T.",
    role: "Head of Marketing, Fabrikam",
    initials: "MT",
  },
  {
    text: "We manage 12 client accounts. ContentForge halved the time we spend on first drafts. The calendar export alone is worth every penny.",
    name: "Priya R.",
    role: "Founder, Tailspin Agency",
    initials: "PR",
  },
];

const ALL_QUOTES = [...QUOTES, ...QUOTES];

function QuoteCard({ q }: { q: (typeof QUOTES)[number] }) {
  return (
    <article className="ld-w-quote-card">
      <div className="ld-w-stars" role="img" aria-label="5 out of 5 stars">
        {["★", "★", "★", "★", "★"].map((star, i) => (
          <span key={i} aria-hidden="true">
            {star}
          </span>
        ))}
      </div>

      <blockquote className="ld-w-quote-text">{q.text}</blockquote>

      <footer className="ld-w-quote-footer">
        <div className="ld-w-avatar" aria-hidden="true">
          {q.initials}
        </div>
        <div>
          <cite className="ld-w-quote-name" style={{ fontStyle: "normal" }}>
            {q.name}
          </cite>
          <div className="ld-w-quote-role">{q.role}</div>
        </div>
      </footer>
    </article>
  );
}

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;

  useEffect(() => {
    if (!sectionRef.current) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    gsap.fromTo(
      sectionRef.current.querySelector(".ld-w-quotes-head"),
      { y: 24, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 82%",
          toggleActions: "play none none none",
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  useEffect(() => {
    if (!innerRef.current || !isDesktop) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    tweenRef.current = gsap.to(innerRef.current, {
      x: "-50%",
      duration: 42,
      ease: "none",
      repeat: -1,
    });

    return () => {
      tweenRef.current?.kill();
    };
  }, [isDesktop]);

  const pauseTicker = () => tweenRef.current?.pause();
  const resumeTicker = () => tweenRef.current?.resume();

  return (
    <section
      ref={sectionRef}
      className="ld-w-quotes-section ld-w-section"
      aria-labelledby="quotes-heading"
    >
      <div className="ld-w-wrap">
        <div className="ld-w-quotes-head">
          <span className="ld-w-eyebrow">Customer Stories</span>
          <h2 id="quotes-heading" className="ld-w-h2">
            Loved by <em>content creators</em>
          </h2>
        </div>
      </div>

      {/* Screen-reader accessible list; visual track below is a decorative duplicate */}
      <ul className="sr-only" aria-label="Customer testimonials">
        {QUOTES.map((q) => (
          <li key={q.name}>
            {q.text} — {q.name}, {q.role}
          </li>
        ))}
      </ul>

      <div
        className="ld-w-quotes-track"
        onMouseEnter={pauseTicker}
        onMouseLeave={resumeTicker}
        aria-hidden="true"
      >
        <div ref={innerRef} className="ld-w-quotes-inner">
          {ALL_QUOTES.map((q, i) => (
            <div key={`${q.name}-${i}`} className="ld-w-quote-slide">
              <QuoteCard q={q} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
