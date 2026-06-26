import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const DAYS    = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLATFORMS = ["LinkedIn", "X", "Instagram", "Threads"];
// posted cells = [platformIndex][dayIndex]
const POSTED: Set<string> = new Set(["0-0","0-2","0-4","1-1","1-3","2-0","2-5","3-2","3-4"]);

const COUNTER_STATS = [
  { label: "Avg. Reach",       value: 12400,  suffix: "" },
  { label: "Posts Published",  value: 284,    suffix: "" },
  { label: "Engagement Rate",  value: 7.3,    suffix: "%" },
  { label: "Hours Saved / wk", value: 9,      suffix: "h" },
];

function FeatureA() {
  const ref = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    const promptText = `Brand: Northwind Coffee\nAudience: B2B buyers\nTone: Professional\nTopic: New single-origin Ethiopian blend`;
    const el = ref.current.querySelector(".ld-w-typed-text");
    if (!el) return;

    let charIndex = 0;
    let timeout: ReturnType<typeof setTimeout>;
    let st: ScrollTrigger;

    const typeChar = () => {
      if (charIndex <= promptText.length) {
        el.textContent = promptText.slice(0, charIndex);
        charIndex++;
        timeout = setTimeout(typeChar, 28);
      } else {
        setTimeout(() => {
          if (outputRef.current) {
            gsap.fromTo(outputRef.current, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" });
          }
        }, 200);
      }
    };

    st = ScrollTrigger.create({
      trigger: ref.current,
      start: "top 72%",
      once: true,
      onEnter: () => { charIndex = 0; typeChar(); },
    });

    return () => { clearTimeout(timeout); st?.kill(); };
  }, []);

  return (
    <div ref={ref} className="ld-w-feature-visual" aria-label="AI writing engine demo">
      <div className="ld-w-code-label">Your brief</div>
      <div className="ld-w-code-block" aria-live="polite">
        <span className="ld-w-typed-text" />
        <span className="cursor" aria-hidden="true" />
      </div>
      <div className="ld-w-code-arrow" aria-hidden="true">↓ ContentForge generates</div>
      <div ref={outputRef} className="ld-w-post-output" style={{ opacity: 0 }}>
        <strong>Hook:</strong> Ethiopian single-origin. 72-hour fermentation. The cup that changed how we source.<br /><br />
        <strong>Body:</strong> We've partnered directly with Haile Selassie Farm in Yirgacheffe to bring you a naturally processed bean that carries notes of blueberry, jasmine, and dark chocolate.<br /><br />
        <strong>CTA:</strong> Pre-order limited batch → link in bio
      </div>
    </div>
  );
}

function FeatureB() {
  return (
    <div className="ld-w-feature-visual" aria-label="Multi-platform scheduling calendar">
      <div className="ld-w-cal-grid" role="table" aria-label="Weekly content calendar">
        <div className="ld-w-cal-head" role="columnheader" />
        {DAYS.map(d => <div key={d} className="ld-w-cal-head" role="columnheader">{d}</div>)}

        {PLATFORMS.map((plat, pi) => (
          <div key={plat} style={{ display: "contents" }}>
            <div className="ld-w-cal-label" role="rowheader">{plat}</div>
            {DAYS.map((_, di) => (
              <div
                key={di}
                className={`ld-w-cal-cell${POSTED.has(`${pi}-${di}`) ? " posted" : ""}`}
                role="cell"
                aria-label={POSTED.has(`${pi}-${di}`) ? `${plat} post on ${DAYS[di]}` : ""}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureC() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    const counterEls = gridRef.current.querySelectorAll(".ld-w-stat-value");

    ScrollTrigger.create({
      trigger: gridRef.current,
      start: "top 78%",
      once: true,
      onEnter: () => {
        counterEls.forEach((el, i) => {
          const stat = COUNTER_STATS[i];
          const obj = { val: 0 };
          gsap.to(obj, {
            val: stat.value,
            duration: 2,
            ease: "power2.out",
            onUpdate: () => {
              const rounded = Number.isInteger(stat.value) ? Math.round(obj.val) : obj.val.toFixed(1);
              el.textContent = rounded + stat.suffix;
            },
          });
        });
      },
    });

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

  return (
    <div ref={gridRef} className="ld-w-stat-grid" role="list" aria-label="Platform analytics">
      {COUNTER_STATS.map(s => (
        <div key={s.label} className="ld-w-stat-card" role="listitem">
          <div className="ld-w-stat-value" aria-live="polite">0{s.suffix}</div>
          <div className="ld-w-stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

const FEATURES = [
  {
    id: "ai",
    eyebrow: "AI Writing Engine",
    title: "Your brand voice, at scale",
    titleEm: "at scale",
    desc: "Stop rewriting AI output that sounds generic. ContentForge learns your vocabulary, your rhythm, and your audience — then produces posts that actually sound like you.",
    bullets: [
      { strong: "Voice calibration",  text: " — upload past content or describe your style." },
      { strong: "Platform adaptation",text: " — tone adjusts for LinkedIn vs Instagram automatically." },
      { strong: "No markdown in copy",text: " — clean output, every time. No **bold** artifacts." },
    ],
    visual: <FeatureA />,
    reverse: false,
  },
  {
    id: "schedule",
    eyebrow: "Multi-Platform Scheduling",
    title: "A full week, every platform",
    titleEm: "every platform",
    desc: "One brief. Seven days. Six platforms. ContentForge fills your content calendar so you can spend your time on strategy, not copy.",
    bullets: [
      { strong: "Character-limit aware",  text: " — posts never exceed platform constraints." },
      { strong: "Optimal timing hints",   text: " — AI suggests the best days and times per platform." },
      { strong: "CSV & scheduler export", text: " — works with Buffer, Hootsuite, and Notion." },
    ],
    visual: <FeatureB />,
    reverse: true,
  },
  {
    id: "analytics",
    eyebrow: "Content Analytics",
    title: "Improve with every post",
    titleEm: "every post",
    desc: "ContentForge tracks what resonates — which hooks get clicked, which CTAs convert, which platforms grow your audience — and feeds insights back into your next brief.",
    bullets: [
      { strong: "Engagement scoring",   text: " — each post gets a hook, CTA, and readability score." },
      { strong: "Trend awareness",      text: " — surface trending topics relevant to your niche." },
      { strong: "Historical benchmarks",text: " — compare this week's output against your personal best." },
    ],
    visual: <FeatureC />,
    reverse: false,
  },
];

export default function FeatureShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    const features = sectionRef.current.querySelectorAll(".ld-w-feature-section");
    features.forEach((feature) => {
      const copy   = feature.querySelector(".ld-w-feature-copy");
      const visual = feature.querySelector(".ld-w-feature-visual");

      if (copy) {
        gsap.fromTo(copy, { x: -40, opacity: 0 }, {
          x: 0, opacity: 1, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: feature, start: "top 75%", toggleActions: "play none none none" },
        });
      }
      if (visual) {
        gsap.fromTo(visual, { x: 40, opacity: 0 }, {
          x: 0, opacity: 1, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: feature, start: "top 75%", toggleActions: "play none none none" },
        });
      }
    });

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

  return (
    <div ref={sectionRef}>
      {FEATURES.map((feat) => (
        <section
          key={feat.id}
          className="ld-w-feature-section ld-w-section"
          aria-labelledby={`feat-${feat.id}-heading`}
        >
          <div className="ld-w-wrap">
            <div className={`ld-w-feature-grid${feat.reverse ? " reverse" : ""}`}>
              <div className="ld-w-feature-copy">
                <span className="ld-w-eyebrow">{feat.eyebrow}</span>
                <h2 id={`feat-${feat.id}-heading`} className="ld-w-feature-h2">
                  {feat.title.replace(feat.titleEm, "").trim()}{" "}
                  <em>{feat.titleEm}</em>
                </h2>
                <p className="ld-w-feature-p">{feat.desc}</p>
                <ul className="ld-w-feature-list" role="list">
                  {feat.bullets.map((b, i) => (
                    <li key={i} role="listitem">
                      <strong>{b.strong}</strong>{b.text}
                    </li>
                  ))}
                </ul>
              </div>
              {feat.visual}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
