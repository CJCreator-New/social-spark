import { motion } from "framer-motion";
import { Megaphone, Bell, BookOpen, Layers, MessageSquare, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export type Template = "promo" | "announcement" | "story" | "carousel" | "thread" | "thought-leadership";

interface TemplateSelectorProps {
  selected: Template;
  onChange: (template: Template) => void;
}

const templates = [
  { id: "promo" as Template, icon: Megaphone, label: "Promo" },
  { id: "announcement" as Template, icon: Bell, label: "Announce" },
  { id: "story" as Template, icon: BookOpen, label: "Story" },
  { id: "carousel" as Template, icon: Layers, label: "Carousel" },
  { id: "thread" as Template, icon: MessageSquare, label: "Thread" },
  { id: "thought-leadership" as Template, icon: Lightbulb, label: "Thought" },
];

export function TemplateSelector({ selected, onChange }: TemplateSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {templates.map((template, index) => {
        const isSelected = selected === template.id;
        return (
          <motion.button
            key={template.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.03 }}
            onClick={() => onChange(template.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200",
              isSelected
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
            )}
          >
            <template.icon className="w-3.5 h-3.5" />
            {template.label}
          </motion.button>
        );
      })}
    </div>
  );
}
