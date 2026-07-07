import { Helmet } from "react-helmet-async";
import "@/styles/pages.css";

export default function Docs() {
  return (
    <>
      <Helmet>
        <title>Docs — ContentForge</title>
        <meta
          name="description"
          content="Get started with ContentForge: brand setup, content generation, and scheduling."
        />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://contentforged.lovable.app/docs" />
      </Helmet>
      <div className="lg-app">
        <div className="lg-inner">
          <a href="/" className="lg-back">
            ← Back to ContentForge
          </a>
          <div className="lg-eyebrow">Docs</div>
          <h1 className="lg-title">Getting started</h1>
          <p className="lg-updated">A quick tour of the core workflow</p>
          <div className="lg-body">
            <h2>1. Set up your brief</h2>
            <p>
              Pick your industry, platform, and write a short core idea describing what your content
              is about. Optionally tailor your voice, writing style, and target audience — these can
              be saved as brand memory so you don't have to re-enter them next time.
            </p>

            <h2>2. Choose topics</h2>
            <p>
              Select topics to cover for the week, or leave them blank and let ContentForge infer
              angles from your core idea. You can mix presets with your own custom topics.
            </p>

            <h2>3. Generate</h2>
            <p>
              Generate a full week of platform-native posts, or a single post for a specific day.
              Each post includes a hook, body, call-to-action, and hashtags tailored to your chosen
              platform.
            </p>

            <h2>4. Review and refine</h2>
            <p>
              Edit any post directly, or use regenerate tweaks (shorter, punchier, add a stat, more
              personal, etc.) to refine the angle without starting over. Posts include readability
              and engagement scoring to help you spot weak hooks or CTAs.
            </p>

            <h2>5. Schedule and export</h2>
            <p>
              Add your finished posts to the calendar and schedule view, then export or copy them in
              the format you need for your platform.
            </p>

            <h2>Plans and quotas</h2>
            <p>
              Your plan determines how many generations you get per period. You can see your usage
              and manage your plan from <a href="/profile?tab=plan">Profile → Plan</a>. Starter and
              Pro plans support adding your own AI provider API key for additional generations.
            </p>

            <h2>Need help?</h2>
            <p>
              Email <a href="mailto:support@contentforged.app">support@contentforged.app</a> and
              we'll get back to you.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
