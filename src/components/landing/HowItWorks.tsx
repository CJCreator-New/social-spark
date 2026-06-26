import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    num: "01",
    title: "Share your brief",
    desc: "Describe your brand voice, industry, target audience, and what you want to say this week. Takes 90 seconds.",
  },
  {
    num: "02",
    title: "ContentForge generates",
    desc: "Our AI reads your brief, respects platform character limits, and drafts 7 posts — one for every day of the week.",
  },
  {
    num: "03",
    title: "Review, tweak & publish",
    desc: "Edit any post inline, regenerate individual pieces, or export your full calendar directly to your scheduler.",
  },
];

export default function HowItWorks() {
  const gridRef    = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!gridRef.current || !sectionRef.current) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    const cards = gridRef.current.querySelectorAll(".ld-w-step-card");

    gsap.fromTo(
      cards,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.12,
        duration: 0.75,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 78%",
          toggleActions: "play none none none",
        },
      }
    );

    // Animate connector line
    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top 78%",
      onEnter: () => gridRef.current?.classList.add("animated"),
    });

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="ld-w-hiw-section ld-w-section"
      aria-labelledby="hiw-heading"
      id="how-it-works"
    >
      <div className="ld-w-wrap">
        <div className="ld-w-hiw-head">
          <span className="ld-w-eyebrow">How It Works</span>
          <h2 id="hiw-heading" className="ld-w-h2">
            From brief to published <em>in minutes</em>
          </h2>
        </div>

        <div ref={gridRef} className="ld-w-hiw-grid" role="list">
          {STEPS.map((step) => (
            <div key={step.num} className="ld-w-step-card" role="listitem">
              <span className="ld-w-step-num-ghost" aria-hidden="true">{step.num}</span>
              <div className="ld-w-step-badge">Step {step.num}</div>
              <h3 className="ld-w-step-h">{step.title}</h3>
              <p className="ld-w-step-p">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
