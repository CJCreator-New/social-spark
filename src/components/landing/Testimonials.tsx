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

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    const cards = sectionRef.current.querySelectorAll(".ld-w-quote-card");
    gsap.fromTo(
      cards,
      { y: 32, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.1,
        duration: 0.75,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 82%",
          toggleActions: "play none none none",
        },
      }
    );

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

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

        <div className="ld-w-quotes-grid" role="list">
          {QUOTES.map((q) => (
            <article key={q.name} className="ld-w-quote-card" role="listitem">
              <div className="ld-w-stars" role="img" aria-label="5 out of 5 stars">
                {["★", "★", "★", "★", "★"].map((star, i) => (
                  <span key={i} aria-hidden="true">{star}</span>
                ))}
              </div>

              <blockquote className="ld-w-quote-text" cite={`#${q.name.replace(/\s/g, "").toLowerCase()}`}>
                {q.text}
              </blockquote>

              <footer className="ld-w-quote-footer">
                <div className="ld-w-avatar" aria-hidden="true">{q.initials}</div>
                <div>
                  <cite className="ld-w-quote-name" style={{ fontStyle: "normal" }}>{q.name}</cite>
                  <div className="ld-w-quote-role">{q.role}</div>
                </div>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
