import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Sparkles, Calendar, BarChart2, Users,
  Zap, Target,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const TONE_PILLS = ["Professional", "Conversational", "Bold"];

const CARDS = [
  {
    id: "ai",
    span: "ld-w-bento-col-8",
    tall: true,
    icon: Sparkles,
    title: "Brand-aware AI writing",
    desc: "ContentForge learns your tone, your vocabulary, and your audience — then writes in your voice, not a generic one.",
    extra: "tone",
  },
  {
    id: "limits",
    span: "ld-w-bento-col-4",
    tall: true,
    icon: Target,
    title: "Platform character limits",
    desc: "Every post automatically respects LinkedIn, X, Instagram, and Threads' exact constraints. No manual trimming.",
    extra: null,
  },
  {
    id: "schedule",
    span: "ld-w-bento-col-4",
    tall: false,
    icon: Calendar,
    title: "Schedule & export",
    desc: "Export your full week as a CSV or push directly to your scheduling tool.",
    extra: null,
  },
  {
    id: "templates",
    span: "ld-w-bento-col-8",
    tall: false,
    icon: Zap,
    title: "Brief templates",
    desc: "Start from curated templates for product launches, thought leadership, promotions, and more — then customize.",
    extra: null,
  },
  {
    id: "collab",
    span: "ld-w-bento-col-6",
    tall: false,
    icon: Users,
    title: "Team collaboration",
    desc: "Multiple brand voices, shared calendars, and role-based access for agencies and marketing teams.",
    extra: null,
  },
  {
    id: "analytics",
    span: "ld-w-bento-col-6",
    tall: false,
    icon: BarChart2,
    title: "Performance analytics",
    desc: "See which hooks get engagement, which CTAs convert, and which platforms drive the best results for your brand.",
    extra: null,
  },
];

function ToneDemo() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive(i => (i + 1) % TONE_PILLS.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="ld-w-tone-pills" role="list" aria-label="Available tone options">
      {TONE_PILLS.map((pill, i) => (
        <span
          key={pill}
          className={`ld-w-tone-pill${i === active ? " active" : ""}`}
          role="listitem"
        >
          {pill}
        </span>
      ))}
    </div>
  );
}

export default function BentoGrid() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;
    const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noMotion) return;

    const cards = sectionRef.current.querySelectorAll(".ld-w-bento-card");
    gsap.utils.toArray<Element>(cards).forEach((card, i) => {
      gsap.fromTo(
        card,
        { y: 48, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          delay: i * 0.07,
          ease: "power3.out",
          scrollTrigger: {
            trigger: card,
            start: "top 88%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="ld-w-bento-section ld-w-section"
      aria-labelledby="bento-heading"
      id="features"
    >
      <div className="ld-w-wrap">
        <div className="ld-w-bento-head">
          <span className="ld-w-eyebrow">Everything You Need</span>
          <h2 id="bento-heading" className="ld-w-h2">
            Built for <em>serious</em> content teams
          </h2>
        </div>

        <div className="ld-w-bento-grid" role="list">
          {CARDS.map(card => {
            const Icon = card.icon;
            return (
              <article
                key={card.id}
                className={`ld-w-bento-card ${card.span}${card.tall ? " tall" : ""}`}
                role="listitem"
                aria-label={card.title}
              >
                <div className="ld-w-bento-icon" aria-hidden="true">
                  <Icon size={18} />
                </div>
                <h3 className="ld-w-bento-h">{card.title}</h3>
                <p className="ld-w-bento-p">{card.desc}</p>
                {card.extra === "tone" && <ToneDemo />}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
