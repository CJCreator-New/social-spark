import { useEffect, useRef, lazy, Suspense } from "react";
import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const SmoothScroll = lazy(() => import("@/components/landing/SmoothScroll"));
const HeroCanvas = lazy(() => import("@/components/landing/HeroCanvas"));
const MorphCanvas = lazy(() => import("@/components/landing/MorphCanvas"));
const FooterCanvas = lazy(() => import("@/components/landing/FooterCanvas"));

gsap.registerPlugin(ScrollTrigger);

export default function Landing() {
  const { user, loading } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);

  const pageTitle = "ContentForge — AI-powered weekly content calendars";
  const pageDesc = "Turn one brief into a week of on-brand posts for LinkedIn, X, Instagram, Facebook, newsletters, and blogs. Schedule, refine, and publish — all in one place.";
  const canonical = "https://contentforged.lovable.app/";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "ContentForge",
    description: "AI-powered content calendar generator for social platforms.",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  useEffect(() => {
    if (loading || user || !heroRef.current) return;

    // 1. Page Load Entrance Sequence
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

      tl.fromTo(
        ".nav-pill",
        { y: -30, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2 }
      )
        .fromTo(
          ".hero-eyebrow",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8 },
          "-=0.8"
        )
        .fromTo(
          ".hero-title",
          { y: 35, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.1 },
          "-=0.7"
        )
        .fromTo(
          ".hero-lede",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9 },
          "-=0.8"
        )
        .fromTo(
          ".hero-ctas",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.9 },
          "-=0.7"
        )
        .fromTo(
          ".hero-trust",
          { y: 15, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 },
          "-=0.6"
        )
        .fromTo(
          ".hero-canvas-container",
          { scale: 0.92, opacity: 0 },
          { scale: 1, opacity: 1, duration: 1.4 },
          "-=1.1"
        )
        .fromTo(
          ".hero-preview-card",
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.2 },
          "-=1.0"
        );

      // 2. Scroll Entrance Reveal for Bento Grid Cards
      gsap.utils.toArray(".bento-card").forEach((card: any) => {
        gsap.fromTo(
          card,
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            scrollTrigger: {
              trigger: card,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    }, heroRef);

    return () => ctx.revert();
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" aria-hidden="true" />
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  if (user) return <Navigate to="/app" replace />;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* Smooth scroll driver */}
      <Suspense fallback={null}>
        <SmoothScroll />
      </Suspense>

      <main 
        ref={heroRef} 
        className="min-h-screen text-slate-100 relative bg-[#07080d] overflow-x-hidden font-sans"
        style={{
          backgroundImage: "radial-gradient(circle at 50% -20%, rgba(99, 102, 241, 0.12) 0%, transparent 60%)"
        }}
      >
        {/* Cinematic ambient grain overlay */}
        <div 
          className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
          }}
        />

        {/* Floating Navigation Pill */}
        <nav className="nav-pill fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-5xl z-50 rounded-full border border-white/10 bg-[#07080d]/60 backdrop-blur-xl px-6 py-3 flex justify-between items-center shadow-lg shadow-black/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-500 to-cyan-400 text-black font-extrabold flex items-center justify-center text-sm tracking-tight shadow-md">
              CF
            </div>
            <span className="font-semibold text-sm tracking-tight hidden sm:inline-block">
              Content<em className="text-violet-400 not-italic">Forge</em>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/auth" className="text-xs font-semibold text-slate-400 hover:text-white transition-colors">
              Sign in
            </Link>
            <Link 
              to="/auth" 
              className="group text-xs font-bold bg-gradient-to-r from-violet-400 to-cyan-400 text-slate-950 px-4 py-2 rounded-full shadow-md hover:shadow-violet-400/20 active:scale-95 transition-all duration-300 flex items-center gap-2"
            >
              Get started
              <span className="w-5 h-5 rounded-full bg-slate-950/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        </nav>

        {/* Hero Area */}
        <div className="max-w-5xl mx-auto px-6 pt-32 pb-24 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Hero Left Content */}
            <div className="lg:col-span-7 flex flex-col items-start text-left">
              <span className="hero-eyebrow rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-medium border border-violet-500/20 bg-violet-500/5 text-violet-400 inline-block mb-6">
                Editorial-grade content workflows
              </span>
              <h1 className="hero-title text-5xl md:text-7xl font-display leading-[0.9] tracking-tighter mb-6 text-white text-balance">
                One brief.<br />
                A week of <em className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 not-italic font-serif">finished</em> posts.
              </h1>
              <p className="hero-lede text-slate-400 text-base md:text-lg max-w-xl leading-relaxed mb-8 text-pretty">
                ContentForge turns a single idea into a polished, platform-native content calendar for LinkedIn, X, Instagram, Facebook, newsletters, and blogs. Generate, refine, schedule, and export without losing the thread of your brand voice.
              </p>
              <div className="hero-ctas flex flex-wrap gap-4 mb-10">
                <Link 
                  to="/auth" 
                  className="group bg-gradient-to-r from-violet-400 to-cyan-400 text-slate-950 px-6 py-3.5 rounded-full font-extrabold text-sm shadow-lg hover:shadow-violet-500/25 active:scale-98 transition-all duration-300 flex items-center gap-2"
                >
                  Start free
                  <span className="w-6 h-6 rounded-full bg-slate-950/10 flex items-center justify-center transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
                <a 
                  href="#how-it-works" 
                  className="px-6 py-3.5 rounded-full border border-white/10 hover:border-violet-400/30 hover:bg-violet-400/5 text-slate-200 text-sm font-semibold transition-all duration-300"
                >
                  See the workflow
                </a>
              </div>
              <div className="hero-trust flex flex-wrap gap-3">
                <span className="text-xs px-3.5 py-2 rounded-full border border-white/5 bg-white/[0.02] text-slate-500">
                  <strong className="text-slate-300">No credit card</strong> required
                </span>
                <span className="text-xs px-3.5 py-2 rounded-full border border-white/5 bg-white/[0.02] text-slate-500">
                  <strong className="text-slate-300">7 posts</strong> generated in under 1m
                </span>
              </div>
            </div>

            {/* Hero Right Canvas / Mockup */}
            <div className="lg:col-span-5 relative w-full flex items-center justify-center">
              {/* Floating WebGL sphere behind the preview card */}
              <div className="hero-canvas-container absolute inset-0 w-full h-full -z-10 opacity-70">
                <Suspense fallback={<div className="h-full w-full bg-transparent" />}>
                  <HeroCanvas />
                </Suspense>
              </div>

              {/* Double-Bezel Preview Card */}
              <div className="hero-preview-card w-full p-2 bg-white/5 border border-white/10 rounded-[2.5rem] relative overflow-hidden backdrop-blur-sm shadow-2xl shadow-black/60">
                <div className="bg-slate-950/80 rounded-[calc(2.5rem-0.5rem)] p-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Campaign Preview</span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-400 font-bold">Launch Week</span>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex gap-4 items-center">
                      <div className="font-display text-2xl text-violet-400">01</div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Positioning Hook</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Founders-led post framing the status quo problem.</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex gap-4 items-center">
                      <div className="font-display text-2xl text-cyan-400">02</div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Insight Narrative</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Focuses on customer pain points and cost of inaction.</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex gap-4 items-center">
                      <div className="font-display text-2xl text-rose-400">03</div>
                      <div>
                        <h4 className="text-xs font-bold text-white">Conversion Vector</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Tactical framework overview with a solid product CTA.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-6 text-center">
                    <div className="p-3 rounded-xl border border-white/5 bg-white/[0.01]">
                      <div className="text-sm font-display text-white">7</div>
                      <div className="text-[8px] uppercase tracking-wider text-slate-500 mt-0.5">Drafts</div>
                    </div>
                    <div className="p-3 rounded-xl border border-white/5 bg-white/[0.01]">
                      <div className="text-sm font-display text-white">4</div>
                      <div className="text-[8px] uppercase tracking-wider text-slate-500 mt-0.5">Channels</div>
                    </div>
                    <div className="p-3 rounded-xl border border-white/5 bg-white/[0.01]">
                      <div className="text-sm font-display text-white">24h</div>
                      <div className="text-[8px] uppercase tracking-wider text-slate-500 mt-0.5">Recovery</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Scroll Morph Section (Scene 2) */}
        <section className="py-32 border-y border-white/5 relative bg-slate-950/20">
          <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            
            <div>
              <span className="rounded-full px-3 py-1 text-[9px] uppercase tracking-[0.2em] font-medium border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 inline-block mb-4">
                Kinetic Geometry
              </span>
              <h2 className="text-4xl md:text-5xl font-display text-white leading-tight mb-6">
                Warp concepts into structured systems.
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-8 text-pretty">
                Observe ideas transition dynamically as you scroll. Visualized as geometry, the flow evolves from your initial brand context (Sphere) to platform social drafts (Cube), looping into continuous scheduling (Torus).
              </p>
              
              <div className="space-y-6">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xs font-bold text-violet-400 flex-shrink-0">
                    01
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Sphere: Content Context</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Unified knowledge models capturing your tone, audience, and parameters.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xs font-bold text-rose-400 flex-shrink-0">
                    02
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Cube: Social Calendars</h4>
                    <p className="text-xs text-slate-500 mt-0.5">High-fidelity social posts structured symmetrically for specific feeds.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-xs font-bold text-amber-400 flex-shrink-0">
                    03
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">Torus: Automated Queue</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Recurring publishing loops keeping your presence active automatically.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center relative">
              <div className="absolute inset-0 bg-radial-gradient from-violet-500/5 to-transparent blur-3xl pointer-events-none" />
              <Suspense fallback={<div className="h-64 w-64 bg-transparent" />}>
                <MorphCanvas />
              </Suspense>
            </div>

          </div>
        </section>

        {/* Bento Grid Features Section */}
        <section className="py-36 max-w-5xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="rounded-full px-3 py-1 text-[9px] uppercase tracking-[0.2em] font-medium border border-violet-500/20 bg-violet-500/5 text-violet-400 inline-block mb-4">
              Engineered Excellence
            </span>
            <h2 className="text-4xl md:text-5xl font-display text-white mb-4">
              Built for teams that scale content.
            </h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed text-pretty">
              Every workflow feature is designed around speed, brand consistency, and the reality of weekly production cycles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Card 1: Col-8 (Brand-aware) */}
            <div className="bento-card md:col-span-8 p-1.5 bg-white/5 border border-white/10 rounded-[2.2rem] hover:border-violet-500/30 transition-all duration-500 group">
              <div className="bg-slate-950/80 rounded-[calc(2.2rem-0.375rem)] p-8 h-full flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] min-h-[240px]">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 text-lg mb-6">
                  ◬
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg mb-2 group-hover:text-violet-400 transition-colors">
                    Brand-aware generation
                  </h3>
                  <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                    Voice parameters, target audience segments, and vocabulary restrictions persist across calendars so the output stays uniquely yours.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Col-4 (Platform-native) */}
            <div className="bento-card md:col-span-4 p-1.5 bg-white/5 border border-white/10 rounded-[2.2rem] hover:border-cyan-500/30 transition-all duration-500 group">
              <div className="bg-slate-950/80 rounded-[calc(2.2rem-0.375rem)] p-8 h-full flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] min-h-[240px]">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-lg mb-6">
                  ◭
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg mb-2 group-hover:text-cyan-400 transition-colors">
                    Platform-native writing
                  </h3>
                  <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                    Length constraints, hook formulations, and call-to-action stylings adapt natively to individual channel algorithms.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Col-4 (Schedule & Export) */}
            <div className="bento-card md:col-span-4 p-1.5 bg-white/5 border border-white/10 rounded-[2.2rem] hover:border-rose-500/30 transition-all duration-500 group">
              <div className="bg-slate-950/80 rounded-[calc(2.2rem-0.375rem)] p-8 h-full flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] min-h-[240px]">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 text-lg mb-6">
                  ◫
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg mb-2 group-hover:text-rose-400 transition-colors">
                    Schedule & export
                  </h3>
                  <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                    Timezone-aware scheduling, CSV/Markdown export formats, and draft state parameters for publishing pipelines.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 4: Col-8 (Templates) */}
            <div className="bento-card md:col-span-8 p-1.5 bg-white/5 border border-white/10 rounded-[2.2rem] hover:border-amber-500/30 transition-all duration-500 group">
              <div className="bg-slate-950/80 rounded-[calc(2.2rem-0.375rem)] p-8 h-full flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] min-h-[240px]">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg mb-6">
                  ◯
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg mb-2 group-hover:text-amber-400 transition-colors">
                    Reusable brief templates
                  </h3>
                  <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                    Store successful prompting templates so recurring operations launch from established contextual models instead of blank inputs.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Workflow Section */}
        <section id="how-it-works" className="py-24 border-t border-white/5 bg-slate-950/10">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-16">
              <span className="rounded-full px-3 py-1 text-[9px] uppercase tracking-[0.2em] font-medium border border-violet-500/20 bg-violet-500/5 text-violet-400 inline-block mb-4">
                Operational Pipeline
              </span>
              <h2 className="text-4xl md:text-5xl font-display text-white mb-4">
                Three steps to structured scheduling.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 rounded-3xl border border-white/5 bg-[#0a0c14]/40 relative overflow-hidden">
                <div className="text-6xl font-display text-violet-500/20 absolute -top-2 -right-2 font-black select-none">
                  01
                </div>
                <h3 className="text-white font-bold text-base mb-3 relative z-10">Configure Context</h3>
                <p className="text-slate-400 text-xs leading-relaxed relative z-10">
                  Select your platforms, write your core direction, and load preset tone settings to anchor the drafts.
                </p>
              </div>

              <div className="p-6 rounded-3xl border border-white/5 bg-[#0a0c14]/40 relative overflow-hidden">
                <div className="text-6xl font-display text-rose-500/20 absolute -top-2 -right-2 font-black select-none">
                  02
                </div>
                <h3 className="text-white font-bold text-base mb-3 relative z-10">Review & Edit</h3>
                <p className="text-slate-400 text-xs leading-relaxed relative z-10">
                  Examine generated calendar calendars instantly, rewrite specific pieces, and check platform compliance.
                </p>
              </div>

              <div className="p-6 rounded-3xl border border-white/5 bg-[#0a0c14]/40 relative overflow-hidden">
                <div className="text-6xl font-display text-amber-500/20 absolute -top-2 -right-2 font-black select-none">
                  03
                </div>
                <h3 className="text-white font-bold text-base mb-3 relative z-10">Sync & Publish</h3>
                <p className="text-slate-400 text-xs leading-relaxed relative z-10">
                  Commit calendars to your queue, track publishing states, and output clean files for external schedulers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA / Footer Interactive Form */}
        <section className="py-24 max-w-5xl mx-auto px-6 mb-24">
          <div className="relative p-1.5 bg-white/5 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl shadow-black/80">
            <div className="bg-slate-950/90 rounded-[calc(3rem-0.375rem)] p-12 md:p-16 grid grid-cols-1 md:grid-cols-12 gap-8 items-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)] relative">
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1/2 bg-gradient-to-b from-violet-500/10 to-transparent blur-3xl pointer-events-none" 
              />
              
              <div className="md:col-span-7 relative z-10">
                <h2 className="text-3xl md:text-5xl font-display text-white leading-tight mb-4 text-balance">
                  Stop staring at<br />the <em className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 not-italic font-serif">blank page</em>.
                </h2>
                <p className="text-slate-400 text-xs md:text-sm leading-relaxed mb-8 max-w-md text-pretty">
                  Generate your first week of content in under a minute. The interface is built to feel calm, deliberate, and worthy of the work inside it.
                </p>
                <Link 
                  to="/auth" 
                  className="group inline-flex bg-gradient-to-r from-violet-400 to-cyan-400 text-slate-950 px-6 py-3.5 rounded-full font-extrabold text-sm shadow-lg hover:shadow-violet-500/25 active:scale-98 transition-all duration-300 items-center gap-2"
                >
                  Create your first calendar
                  <span className="w-6 h-6 rounded-full bg-slate-950/10 flex items-center justify-center transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </div>

              {/* Reactive floating torus knot */}
              <div className="md:col-span-5 flex justify-center items-center h-64 md:h-80 relative">
                <div className="absolute inset-0 bg-radial-gradient from-violet-500/5 to-transparent blur-xl pointer-events-none" />
                <Suspense fallback={<div className="h-full w-full bg-transparent" />}>
                  <FooterCanvas />
                </Suspense>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-12 text-center text-xs text-slate-600 relative z-10">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p>© {new Date().getFullYear()} ContentForge · Built for serious content teams</p>
            <div className="flex gap-6">
              <a href="/privacy" className="hover:text-slate-400 transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-slate-400 transition-colors">Terms</a>
              <a href="/docs" className="hover:text-slate-400 transition-colors">Docs</a>
            </div>
          </div>
        </footer>

      </main>
    </>
  );
}
