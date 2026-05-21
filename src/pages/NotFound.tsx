import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <>
      <Helmet>
        <title>Page not found — ContentForge</title>
        <meta name="description" content="The page you're looking for doesn't exist. Head back to ContentForge to keep generating on-brand content calendars." />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://contentforged.lovable.app/" />
      </Helmet>
      <main className="nf-app">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Manrope:wght@400;500;600;700;800&display=swap');
          .nf-app { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:radial-gradient(circle at 16% 18%, rgba(216,255,121,0.12), transparent 24%), radial-gradient(circle at 82% 10%, rgba(130,233,198,0.08), transparent 24%), linear-gradient(180deg, #05060a 0%, #0a0d14 100%); color:#f2efe7; font-family:'Manrope',sans-serif; }
          .nf-card { width:100%; max-width:760px; border-radius:32px; border:1px solid rgba(255,255,255,0.08); background:rgba(13,16,25,0.78); box-shadow:0 30px 90px rgba(0,0,0,0.35); padding:34px; position:relative; overflow:hidden; }
          .nf-card::before { content:''; position:absolute; inset:-2px; background:radial-gradient(circle at 8% 0%, rgba(216,255,121,0.10), transparent 30%), radial-gradient(circle at 100% 0%, rgba(130,233,198,0.08), transparent 24%); pointer-events:none; }
          .nf-card > * { position:relative; z-index:1; }
          .nf-eyebrow { font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:#d8ff79; font-weight:800; margin-bottom:10px; display:flex; align-items:center; gap:8px; }
          .nf-eyebrow::before { content:''; display:block; width:22px; height:1px; background:#d8ff79; }
          .nf-grid { display:grid; grid-template-columns:minmax(0,1fr) 260px; gap:20px; align-items:center; }
          .nf-title { font-family:'Fraunces',serif; font-size:clamp(3rem, 8vw, 6rem); line-height:.92; letter-spacing:-.06em; margin:0 0 12px; }
          .nf-title em { color:#d8ff79; font-style:italic; }
          .nf-sub { font-size:15px; line-height:1.75; color:#a2a6b6; margin:0 0 18px; max-width:52ch; }
          .nf-actions { display:flex; gap:10px; flex-wrap:wrap; }
          .nf-link, .nf-primary { display:inline-flex; align-items:center; justify-content:center; padding:12px 16px; border-radius:999px; text-decoration:none; font-weight:800; font-size:13px; }
          .nf-primary { background:linear-gradient(135deg, #d8ff79, #f0ffbf); color:#08100c; }
          .nf-link { border:1px solid rgba(255,255,255,0.10); color:#f2efe7; background:rgba(255,255,255,0.02); }
          .nf-link:hover { border-color:rgba(216,255,121,0.28); background:rgba(216,255,121,0.05); }
          .nf-panel { padding:20px; border-radius:24px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); }
          .nf-number { font-family:'Fraunces',serif; font-size:72px; line-height:1; color:#d8ff79; letter-spacing:-.08em; }
          .nf-caption { color:#a2a6b6; font-size:12px; line-height:1.6; margin-top:8px; }
          .nf-list { display:grid; gap:10px; margin-top:14px; }
          .nf-item { padding:12px 14px; border-radius:16px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); color:#a2a6b6; font-size:12px; line-height:1.6; }
          .nf-item strong { color:#f2efe7; }
          @media (max-width: 720px) {
            .nf-card { padding:24px; border-radius:24px; }
            .nf-grid { grid-template-columns:1fr; }
            .nf-panel { order:-1; }
          }
        `}</style>
        <div className="nf-card">
          <div className="nf-eyebrow">ContentForge</div>
          <div className="nf-grid">
            <div>
              <h1 className="nf-title">This page drifted <em>off brief</em>.</h1>
              <p className="nf-sub">The route you opened does not exist. Jump back into the product, or go to the public landing page if you need to start from the top.</p>
              <div className="nf-actions">
                <a href="/app" className="nf-primary">Go to app</a>
                <a href="/" className="nf-link">Landing page</a>
                <a href="/auth" className="nf-link">Sign in</a>
              </div>
            </div>
            <aside className="nf-panel">
              <div className="nf-number">404</div>
              <div className="nf-caption">If you were looking for a calendar, schedule, or profile page, the links above will get you back on track.</div>
              <div className="nf-list">
                <div className="nf-item"><strong>Tip:</strong> if you hit this from a bookmarked page, refresh the app entry after signing in.</div>
                <div className="nf-item"><strong>Need help?</strong> return to the landing page and start again from the main CTA.</div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
};

export default NotFound;
