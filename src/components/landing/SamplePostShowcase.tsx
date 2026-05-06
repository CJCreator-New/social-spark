import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Instagram, Linkedin, MessageSquareText, Twitter } from "lucide-react";
import { SAMPLE_POSTS } from "@/lib/sampleCalendar";
import { formatForPlatform } from "@/lib/platformCopy";

const platformTabs = [
  { id: "linkedin", label: "LinkedIn", platform: "LinkedIn", icon: Linkedin },
  { id: "twitter", label: "X", platform: "Twitter/X", icon: Twitter },
  { id: "instagram", label: "Instagram", platform: "Instagram", icon: Instagram },
  { id: "facebook", label: "Facebook", platform: "Facebook", icon: MessageSquareText },
] as const;

export function SamplePostShowcase() {
  const [activeTab, setActiveTab] = useState<(typeof platformTabs)[number]["id"]>("linkedin");
  const [activePost, setActivePost] = useState(0);

  const tab = platformTabs.find((item) => item.id === activeTab) || platformTabs[0];
  const preview = useMemo(() => {
    const post = SAMPLE_POSTS[activePost] || SAMPLE_POSTS[0];
    return formatForPlatform(post, tab.platform);
  }, [activePost, tab.platform]);

  return (
    <section id="showcase" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_90px_rgba(2,8,23,0.45)] backdrop-blur sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.45 }}
          className="max-w-3xl"
        >
          <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/65">Sample output</div>
          <h2 className="mt-4 font-['Manrope'] text-3xl font-extrabold text-white sm:text-4xl">
            Real sample posts, reformatted for each platform
          </h2>
          <p className="mt-4 text-lg leading-8 text-foreground/70">
            The copy below comes from the real sample calendar in the codebase. We’re not padding this page with lorem.
          </p>
        </motion.div>

        <div className="mt-8 flex flex-wrap gap-3">
          {platformTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                activeTab === item.id
                  ? "border-cyan-300/40 bg-cyan-300/10 text-white"
                  : "border-white/10 bg-black/10 text-foreground/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.38fr_0.62fr]">
          <div className="space-y-3">
            {SAMPLE_POSTS.slice(0, 5).map((post, index) => (
              <button
                key={post.day}
                type="button"
                onClick={() => setActivePost(index)}
                className={`w-full rounded-[1.25rem] border p-4 text-left transition ${
                  activePost === index
                    ? "border-cyan-300/35 bg-cyan-300/10"
                    : "border-white/10 bg-black/10 hover:bg-white/5"
                }`}
              >
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/65">
                  Day {post.day} · {post.dow}
                </div>
                <div className="mt-2 font-['Manrope'] text-lg font-bold text-white">{post.title}</div>
                <div className="mt-2 text-sm leading-6 text-foreground/65">{post.topic}</div>
              </button>
            ))}
          </div>

          <motion.div
            key={`${activeTab}-${activePost}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-[1.5rem] border border-white/10 bg-[#08111f] p-5"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-cyan-100/65">{tab.label} preview</div>
                <div className="mt-1 font-['Manrope'] text-xl font-bold text-white">
                  {SAMPLE_POSTS[activePost]?.title}
                </div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-foreground/70">
                <Copy className="h-3.5 w-3.5" />
                {preview.charCount} / {preview.limit}
              </div>
            </div>
            <pre className="mt-5 whitespace-pre-wrap break-words font-['Inter'] text-sm leading-7 text-foreground/80">
              {preview.text}
            </pre>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
