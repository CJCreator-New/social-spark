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
          .nf-app { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; background:var(--color-bg); color:var(--color-text); font-family:var(--font-sans); }
          .nf-card { width:100%; max-width:760px; border-radius:var(--radius-2xl); border:1px solid var(--color-border); background:var(--color-surface); box-shadow:var(--shadow-card); padding:34px; position:relative; overflow:hidden; }
          .nf-eyebrow { font-size:var(--text-xs); letter-spacing:.22em; text-transform:uppercase; color:var(--color-primary); font-weight:800; margin-bottom:10px; display:flex; align-items:center; gap:8px; }
          .nf-eyebrow::before { content:''; display:block; width:22px; height:1px; background:var(--color-primary); }
          .nf-grid { display:grid; grid-template-columns:minmax(0,1fr) 260px; gap:20px; align-items:center; }
          .nf-title { font-family:var(--font-display); font-size:clamp(2.5rem, 7vw, 4.5rem); line-height:1.02; letter-spacing:-.03em; margin:0 0 12px; color:var(--color-text); }
          .nf-title em { color:var(--color-primary); font-style:italic; }
          .nf-sub { font-size:var(--text-base); line-height:1.75; color:var(--color-text-secondary); margin:0 0 18px; max-width:52ch; }
          .nf-actions { display:flex; gap:10px; flex-wrap:wrap; }
          .nf-link, .nf-primary { display:inline-flex; align-items:center; justify-content:center; padding:12px 16px; border-radius:var(--radius-pill); text-decoration:none; font-weight:700; font-size:13px; transition:var(--transition-fast); }
          .nf-primary { background:var(--color-primary); color:#ffffff; box-shadow:var(--shadow-btn); }
          .nf-primary:hover { background:var(--color-primary-hover); box-shadow:var(--shadow-btn-hover); }
          .nf-link { border:1px solid var(--color-border); color:var(--color-text); background:var(--color-surface); }
          .nf-link:hover { border-color:var(--color-primary); background:var(--color-primary-xlight); }
          .nf-panel { padding:20px; border-radius:var(--radius-xl); background:var(--color-surface-muted); border:1px solid var(--color-border); }
          .nf-number { font-family:var(--font-display); font-size:64px; line-height:1; color:var(--color-primary); letter-spacing:-.04em; }
          .nf-caption { color:var(--color-text-secondary); font-size:12px; line-height:1.6; margin-top:8px; }
          .nf-list { display:grid; gap:10px; margin-top:14px; }
          .nf-item { padding:12px 14px; border-radius:var(--radius-lg); background:var(--color-surface); border:1px solid var(--color-border); color:var(--color-text-secondary); font-size:12px; line-height:1.6; }
          .nf-item strong { color:var(--color-text); }
          @media (max-width: 720px) {
            .nf-card { padding:24px; border-radius:var(--radius-xl); }
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
