import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/ui/PageLoader";
import "@/styles/pages.css";

// Section components (eager — no Three.js inside them)
import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import SocialProofBar from "@/components/landing/SocialProofBar";
import FeatureShowcase from "@/components/landing/FeatureShowcase";
import BentoGrid from "@/components/landing/BentoGrid";
import HowItWorks from "@/components/landing/HowItWorks";
import Testimonials from "@/components/landing/Testimonials";
import Pricing from "@/components/landing/Pricing";
import FinalCTA from "@/components/landing/FinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";

// Heavy Lenis + GSAP smooth scroll (lazy — initialises on first render)
const SmoothScroll = lazy(() => import("@/components/landing/SmoothScroll"));

const PAGE_TITLE = "ContentForge — AI-powered weekly content calendars";
const PAGE_DESC =
  "Turn one brief into a week of on-brand posts for LinkedIn, X, Instagram, and more. Schedule, refine, and publish — all in one place.";
const CANONICAL = "https://contentforged.lovable.app/";

const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ContentForge",
  description: "AI-powered content calendar generator for social platforms.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
});

export default function Landing() {
  const { user, loading } = useAuth();

  // Loading spinner while auth state resolves
  if (loading) {
    return <PageLoader />;
  }

  // Redirect authenticated users to the app
  if (user) return <Navigate to="/app" replace />;

  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESC} />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content={PAGE_TITLE} />
        <meta property="og:description" content={PAGE_DESC} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={CANONICAL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={PAGE_TITLE} />
        <meta name="twitter:description" content={PAGE_DESC} />
        <script type="application/ld+json">{JSON_LD}</script>
      </Helmet>

      {/* Skip to main content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-card focus:text-primary focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Skip to main content
      </a>

      {/* Lenis smooth scroll initialiser */}
      <Suspense fallback={null}>
        <SmoothScroll />
      </Suspense>

      {/* Fixed navigation */}
      <LandingNav />

      {/* Page root — warm editorial */}
      <div className="ld-w">
        <main id="main-content">
          <LandingHero />
          <SocialProofBar />
          <FeatureShowcase />
          <BentoGrid />
          <HowItWorks />
          <Testimonials />
          <Pricing />
          <FinalCTA />
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
