import { motion } from "framer-motion";
import { Briefcase, MessageCircle, Smile, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "professional" | "conversational" | "humorous" | "persuasive";

interface ToneSelectorProps {
  selected: Tone;
  onChange: (tone: Tone) => void;
}

const tones = [
  { id: "professional" as Tone, icon: Briefcase, label: "Professional", desc: "Formal & authoritative" },
  { id: "conversational" as Tone, icon: MessageCircle, label: "Conversational", desc: "Friendly & relatable" },
  { id: "humorous" as Tone, icon: Smile, label: "Humorous", desc: "Witty & engaging" },
  { id: "persuasive" as Tone, icon: Target, label: "Persuasive", desc: "Action-oriented" },
];

export function ToneSelector({ selected, onChange }: ToneSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {tones.map((tone, index) => {
        const isSelected = selected === tone.id;
        return (
          <motion.button
            key={tone.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onChange(tone.id)}
            className={cn(
              "flex flex-col items-start p-4 rounded-xl border transition-all duration-200 text-left",
              isSelected
                ? "border-primary/50 bg-primary/10"
                : "border-border/50 bg-secondary/30 hover:border-border hover:bg-secondary/50"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <tone.icon className={cn(
                "w-4 h-4",
                isSelected ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-sm font-medium",
                isSelected ? "text-foreground" : "text-muted-foreground"
              )}>
                {tone.label}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{tone.desc}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
