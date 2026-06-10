import { Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import "@/styles/pages.css";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
} as const;

const heroVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 70,
      damping: 14,
    },
  },
} as const;

const previewVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 60,
      damping: 16,
      delay: 0.15,
    },
  },
} as const;

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
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
      <main className="ld">
        <div className="grain" />
        <div className="orb one" />
        <div className="orb two" />
        <div className="orb three" />

        <div className="wrap">
          <motion.nav 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="nav"
          >
            <div className="brand">
              <div className="mark">CF</div>
              <div className="brand-text">
                <div className="brand-kicker">AI content studio</div>
                <div className="brand-name">Content<em>Forge</em></div>
              </div>
            </div>
            <div className="nav-actions">
              <Link to="/auth" className="nav-link">Sign in</Link>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link to="/auth" className="nav-cta">Get started</Link>
              </motion.div>
            </div>
          </motion.nav>

          <header className="hero">
            <motion.div 
              variants={heroVariants}
              initial="hidden"
              animate="visible"
              className="hero-copy"
            >
              <div className="eyebrow">Editorial-grade content workflows</div>
              <h1 className="text-balance">One brief.<br />A whole week of <em>finished</em> posts.</h1>
              <p className="lede text-pretty">
                ContentForge turns a single idea into a polished, platform-native content calendar for LinkedIn, X, Instagram, Facebook, newsletters, and blogs. Generate, refine, schedule, and export without losing the thread of your brand voice.
              </p>
              <div className="cta-row">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link to="/auth" className="cta-primary">Start free →</Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <a href="#how-it-works" className="cta-secondary">See the workflow</a>
                </motion.div>
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
            </motion.div>

            <motion.aside 
              variants={previewVariants}
              initial="hidden"
              animate="visible"
              className="hero-card outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" 
              aria-label="Product preview"
            >
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

                <div className="metrics-row font-mono tabular-nums">
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
            </motion.aside>
          </header>

          <section className="section section-shell">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="section-head"
            >
              <h2 className="section-h text-balance">Built for people who need content to feel <em>finished</em>.</h2>
              <p className="section-sub text-pretty">
                Every part of the workflow is designed around speed, brand consistency, and the reality that one post becomes a system when you do this every week.
              </p>
            </motion.div>
            
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="features"
            >
              <motion.article variants={itemVariants} className="feat" whileHover={{ y: -4, scale: 1.015 }} whileTap={{ scale: 0.985 }}>
                <div className="feat-icon">◬</div>
                <h3 className="feat-h">Brand-aware generation</h3>
                <p className="feat-p">Voice, audience, goals, banned phrases, and hashtag rules persist across every calendar so the output stays recognizably yours.</p>
              </motion.article>
              <motion.article variants={itemVariants} className="feat" whileHover={{ y: -4, scale: 1.015 }} whileTap={{ scale: 0.985 }}>
                <div className="feat-icon">◭</div>
                <h3 className="feat-h">Platform-native writing</h3>
                <p className="feat-p">Length, structure, hooks, and CTA style adapt to the chosen platform instead of forcing every channel into the same mold.</p>
              </motion.article>
              <motion.article variants={itemVariants} className="feat" whileHover={{ y: -4, scale: 1.015 }} whileTap={{ scale: 0.985 }}>
                <div className="feat-icon">◫</div>
                <h3 className="feat-h">Schedule & export</h3>
                <p className="feat-p">Time-zone aware scheduling, CSV/Markdown/PDF/ICS export, and row-level status controls for publishing workflows.</p>
              </motion.article>
              <motion.article variants={itemVariants} className="feat" whileHover={{ y: -4, scale: 1.015 }} whileTap={{ scale: 0.985 }}>
                <div className="feat-icon">◯</div>
                <h3 className="feat-h">Reusable brief templates</h3>
                <p className="feat-p">Save winning prompts as templates so recurring campaigns start from a polished brief instead of a blank screen.</p>
              </motion.article>
              <motion.article variants={itemVariants} className="feat" whileHover={{ y: -4, scale: 1.015 }} whileTap={{ scale: 0.985 }}>
                <div className="feat-icon">◍</div>
                <h3 className="feat-h">Single-post mode</h3>
                <p className="feat-p">Need a post for tomorrow? Generate one fully tuned post with the same brand context and export options.</p>
              </motion.article>
              <motion.article variants={itemVariants} className="feat" whileHover={{ y: -4, scale: 1.015 }} whileTap={{ scale: 0.985 }}>
                <div className="feat-icon">◎</div>
                <h3 className="feat-h">Draft auto-recovery</h3>
                <p className="feat-p">The wizard autosaves locally and restores recovery drafts so a refresh or crash never resets the work.</p>
              </motion.article>
            </motion.div>
            
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
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5 }}
              className="section-head"
            >
              <h2 className="section-h text-balance">From idea to <em>scheduled</em> in three moves.</h2>
              <p className="section-sub text-pretty">A guided flow that gets smarter after the first brief, then becomes the fastest way to create a full weekly content plan.</p>
            </motion.div>
            
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              className="steps"
            >
              <motion.div variants={itemVariants} className="step" data-step="01" whileHover={{ y: -2, scale: 1.01 }}>
                <h3 className="step-h">Brief your week</h3>
                <p className="step-p">Pick an industry, platform, and core idea. Add audience, goals, and tone, or let your saved defaults fill the form for you.</p>
              </motion.div>
              <motion.div variants={itemVariants} className="step" data-step="02" whileHover={{ y: -2, scale: 1.01 }}>
                <h3 className="step-h">Generate & refine</h3>
                <p className="step-p">Get a polished weekly calendar instantly. Regenerate any post, edit inline, or copy the final version in one click.</p>
              </motion.div>
              <motion.div variants={itemVariants} className="step" data-step="03" whileHover={{ y: -2, scale: 1.01 }}>
                <h3 className="step-h">Schedule & publish</h3>
                <p className="step-p">Save the calendar, mark posts as published, or export to your publishing stack with timezone support intact.</p>
              </motion.div>
            </motion.div>
          </section>

          <section className="section section-shell">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
              className="quote-grid"
            >
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
            </motion.div>
          </section>

          <section className="final">
            <motion.div 
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ type: "spring", stiffness: 50, damping: 15 }}
              className="final-panel"
            >
              <h2 className="text-balance">Stop staring at the <em>blank page</em>.</h2>
              <p className="text-pretty">Generate your first week of content in under a minute. The interface is built to feel calm, deliberate, and worthy of the work inside it.</p>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={{ display: "inline-block" }}>
                <Link to="/auth" className="cta-primary">Create your first calendar →</Link>
              </motion.div>
            </motion.div>
          </section>

          <footer>
            © {new Date().getFullYear()} ContentForge · Built for serious content teams
          </footer>
        </div>
      </main>
    </>
  );
}
