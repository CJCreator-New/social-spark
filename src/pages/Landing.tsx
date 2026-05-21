import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Manrope:wght@400;500;600;700;800&display=swap');
:root {
  --bg: #05060a;
  --bg2: #0a0d14;
  --panel: rgba(14, 16, 25, 0.82);
  --panel-border: rgba(255,255,255,0.08);
  --panel-strong: rgba(19, 23, 36, 0.94);
  --text: #f2efe7;
  --muted: #a2a6b6;
  --muted-2: #7c8294;
  --accent: #d8ff79;
  --accent-2: #82e9c6;
  --accent-3: #ffb86c;
  --shadow: 0 24px 80px rgba(0,0,0,0.35);
}
.ld { min-height:100vh; background:
  radial-gradient(circle at 18% 18%, rgba(216,255,121,0.11), transparent 25%),
  radial-gradient(circle at 82% 12%, rgba(130,233,198,0.08), transparent 22%),
  radial-gradient(circle at 80% 82%, rgba(255,184,108,0.06), transparent 24%),
  linear-gradient(180deg, var(--bg) 0%, var(--bg2) 100%);
  color:var(--text); font-family:'Manrope',sans-serif; position:relative; overflow-x:hidden; }
.ld .grain { position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.16; background-image:linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size:42px 42px; mix-blend-mode:soft-light; }
.ld .orb { position:fixed; border-radius:50%; pointer-events:none; filter:blur(20px); z-index:0; animation: drift 18s ease-in-out infinite; }
.ld .orb.one { width:520px; height:520px; left:-120px; top:120px; background:radial-gradient(circle, rgba(216,255,121,0.16), transparent 68%); }
.ld .orb.two { width:430px; height:430px; right:-120px; top:60px; background:radial-gradient(circle, rgba(130,233,198,0.12), transparent 68%); animation-duration: 22s; }
.ld .orb.three { width:500px; height:500px; right:12%; bottom:-180px; background:radial-gradient(circle, rgba(255,184,108,0.10), transparent 68%); animation-duration: 24s; }
@keyframes drift { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(0,-24px,0) scale(1.03)} }
.ld .wrap { position:relative; z-index:1; max-width:1200px; margin:0 auto; padding:22px 24px 0; }
.ld .nav { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:12px 0 28px; }
.ld .brand { display:flex; align-items:center; gap:12px; }
.ld .mark { width:42px; height:42px; border-radius:14px; background:linear-gradient(135deg, rgba(216,255,121,0.96), rgba(130,233,198,0.85)); box-shadow:0 14px 40px rgba(216,255,121,0.18); color:#07110c; display:grid; place-items:center; font-weight:900; letter-spacing:-.03em; }
.ld .brand-text { display:flex; flex-direction:column; line-height:1.05; }
.ld .brand-name { font-family:'Fraunces',serif; font-size:20px; letter-spacing:-.03em; }
.ld .brand-name em { color:var(--accent); font-style:italic; }
.ld .brand-kicker { font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:var(--muted-2); }
.ld .nav-actions { display:flex; gap:10px; flex-wrap:wrap; }
.ld .nav-link { font-size:13px; color:var(--muted); text-decoration:none; padding:10px 14px; border-radius:999px; border:1px solid transparent; }
.ld .nav-link:hover { color:var(--text); border-color:rgba(255,255,255,0.08); background:rgba(255,255,255,0.02); }
.ld .nav-cta { font-size:13px; color:#0b0d12; background:linear-gradient(135deg, var(--accent), #f0ffbf); text-decoration:none; padding:11px 18px; border-radius:999px; font-weight:800; box-shadow:0 14px 40px rgba(216,255,121,0.14); transition:transform .18s ease, box-shadow .18s ease; }
.ld .nav-cta:hover { transform:translateY(-1px); box-shadow:0 18px 48px rgba(216,255,121,0.20); }

.ld .hero { display:grid; grid-template-columns:minmax(0,1.05fr) minmax(340px,0.95fr); gap:28px; align-items:center; padding:38px 0 56px; }
.ld .hero-copy { position:relative; padding:14px 0; }
.ld .eyebrow { display:inline-flex; align-items:center; gap:10px; padding:8px 14px; border-radius:999px; border:1px solid rgba(216,255,121,0.18); background:rgba(216,255,121,0.06); color:var(--accent); text-transform:uppercase; letter-spacing:.2em; font-size:10px; font-weight:800; }
.ld h1 { font-family:'Fraunces',serif; font-size:clamp(3.4rem, 7vw, 6.3rem); line-height:.93; letter-spacing:-.06em; margin:18px 0 18px; max-width:10ch; }
.ld h1 em { color:var(--accent); font-style:italic; }
.ld .lede { max-width:60ch; color:var(--muted); font-size:17px; line-height:1.75; margin:0 0 26px; }
.ld .cta-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:18px; }
.ld .cta-primary, .ld .cta-secondary { display:inline-flex; align-items:center; justify-content:center; gap:8px; text-decoration:none; border-radius:999px; padding:14px 20px; font-weight:800; transition:transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease; }
.ld .cta-primary { background:linear-gradient(135deg, var(--accent), #f0ffbf); color:#08100c; box-shadow:0 16px 42px rgba(216,255,121,0.12); }
.ld .cta-primary:hover { transform:translateY(-1px); box-shadow:0 20px 50px rgba(216,255,121,0.18); }
.ld .cta-secondary { color:var(--text); border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.02); }
.ld .cta-secondary:hover { border-color:rgba(216,255,121,0.24); background:rgba(216,255,121,0.05); }
.ld .trust { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
.ld .trust-chip { padding:9px 12px; border-radius:999px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); color:var(--muted); font-size:12px; }
.ld .trust-chip strong { color:var(--text); }
.ld .stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:24px; }
.ld .stat { padding:16px 18px; border-radius:20px; background:linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)); border:1px solid rgba(255,255,255,0.06); box-shadow:var(--shadow); }
.ld .stat-value { font-family:'Fraunces',serif; font-size:30px; letter-spacing:-.04em; color:var(--accent); line-height:1; }
.ld .stat-label { margin-top:6px; font-size:12px; color:var(--muted); line-height:1.5; }

.ld .hero-card { position:relative; padding:18px; border-radius:30px; background:linear-gradient(180deg, rgba(21,24,36,0.98), rgba(12,14,22,0.88)); border:1px solid rgba(255,255,255,0.08); box-shadow:0 40px 90px rgba(0,0,0,0.38); overflow:hidden; }
.ld .hero-card::before { content:""; position:absolute; inset:-2px; background:radial-gradient(circle at 10% 0%, rgba(216,255,121,0.16), transparent 30%), radial-gradient(circle at 100% 0%, rgba(130,233,198,0.12), transparent 24%); pointer-events:none; }
.ld .card-top { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; position:relative; z-index:1; }
.ld .card-badge { font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:var(--muted-2); }
.ld .card-pill { padding:8px 10px; border-radius:999px; border:1px solid rgba(216,255,121,0.18); background:rgba(216,255,121,0.07); color:var(--accent); font-size:11px; font-weight:800; }
.ld .preview-panel { position:relative; z-index:1; padding:18px; border-radius:22px; background:rgba(7,9,14,0.62); border:1px solid rgba(255,255,255,0.06); }
.ld .preview-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:12px; }
.ld .preview-title { font-family:'Fraunces',serif; font-size:24px; line-height:1.15; margin:0; letter-spacing:-.03em; }
.ld .preview-sub { font-size:12px; color:var(--muted-2); margin-top:6px; }
.ld .preview-stats { display:flex; gap:8px; flex-wrap:wrap; }
.ld .mini { display:flex; gap:8px; align-items:center; padding:7px 10px; border-radius:999px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); font-size:11px; color:var(--muted); }
.ld .mini strong { color:var(--text); }
.ld .timeline { display:grid; gap:10px; margin-top:14px; }
.ld .day { display:grid; grid-template-columns:56px 1fr auto; gap:12px; align-items:center; padding:12px 12px; border-radius:16px; background:linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.018)); border:1px solid rgba(255,255,255,0.06); }
.ld .day-num { font-family:'Fraunces',serif; font-size:22px; color:var(--accent); }
.ld .day-copy { min-width:0; }
.ld .day-title { font-size:13px; font-weight:700; margin:0 0 2px; }
.ld .day-desc { font-size:11px; color:var(--muted-2); line-height:1.45; }
.ld .day-tag { font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--accent-2); padding:7px 9px; border-radius:999px; background:rgba(130,233,198,0.08); border:1px solid rgba(130,233,198,0.18); }
.ld .metrics-row { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-top:14px; }
.ld .metric { padding:12px; border-radius:16px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); }
.ld .metric-value { font-family:'Fraunces',serif; font-size:20px; color:var(--text); line-height:1; }
.ld .metric-label { margin-top:4px; font-size:10px; color:var(--muted-2); text-transform:uppercase; letter-spacing:.14em; }

.ld .section { position:relative; z-index:1; padding:20px 0 0; }
.ld .section-shell { padding:56px 0; }
.ld .section-head { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; margin-bottom:24px; }
.ld .section-h { font-family:'Fraunces',serif; font-size:clamp(2rem, 4vw, 3.3rem); margin:0; letter-spacing:-.04em; max-width:12ch; }
.ld .section-h em { font-style:italic; color:var(--accent); }
.ld .section-sub { color:var(--muted); font-size:14px; line-height:1.7; max-width:58ch; margin:0; }

.ld .features { display:grid; grid-template-columns:repeat(12,1fr); gap:14px; }
.ld .feat { grid-column:span 4; position:relative; background:linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025)); border:1px solid rgba(255,255,255,0.07); border-radius:24px; padding:22px 22px 20px; box-shadow:var(--shadow); overflow:hidden; }
.ld .feat::after { content:""; position:absolute; inset:auto -24px -24px auto; width:120px; height:120px; border-radius:50%; background:radial-gradient(circle, rgba(216,255,121,0.14), transparent 65%); pointer-events:none; }
.ld .feat:hover { transform:translateY(-3px); border-color:rgba(216,255,121,0.18); }
.ld .feat-icon { width:42px; height:42px; border-radius:14px; display:grid; place-items:center; margin-bottom:14px; background:rgba(216,255,121,0.08); border:1px solid rgba(216,255,121,0.16); color:var(--accent); font-size:20px; }
.ld .feat-h { margin:0 0 8px; font-size:15px; font-weight:800; }
.ld .feat-p { margin:0; color:var(--muted); font-size:13px; line-height:1.7; }

.ld .chips { display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; }
.ld .chip { padding:10px 14px; border-radius:999px; border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); color:var(--muted); font-size:12px; }
.ld .chip strong { color:var(--text); }

.ld .steps { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
.ld .step { position:relative; padding:24px; border-radius:24px; background:linear-gradient(180deg, rgba(18,20,32,0.96), rgba(10,12,18,0.9)); border:1px solid rgba(255,255,255,0.07); box-shadow:var(--shadow); }
.ld .step::before { content:attr(data-step); position:absolute; right:18px; top:16px; font-family:'Fraunces',serif; font-size:42px; color:rgba(216,255,121,0.15); }
.ld .step-h { margin:0 0 8px; font-size:16px; font-weight:800; max-width:16ch; }
.ld .step-p { margin:0; font-size:13px; line-height:1.7; color:var(--muted); }

.ld .quote-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:14px; align-items:stretch; }
.ld .quote { padding:26px; border-radius:26px; background:linear-gradient(160deg, rgba(216,255,121,0.08), rgba(255,255,255,0.03)); border:1px solid rgba(216,255,121,0.12); box-shadow:var(--shadow); }
.ld .quote p { font-family:'Fraunces',serif; font-size:clamp(1.2rem, 2vw, 1.7rem); line-height:1.35; margin:0 0 18px; letter-spacing:-.03em; }
.ld .quote small { color:var(--muted-2); text-transform:uppercase; letter-spacing:.16em; font-size:10px; }
.ld .proof { padding:26px; border-radius:26px; background:linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025)); border:1px solid rgba(255,255,255,0.07); display:grid; gap:14px; }
.ld .proof-item { display:flex; gap:12px; align-items:flex-start; }
.ld .proof-bullet { width:12px; height:12px; border-radius:50%; margin-top:5px; background:linear-gradient(135deg, var(--accent), var(--accent-2)); box-shadow:0 0 20px rgba(216,255,121,0.18); flex:0 0 auto; }
.ld .proof h3 { margin:0 0 4px; font-size:14px; }
.ld .proof p { margin:0; color:var(--muted); font-size:12px; line-height:1.65; }

.ld .final { padding:72px 0 96px; }
.ld .final-panel { position:relative; border-radius:32px; padding:40px 28px; background:linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025)); border:1px solid rgba(255,255,255,0.08); box-shadow:var(--shadow); text-align:center; overflow:hidden; }
.ld .final-panel::before { content:""; position:absolute; inset:0; background:radial-gradient(circle at top, rgba(216,255,121,0.12), transparent 48%); pointer-events:none; }
.ld .final h2 { position:relative; z-index:1; font-family:'Fraunces',serif; font-size:clamp(2.2rem, 4vw, 4rem); letter-spacing:-.04em; margin:0 0 12px; }
.ld .final h2 em { color:var(--accent); font-style:italic; }
.ld .final p { position:relative; z-index:1; color:var(--muted); font-size:15px; line-height:1.7; max-width:56ch; margin:0 auto 22px; }
.ld .final .cta-primary { position:relative; z-index:1; }

.ld footer { position:relative; z-index:1; padding:24px 0 34px; border-top:1px solid rgba(255,255,255,0.05); color:var(--muted-2); font-size:12px; text-align:center; }

@media (max-width: 960px) {
  .ld .hero { grid-template-columns:1fr; }
  .ld .features { grid-template-columns:repeat(6,1fr); }
  .ld .feat { grid-column:span 6; }
  .ld .quote-grid { grid-template-columns:1fr; }
}

@media (max-width: 720px) {
  .ld .wrap { padding-inline:16px; }
  .ld .nav { flex-direction:column; align-items:flex-start; }
  .ld .nav-actions { width:100%; }
  .ld .nav-link, .ld .nav-cta { flex:1; text-align:center; }
  .ld .stats { grid-template-columns:1fr; }
  .ld .metrics-row { grid-template-columns:repeat(2,1fr); }
  .ld .features, .ld .steps { grid-template-columns:1fr; }
  .ld .feat { grid-column:span 6; }
  .ld .day { grid-template-columns:42px 1fr; }
  .ld .day-tag { grid-column:1 / -1; justify-self:start; }
  .ld .section-head { flex-direction:column; align-items:flex-start; }
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
        <div className="grain" />
        <div className="orb one" />
        <div className="orb two" />
        <div className="orb three" />

        <div className="wrap">
          <nav className="nav">
            <div className="brand">
              <div className="mark">CF</div>
              <div className="brand-text">
                <div className="brand-kicker">AI content studio</div>
                <div className="brand-name">Content<em>Forge</em></div>
              </div>
            </div>
            <div className="nav-actions">
              <Link to="/auth" className="nav-link">Sign in</Link>
              <Link to="/auth" className="nav-cta">Get started</Link>
            </div>
          </nav>

          <header className="hero">
            <div className="hero-copy">
              <div className="eyebrow">Editorial-grade content workflows</div>
              <h1>One brief.<br />A whole week of <em>finished</em> posts.</h1>
              <p className="lede">
                ContentForge turns a single idea into a polished, platform-native content calendar for LinkedIn, X, Instagram, Facebook, newsletters, and blogs. Generate, refine, schedule, and export without losing the thread of your brand voice.
              </p>
              <div className="cta-row">
                <Link to="/auth" className="cta-primary">Start free →</Link>
                <a href="#how-it-works" className="cta-secondary">See the workflow</a>
              </div>
              <div className="trust">
                <span className="trust-chip"><strong>No credit card</strong> required</span>
                <span className="trust-chip"><strong>7 posts</strong> in under a minute</span>
                <span className="trust-chip"><strong>Autosave</strong> built in</span>
              </div>
              <div className="stats">
                <div className="stat">
                  <div className="stat-value">7x</div>
                  <div className="stat-label">Faster than starting each post from scratch</div>
                </div>
                <div className="stat">
                  <div className="stat-value">1 brief</div>
                  <div className="stat-label">Turns into a full content calendar with platform tuning</div>
                </div>
                <div className="stat">
                  <div className="stat-value">0 chaos</div>
                  <div className="stat-label">Brand defaults, hashtag rules, and draft recovery included</div>
                </div>
              </div>
            </div>

            <aside className="hero-card" aria-label="Product preview">
              <div className="card-top">
                <div>
                  <div className="card-badge">Live preview</div>
                  <div className="preview-sub">A week of content for a SaaS launch campaign</div>
                </div>
                <div className="card-pill">Ready to schedule</div>
              </div>

              <div className="preview-panel">
                <div className="preview-head">
                  <div>
                    <h2 className="preview-title">Launch Week: shipping a new product narrative</h2>
                    <div className="preview-sub">LinkedIn · Founder voice · Conversion-focused · 7 posts</div>
                  </div>
                  <div className="preview-stats">
                    <div className="mini"><strong>82</strong> score</div>
                    <div className="mini"><strong>3</strong> formats</div>
                  </div>
                </div>

                <div className="timeline">
                  <div className="day">
                    <div className="day-num">01</div>
                    <div className="day-copy">
                      <div className="day-title">Positioning story</div>
                      <div className="day-desc">A founder-led post that frames the product’s point of view and names the problem with clarity.</div>
                    </div>
                    <div className="day-tag">Hook</div>
                  </div>
                  <div className="day">
                    <div className="day-num">02</div>
                    <div className="day-copy">
                      <div className="day-title">Customer pain point</div>
                      <div className="day-desc">A sharper, more practical post that shows the cost of doing nothing and why the status quo breaks.</div>
                    </div>
                    <div className="day-tag">Insight</div>
                  </div>
                  <div className="day">
                    <div className="day-num">03</div>
                    <div className="day-copy">
                      <div className="day-title">Product proof</div>
                      <div className="day-desc">A concrete value post with a clean CTA, platform-native structure, and branded hashtag policy.</div>
                    </div>
                    <div className="day-tag">CTA</div>
                  </div>
                </div>

                <div className="metrics-row">
                  <div className="metric">
                    <div className="metric-value">7</div>
                    <div className="metric-label">post calendar</div>
                  </div>
                  <div className="metric">
                    <div className="metric-value">4</div>
                    <div className="metric-label">export formats</div>
                  </div>
                  <div className="metric">
                    <div className="metric-value">1</div>
                    <div className="metric-label">saved brief template</div>
                  </div>
                  <div className="metric">
                    <div className="metric-value">24h</div>
                    <div className="metric-label">draft recovery window</div>
                  </div>
                </div>
              </div>
            </aside>
          </header>

          <section className="section section-shell">
            <div className="section-head">
              <h2 className="section-h">Built for people who need content to feel <em>finished</em>.</h2>
              <p className="section-sub">
                Every part of the workflow is designed around speed, brand consistency, and the reality that one post becomes a system when you do this every week.
              </p>
            </div>
            <div className="features">
              <article className="feat">
                <div className="feat-icon">◬</div>
                <h3 className="feat-h">Brand-aware generation</h3>
                <p className="feat-p">Voice, audience, goals, banned phrases, and hashtag rules persist across every calendar so the output stays recognizably yours.</p>
              </article>
              <article className="feat">
                <div className="feat-icon">◭</div>
                <h3 className="feat-h">Platform-native writing</h3>
                <p className="feat-p">Length, structure, hooks, and CTA style adapt to the chosen platform instead of forcing every channel into the same mold.</p>
              </article>
              <article className="feat">
                <div className="feat-icon">◫</div>
                <h3 className="feat-h">Schedule & export</h3>
                <p className="feat-p">Time-zone aware scheduling, CSV/Markdown/PDF/ICS export, and row-level status controls for publishing workflows.</p>
              </article>
              <article className="feat">
                <div className="feat-icon">◯</div>
                <h3 className="feat-h">Reusable brief templates</h3>
                <p className="feat-p">Save winning prompts as templates so recurring campaigns start from a polished brief instead of a blank screen.</p>
              </article>
              <article className="feat">
                <div className="feat-icon">◍</div>
                <h3 className="feat-h">Single-post mode</h3>
                <p className="feat-p">Need a post for tomorrow? Generate one fully tuned post with the same brand context and export options.</p>
              </article>
              <article className="feat">
                <div className="feat-icon">◎</div>
                <h3 className="feat-h">Draft auto-recovery</h3>
                <p className="feat-p">The wizard autosaves locally and restores recovery drafts so a refresh or crash never resets the work.</p>
              </article>
            </div>
            <div className="chips">
              <span className="chip"><strong>LinkedIn</strong></span>
              <span className="chip"><strong>Twitter / X</strong></span>
              <span className="chip"><strong>Instagram</strong></span>
              <span className="chip"><strong>Facebook</strong></span>
              <span className="chip"><strong>Newsletter</strong></span>
              <span className="chip"><strong>Blog</strong></span>
            </div>
          </section>

          <section className="section section-shell" id="how-it-works">
            <div className="section-head">
              <h2 className="section-h">From idea to <em>scheduled</em> in three moves.</h2>
              <p className="section-sub">A guided flow that gets smarter after the first brief, then becomes the fastest way to create a full weekly content plan.
              </p>
            </div>
            <div className="steps">
              <div className="step" data-step="01">
                <h3 className="step-h">Brief your week</h3>
                <p className="step-p">Pick an industry, platform, and core idea. Add audience, goals, and tone, or let your saved defaults fill the form for you.</p>
              </div>
              <div className="step" data-step="02">
                <h3 className="step-h">Generate & refine</h3>
                <p className="step-p">Get a polished weekly calendar instantly. Regenerate any post, edit inline, or copy the final version in one click.</p>
              </div>
              <div className="step" data-step="03">
                <h3 className="step-h">Schedule & publish</h3>
                <p className="step-p">Save the calendar, mark posts as published, or export to your publishing stack with timezone support intact.</p>
              </div>
            </div>
          </section>

          <section className="section section-shell">
            <div className="quote-grid">
              <div className="quote">
                <small>Why teams switch</small>
                <p>“It feels less like a template generator and more like a content desk that already understands our brand.”</p>
                <div className="trust-chip" style={{ display: "inline-flex", marginTop: 4 }}><strong>Marketing lead</strong> · content operations</div>
              </div>
              <div className="proof">
                <div className="proof-item">
                  <span className="proof-bullet" />
                  <div>
                    <h3>Fewer handoffs</h3>
                    <p>One brief becomes one calendar, which becomes one schedule, with less copying between tools.</p>
                  </div>
                </div>
                <div className="proof-item">
                  <span className="proof-bullet" />
                  <div>
                    <h3>Better consistency</h3>
                    <p>Brand defaults, hashtag policy, and draft recovery keep the output stable even when the workflow is fast.</p>
                  </div>
                </div>
                <div className="proof-item">
                  <span className="proof-bullet" />
                  <div>
                    <h3>Designed for iteration</h3>
                    <p>Regenerate, tweak, and save without losing context, so each calendar gets sharper than the last.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="final">
            <div className="final-panel">
              <h2>Stop staring at the <em>blank page</em>.</h2>
              <p>Generate your first week of content in under a minute. The interface is built to feel calm, deliberate, and worthy of the work inside it.</p>
              <Link to="/auth" className="cta-primary">Create your first calendar →</Link>
            </div>
          </section>

          <footer>
            © {new Date().getFullYear()} ContentForge · Built for serious content teams
          </footer>
        </div>
      </main>
    </>
  );
}
