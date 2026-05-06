import { motion } from "framer-motion";
import { CalendarRange, Clock3, Hash, Link2, RefreshCcw, Wand2 } from "lucide-react";

const features = [
  { icon: CalendarRange, title: "7-day calendars in one click", body: "Start with one brief and get a complete weekly plan instead of prompting day by day." },
  { icon: Wand2, title: "Single-day generation", body: "Spin up one fresh post when you already know the date, campaign, or moment you want to hit." },
  { icon: Hash, title: "Hashtag locking and bans", body: "Pin the tags you want on a specific post while keeping a workspace-wide ban list for the rest." },
  { icon: Clock3, title: "Scheduling and ICS export", body: "Set post times in the right timezone, export an ICS file, and keep your publishing week coherent." },
  { icon: Link2, title: "UTM auto-builder", body: "Attach campaign tracking URLs without hand-building parameters for every calendar entry." },
  { icon: RefreshCcw, title: "Bulk regenerate with retries", body: "Refresh unlocked posts in batches with built-in backoff instead of babysitting every request." },
];

export function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.45 }}
        className="mx-auto max-w-3xl text-center"
      >
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/65">Features</div>
        <h2 className="mt-4 font-['Manrope'] text-3xl font-extrabold text-white sm:text-4xl">
          Built for the messy middle between idea and publish
        </h2>
        <p className="mt-4 text-lg leading-8 text-foreground/70">
          The product already does the useful work. The landing page just stops hiding it.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
            className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 backdrop-blur"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
              <feature.icon className="h-5 w-5 text-cyan-300" />
            </div>
            <h3 className="mt-5 font-['Manrope'] text-xl font-bold text-white">{feature.title}</h3>
            <p className="mt-3 text-sm leading-7 text-foreground/70">{feature.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
