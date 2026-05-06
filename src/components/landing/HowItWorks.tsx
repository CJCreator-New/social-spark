import { motion } from "framer-motion";

const steps = [
  {
    step: "01",
    title: "Brief",
    body: "Add your niche, voice, goals, audience, and platform. The wizard keeps the inputs tight instead of turning setup into homework.",
  },
  {
    step: "02",
    title: "Generate",
    body: "Create a full week or one targeted post, then refine copy, lock hashtags, and regenerate only what needs another pass.",
  },
  {
    step: "03",
    title: "Schedule",
    body: "Set publishing times, export an ICS calendar, attach UTM tracking, and move from draft to an actual posting plan.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.45 }}
        >
          <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/65">How it works</div>
          <h2 className="mt-4 font-['Manrope'] text-3xl font-extrabold text-white sm:text-4xl">
            A three-step flow that stays out of your way
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-8 text-foreground/70">
            The app is strongest when it turns a rough idea into something scheduled and usable. The flow mirrors that.
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="rounded-[1.5rem] border border-white/10 bg-white/5 p-6 backdrop-blur"
            >
              <div className="mb-5 inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] text-cyan-100/80">
                {item.step}
              </div>
              <h3 className="font-['Manrope'] text-2xl font-bold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-foreground/70">{item.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
