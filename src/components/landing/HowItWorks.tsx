import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, AnimatePresence, useScroll, useReducedMotion } from "framer-motion";

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

function BriefIllustration() {
  return (
    <div className="ld-w-hiw-illus-card">
      <div className="ld-w-code-label">Your brief</div>
      <div className="ld-w-code-block">
        Brand: Northwind Coffee{"\n"}
        Audience: B2B buyers{"\n"}
        Tone: Professional{"\n"}
        Topic: New Ethiopian blend
      </div>
    </div>
  );
}

function GenerateIllustration() {
  const posts = [
    { day: "Mon", title: "The hook that stops the scroll" },
    { day: "Wed", title: "Behind the scenes reveal" },
    { day: "Fri", title: "Data insight your audience needs" },
  ];
  return (
    <div className="ld-w-hiw-illus-card">
      <div className="ld-w-code-label">Generating your week</div>
      <div className="ld-w-day-list">
        {posts.map((p) => (
          <div key={p.day} className="ld-w-day-row">
            <div className="ld-w-day-num" aria-hidden="true">
              {p.day}
            </div>
            <div className="ld-w-day-title">{p.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PublishIllustration() {
  const items = ["Hook scored 9.2/10", "CTA verified", "Exported to scheduler"];
  return (
    <div className="ld-w-hiw-illus-card">
      <div className="ld-w-code-label">Ready to publish</div>
      <ul className="ld-w-price-features">
        {items.map((it) => (
          <li key={it}>
            <span className="check" aria-hidden="true">
              ✓
            </span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

const ILLUSTRATIONS = [
  <BriefIllustration key="0" />,
  <GenerateIllustration key="1" />,
  <PublishIllustration key="2" />,
];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 900px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const handler = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isDesktop;
}

function StickyHowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      const idx = Math.min(STEPS.length - 1, Math.floor(v * STEPS.length));
      setActive(idx);
    });
  }, [scrollYProgress]);

  return (
    <section id="how-it-works" aria-labelledby="hiw-heading-sticky" className="ld-w-hiw-section">
      <div ref={containerRef} className="ld-w-hiw-scroller">
        <div className="ld-w-hiw-pin">
          <div className="ld-w-wrap">
            <div className="ld-w-hiw-head">
              <span className="ld-w-eyebrow">How It Works</span>
              <h2 id="hiw-heading-sticky" className="ld-w-h2">
                From brief to published <em>in minutes</em>
              </h2>
            </div>

            <div className="ld-w-hiw-sticky-grid">
              <div className="ld-w-hiw-steps-list" role="list">
                {STEPS.map((step, i) => (
                  <div
                    key={step.num}
                    className={`ld-w-hiw-step-item${i === active ? " active" : ""}`}
                    role="listitem"
                  >
                    <div className="ld-w-step-badge">Step {step.num}</div>
                    <h3 className="ld-w-step-h">{step.title}</h3>
                    <p className="ld-w-step-p">{step.desc}</p>
                  </div>
                ))}
              </div>

              <div className="ld-w-hiw-illus-panel" aria-hidden="true">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  >
                    {ILLUSTRATIONS[active]}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StackedHowItWorks() {
  const gridRef = useRef<HTMLDivElement>(null);
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

    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: "top 78%",
      onEnter: () => gridRef.current?.classList.add("animated"),
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <section
      id="how-it-works"
      aria-labelledby="hiw-heading-stacked"
      ref={sectionRef}
      className="ld-w-hiw-section ld-w-section"
    >
      <div className="ld-w-wrap">
        <div className="ld-w-hiw-head">
          <span className="ld-w-eyebrow">How It Works</span>
          <h2 id="hiw-heading-stacked" className="ld-w-h2">
            From brief to published <em>in minutes</em>
          </h2>
        </div>

        <div ref={gridRef} className="ld-w-hiw-grid" role="list">
          {STEPS.map((step) => (
            <div key={step.num} className="ld-w-step-card" role="listitem">
              <span className="ld-w-step-num-ghost" aria-hidden="true">
                {step.num}
              </span>
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

export default function HowItWorks() {
  const isDesktop = useIsDesktop();
  const reduceMotion = useReducedMotion();
  const useSticky = isDesktop && !reduceMotion;

  return useSticky ? <StickyHowItWorks /> : <StackedHowItWorks />;
}
