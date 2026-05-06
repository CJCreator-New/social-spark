import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { SamplePostShowcase } from "@/components/landing/SamplePostShowcase";
import { PricingTeaser } from "@/components/landing/PricingTeaser";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";

const socialProof = ["Facebook", "Instagram", "LinkedIn", "X", "Newsletter", "Blog"];

const meta = {
  title: "ContentForge | Turn one brief into a week of posts",
  description:
    "Generate 7-day content calendars, refine per-post copy, manage hashtags, and schedule timezone-aware posts from one clean workflow.",
};

function setMetaTag(name: string, content: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let tag = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    if (property) tag.setAttribute("property", name);
    else tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

export default function Landing() {
  const { user, loading } = useAuth();

  useEffect(() => {
    const previousTitle = document.title;
    const previousScroll = document.documentElement.style.scrollBehavior;

    document.title = meta.title;
    document.documentElement.style.scrollBehavior = "smooth";
    setMetaTag("description", meta.description);
    setMetaTag("og:title", meta.title, true);
    setMetaTag("og:description", meta.description, true);
    setMetaTag("og:type", "website", true);

    return () => {
      document.title = previousTitle;
      document.documentElement.style.scrollBehavior = previousScroll;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground/60">
        Loading...
      </div>
    );
  }

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav signedIn={false} />
      <main>
        <Hero signedIn={false} />

        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.4 }}
            className="rounded-[1.5rem] border border-white/10 bg-white/5 px-6 py-5 backdrop-blur"
          >
            <div className="text-center text-xs uppercase tracking-[0.28em] text-cyan-100/65">
              Built for creators on
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-['Manrope'] text-lg font-bold text-white/85">
              {socialProof.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </motion.div>
        </section>

        <FeatureGrid />
        <HowItWorks />
        <SamplePostShowcase />
        <PricingTeaser signedIn={false} />
        <FAQ />
      </main>
      <Footer signedIn={false} />
    </div>
  );
}
