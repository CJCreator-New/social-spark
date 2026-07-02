import { Helmet } from "react-helmet-async";
import "@/styles/pages.css";

export default function Privacy() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy — ContentForge</title>
        <meta name="description" content="How ContentForge collects, uses, and protects your data." />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://contentforged.lovable.app/privacy" />
      </Helmet>
      <div className="lg-app">
        <div className="lg-inner">
          <a href="/" className="lg-back">← Back to ContentForge</a>
          <div className="lg-eyebrow">Legal</div>
          <h1 className="lg-title">Privacy Policy</h1>
          <p className="lg-updated">Last updated: June 15, 2026</p>
          <div className="lg-body">
            <p>
              ContentForge ("we", "us") provides an AI-powered content calendar and scheduling tool.
              This policy explains what information we collect, how we use it, and the choices you have.
            </p>

            <h2>Information we collect</h2>
            <ul>
              <li><strong>Account information</strong> — your email address and authentication details, managed via Supabase (email/password or Google sign-in).</li>
              <li><strong>Content inputs</strong> — the briefs, topics, brand voice settings, and other prompts you provide to generate posts.</li>
              <li><strong>Generated content</strong> — the calendars, posts, and schedules created on your behalf, stored so you can return to them.</li>
              <li><strong>Billing information</strong> — subscription plan and payment status. Payments are processed by Razorpay; we do not store your full card details.</li>
              <li><strong>Usage data</strong> — basic product analytics (e.g. generation counts, feature usage) used to enforce plan quotas and improve the product.</li>
            </ul>

            <h2>How we use your information</h2>
            <ul>
              <li>To operate your account and provide the core features of ContentForge.</li>
              <li>To send your content prompts to our AI providers (via the Lovable AI Gateway, and Google/OpenAI-compatible models) in order to generate posts. If you add your own API key ("Bring Your Own Key") for OpenAI, Anthropic, or OpenRouter, your prompts are sent directly to that provider using your key, not through the Lovable AI Gateway.</li>
              <li>To process subscription payments via Razorpay and manage your plan and quota.</li>
              <li>To maintain security, prevent abuse, and enforce rate limits and quotas.</li>
            </ul>

            <h2>Data storage and security</h2>
            <p>
              Your account data, generated content, and brand settings are stored in Supabase with
              Row-Level Security enabled, so only you (and authorized admins for support purposes) can
              access your data. If you choose to add your own AI provider API key, it is encrypted at rest
              and used only to fulfill your generation requests.
            </p>

            <h2>Third-party services</h2>
            <p>We rely on the following third-party services to operate ContentForge:</p>
            <ul>
              <li><strong>Supabase</strong> — authentication, database, and storage.</li>
              <li><strong>Razorpay</strong> — payment processing for paid plans.</li>
              <li><strong>Lovable AI Gateway / model providers</strong> — AI content generation. If you enable "Bring Your Own Key," your prompts route directly to your chosen provider — OpenAI, Anthropic, or OpenRouter — instead of the gateway.</li>
              <li><strong>Google</strong> — optional OAuth sign-in.</li>
            </ul>

            <h2>Your choices</h2>
            <ul>
              <li>You can edit or delete your generated calendars and posts at any time from your workspace.</li>
              <li>You can request deletion of your account and associated data by contacting us.</li>
              <li>You can remove a saved AI provider API key at any time from Settings.</li>
            </ul>

            <h2>Contact</h2>
            <p>
              Questions about this policy or your data can be sent to{" "}
              <a href="mailto:support@contentforged.app">support@contentforged.app</a>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
