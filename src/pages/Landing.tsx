import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;1,400&family=Sora:wght@300;400;500;600&display=swap');
.ld { min-height:100vh; background:#07080d; color:#edeae3; font-family:'Sora',sans-serif; position:relative; overflow-x:hidden; }
.ld .grid { position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:linear-gradient(rgba(200,240,154,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(200,240,154,0.02) 1px,transparent 1px);
  background-size:52px 52px; }
.ld .glow { position:fixed;width:900px;height:900px;border-radius:50%;
  background:radial-gradient(circle,rgba(200,240,154,0.05) 0%,transparent 65%);
  pointer-events:none;top:-400px;left:50%;transform:translateX(-50%);z-index:0;
  animation: ldFloat 14s ease-in-out infinite; }
@keyframes ldFloat { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(40px)} }
.ld .nav { position:relative; z-index:2; max-width:1100px; margin:0 auto; padding:24px 28px; display:flex; justify-content:space-between; align-items:center; }
.ld .logo { font-family:'Playfair Display',serif; font-size:22px; font-weight:400; }
.ld .logo em { font-style:italic; color:#c8f09a; }
.ld .nav-actions { display:flex; gap:10px; align-items:center; }
.ld a.btn-ghost { font-size:13px; color:#7a7a8e; text-decoration:none; padding:8px 14px; }
.ld a.btn-ghost:hover { color:#edeae3; }
.ld a.btn-primary { font-size:13px; color:#07080d; background:#c8f09a; text-decoration:none; padding:9px 18px; border-radius:8px; font-weight:500; transition:transform .15s; }
.ld a.btn-primary:hover { transform:translateY(-1px); background:#d4f7aa; }

.ld .hero { position:relative; z-index:1; max-width:880px; margin:0 auto; padding:80px 28px 100px; text-align:center; }
.ld .eyebrow { font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:#c8f09a; font-weight:500; margin-bottom:18px; display:inline-flex; gap:10px; align-items:center; padding:6px 14px; border:1px solid rgba(200,240,154,.25); border-radius:99px; background:rgba(200,240,154,.04); }
.ld h1 { font-family:'Playfair Display',serif; font-size:64px; font-weight:400; letter-spacing:-1.5px; line-height:1.05; margin:0 0 22px; }
.ld h1 em { font-style:italic; color:#c8f09a; }
.ld .lede { font-size:17px; line-height:1.65; color:#9a9aae; max-width:620px; margin:0 auto 36px; font-weight:300; }
.ld .cta-row { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
.ld .cta-primary { background:#c8f09a; color:#07080d; padding:14px 26px; border-radius:10px; font-size:14px; font-weight:500; text-decoration:none; transition:all .15s; }
.ld .cta-primary:hover { transform:translateY(-2px); box-shadow:0 12px 40px rgba(200,240,154,.2); }
.ld .cta-ghost { padding:14px 26px; border-radius:10px; font-size:14px; color:#edeae3; text-decoration:none; border:1px solid rgba(255,255,255,.12); }
.ld .cta-ghost:hover { border-color:rgba(200,240,154,.3); color:#c8f09a; }
.ld .meta { margin-top:22px; font-size:12px; color:#5a5a72; }

.ld .section { position:relative; z-index:1; max-width:1080px; margin:0 auto; padding:60px 28px; }
.ld .section-h { font-family:'Playfair Display',serif; font-size:36px; font-weight:400; text-align:center; margin:0 0 12px; letter-spacing:-.5px; }
.ld .section-h em { font-style:italic; color:#c8f09a; }
.ld .section-sub { text-align:center; color:#7a7a8e; font-size:14px; margin:0 auto 44px; max-width:520px; line-height:1.6; }

.ld .features { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.ld .feat { background:#0d0f18; border:1px solid rgba(255,255,255,.055); border-radius:16px; padding:26px; transition:all .2s; }
.ld .feat:hover { border-color:rgba(200,240,154,.18); transform:translateY(-3px); }
.ld .feat-icon { font-size:22px; color:#c8f09a; margin-bottom:14px; }
.ld .feat-h { font-size:15px; font-weight:500; margin:0 0 8px; color:#edeae3; }
.ld .feat-p { font-size:13px; line-height:1.6; color:#7a7a8e; margin:0; font-weight:300; }

.ld .platforms { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin:32px 0 8px; }
.ld .pchip { padding:8px 16px; border:1px solid rgba(255,255,255,.08); border-radius:99px; font-size:12px; color:#9a9aae; background:#0d0f18; }
.ld .pchip strong { color:#c8f09a; font-weight:500; }

.ld .steps { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.ld .step { background:#0d0f18; border:1px solid rgba(255,255,255,.055); border-radius:16px; padding:26px; position:relative; }
.ld .step-num { font-family:'Playfair Display',serif; font-size:42px; color:rgba(200,240,154,.25); font-style:italic; line-height:1; margin-bottom:8px; }
.ld .step-h { font-size:15px; margin:0 0 6px; color:#edeae3; font-weight:500; }
.ld .step-p { font-size:13px; color:#7a7a8e; margin:0; line-height:1.55; font-weight:300; }

.ld .final { text-align:center; padding:80px 28px 100px; position:relative; z-index:1; max-width:720px; margin:0 auto; }
.ld .final h2 { font-family:'Playfair Display',serif; font-size:42px; font-weight:400; margin:0 0 16px; letter-spacing:-.5px; }
.ld .final h2 em { font-style:italic; color:#c8f09a; }
.ld .final p { color:#7a7a8e; font-size:15px; margin:0 0 28px; line-height:1.65; }

.ld footer { border-top:1px solid rgba(255,255,255,.04); padding:28px; text-align:center; font-size:12px; color:#5a5a72; position:relative; z-index:1; }

@media (max-width: 720px) {
  .ld h1 { font-size:42px; }
  .ld .features, .ld .steps { grid-template-columns:1fr; }
  .ld .section-h { font-size:28px; }
}
`;

export default function Landing() {
  const { user, loading } = useAuth();

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

  if (loading) return null;
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
      <style>{css}</style>
      <main className="ld">
        <div className="grid" />
        <div className="glow" />

        <nav className="nav">
          <div className="logo">Content<em>Forge</em></div>
          <div className="nav-actions">
            <Link to="/auth" className="btn-ghost">Sign in</Link>
            <Link to="/auth" className="btn-primary">Get started</Link>
          </div>
        </nav>

        <header className="hero">
          <div className="eyebrow">✦ AI-native content workflow</div>
          <h1>One brief.<br/>A whole week of <em>on-brand</em> posts.</h1>
          <p className="lede">
            ContentForge transforms a single idea into a polished, platform-tuned content calendar
            for LinkedIn, X, Instagram, Facebook, newsletters, and blogs — with scheduling, exports,
            and brand-safe hashtag rules baked in.
          </p>
          <div className="cta-row">
            <Link to="/auth" className="cta-primary">Start free →</Link>
            <a href="#how-it-works" className="cta-ghost">See how it works</a>
          </div>
          <div className="meta">No credit card · 7 posts in under a minute</div>

          <div className="platforms">
            <span className="pchip"><strong>LinkedIn</strong></span>
            <span className="pchip"><strong>Twitter / X</strong></span>
            <span className="pchip"><strong>Instagram</strong></span>
            <span className="pchip"><strong>Facebook</strong></span>
            <span className="pchip"><strong>Newsletter</strong></span>
            <span className="pchip"><strong>Blog</strong></span>
          </div>
        </header>

        <section className="section">
          <h2 className="section-h">Built for <em>real</em> content teams</h2>
          <p className="section-sub">
            Every feature is designed around the way operators actually publish — fast iteration, brand consistency, zero busywork.
          </p>
          <div className="features">
            <div className="feat">
              <div className="feat-icon">◬</div>
              <h3 className="feat-h">Brand-aware generation</h3>
              <p className="feat-p">Voice, audience, goals, banned phrases and hashtag rules persist across every calendar you generate.</p>
            </div>
            <div className="feat">
              <div className="feat-icon">◭</div>
              <h3 className="feat-h">Per-platform optimisation</h3>
              <p className="feat-p">Length, structure, hooks and hashtags adapt to each platform's native format — no copy-paste retrofitting.</p>
            </div>
            <div className="feat">
              <div className="feat-icon">◫</div>
              <h3 className="feat-h">Schedule &amp; export</h3>
              <p className="feat-p">Drop posts into a timezone-aware schedule, mark them published, or export to ICS, CSV, Markdown, and PDF.</p>
            </div>
            <div className="feat">
              <div className="feat-icon">◯</div>
              <h3 className="feat-h">Reusable brief templates</h3>
              <p className="feat-p">Save winning briefs as templates and re-run them in one click — perfect for recurring campaigns.</p>
            </div>
            <div className="feat">
              <div className="feat-icon">◍</div>
              <h3 className="feat-h">Single-post mode</h3>
              <p className="feat-p">Need just one post for tomorrow? Generate a single, fully-tuned post in seconds with the same brand context.</p>
            </div>
            <div className="feat">
              <div className="feat-icon">◎</div>
              <h3 className="feat-h">Draft auto-recovery</h3>
              <p className="feat-p">Your wizard state is autosaved. Close the tab, refresh, come back tomorrow — your work is right where you left it.</p>
            </div>
          </div>
        </section>

        <section className="section" id="how-it-works">
          <h2 className="section-h">From idea to <em>scheduled</em> in three steps</h2>
          <p className="section-sub">A guided wizard that learns your brand defaults so the second calendar is twice as fast as the first.</p>
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <h3 className="step-h">Brief your week</h3>
              <p className="step-p">Pick an industry, your platform, and a core idea. Add audience, voice, and goals — or use your saved defaults.</p>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <h3 className="step-h">Generate &amp; refine</h3>
              <p className="step-p">Get seven (or one) on-brand posts instantly. Regenerate any post, edit inline, or copy in one click.</p>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <h3 className="step-h">Schedule &amp; publish</h3>
              <p className="step-p">Drop the calendar into your schedule with timezone support, mark posts as published, or export everywhere.</p>
            </div>
          </div>
        </section>

        <section className="final">
          <h2>Stop staring at the <em>blank page</em>.</h2>
          <p>Generate your first week of content in under a minute. Free to start, no credit card required.</p>
          <Link to="/auth" className="cta-primary">Create your first calendar →</Link>
        </section>

        <footer>
          © {new Date().getFullYear()} ContentForge · Built with care
        </footer>
      </main>
    </>
  );
}
