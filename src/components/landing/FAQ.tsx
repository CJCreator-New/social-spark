import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

const items = [
  {
    q: "Do I need API keys?",
    a: "No. The app uses its own backend integration for generation, so new users can try the workflow without setting up model credentials.",
  },
  {
    q: "Which platforms does it support?",
    a: "The current flow covers Facebook, Instagram, LinkedIn, X, plus long-form output for newsletters and blog posts.",
  },
  {
    q: "Does it publish for me?",
    a: "It helps you prepare and schedule the work with timezone-aware planning and exports. It is not a direct social publishing tool yet.",
  },
  {
    q: "Can I edit the AI output?",
    a: "Yes. Generated posts stay editable, and you can regenerate individual posts or whole unlocked batches without trashing everything.",
  },
  {
    q: "Is my data private?",
    a: "Accounts, calendars, and scheduling data live behind authenticated routes and per-user policies in the app backend.",
  },
  {
    q: "How does scheduling work?",
    a: "You pick per-post times, keep them in the right timezone, export an ICS calendar, and review everything again inside the schedule view.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.24em] text-cyan-100/65">FAQ</div>
        <h2 className="mt-4 font-['Manrope'] text-3xl font-extrabold text-white sm:text-4xl">
          Questions people ask before they trust the workflow
        </h2>
      </div>

      <Accordion.Root type="single" collapsible className="mt-10 space-y-4">
        {items.map((item, index) => (
          <Accordion.Item
            key={item.q}
            value={`item-${index}`}
            className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/5 backdrop-blur"
          >
            <Accordion.Header>
              <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                <span className="font-['Manrope'] text-lg font-bold text-white">{item.q}</span>
                <ChevronDown className="h-5 w-5 text-cyan-200 transition group-data-[state=open]:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="px-5 pb-5 text-sm leading-7 text-foreground/70">
              {item.a}
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}
