import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Clock3, Hash, Sparkles } from "lucide-react";

interface HeroProps {
  signedIn: boolean;
}

const stack = [
  { icon: Sparkles, title: "Generate", body: "7 posts from one brief", accent: "from-cyan-400/25 to-blue-500/10", delay: 0 },
  { icon: Hash, title: "Refine", body: "Lock tags, ban the rest", accent: "from-fuchsia-400/25 to-transparent", delay: 0.08 },
  { icon: Clock3, title: "Schedule", body: "Timezone-aware slots", accent: "from-emerald-400/25 to-transparent", delay: 0.16 },
];

export function Hero({ signedIn }: HeroProps) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_45%),radial-gradient(circle_at_75%_20%,rgba(139,92,246,0.12),transparent_28%)]" />
      <div className="mx-auto grid max-w-7xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:px-8 lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative z-10"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-cyan-100/80">
            <Sparkles className="h-3.5 w-3.5" />
            AI content studio
          </div>
          <h1 className="max-w-3xl font-['Manrope'] text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
            Turn one brief into a week of posts
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-foreground/75">
            ContentForge takes your audience, angle, and goals, then gives you platform-ready copy, smart hashtag control,
            and scheduling tools without dragging you through five different tabs.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              to={signedIn ? "/app" : "/auth?mode=signup"}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,hsl(199_89%_48%)_0%,hsl(262_83%_58%)_100%)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(14,165,233,0.28)] transition hover:brightness-110"
            >
              {signedIn ? "Open app" : "Get started free"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#showcase"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              See sample output
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-6 text-sm text-foreground/70">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-cyan-300" />
              Weekly calendar in one click
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-cyan-300" />
              Hashtag policy controls built in
            </div>
          </div>
        </motion.div>

        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_30px_80px_rgba(2,8,23,0.55)] backdrop-blur"
          >
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="text-sm text-foreground/55">Campaign</div>
                <div className="font-['Manrope'] text-xl font-bold text-white">Creator growth sprint</div>
              </div>
              <div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100/80">
                LinkedIn + X
              </div>
            </div>

            <div className="space-y-4">
              {stack.map((card) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.2 + card.delay }}
                  className={`rounded-2xl border border-white/10 bg-gradient-to-br ${card.accent} p-4`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                      <card.icon className="h-4.5 w-4.5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-white">{card.title}</div>
                        <div className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                      </div>
                      <p className="mt-1 text-sm leading-6 text-foreground/70">{card.body}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
