import { motion } from "framer-motion";
import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import { cn } from "@/lib/utils";

export type Platform = "facebook" | "instagram" | "linkedin" | "twitter";

interface PlatformSelectorProps {
  selected: Platform[];
  onChange: (platforms: Platform[]) => void;
}

const platforms = [
  { id: "facebook" as Platform, icon: Facebook, label: "Facebook", color: "platform-facebook" },
  { id: "instagram" as Platform, icon: Instagram, label: "Instagram", color: "platform-instagram" },
  { id: "linkedin" as Platform, icon: Linkedin, label: "LinkedIn", color: "platform-linkedin" },
  { id: "twitter" as Platform, icon: Twitter, label: "X", color: "platform-twitter" },
];

export function PlatformSelector({ selected, onChange }: PlatformSelectorProps) {
  const togglePlatform = (platform: Platform) => {
    if (selected.includes(platform)) {
      onChange(selected.filter(p => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {platforms.map((platform, index) => {
        const isSelected = selected.includes(platform.id);
        return (
          <motion.button
            key={platform.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => togglePlatform(platform.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200",
              isSelected
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border/50 bg-secondary/30 text-muted-foreground hover:border-border hover:bg-secondary/50"
            )}
          >
            <platform.icon className={cn(
              "w-4 h-4 transition-colors",
              isSelected && platform.id === "facebook" && "text-platform-facebook",
              isSelected && platform.id === "instagram" && "text-platform-instagram",
              isSelected && platform.id === "linkedin" && "text-platform-linkedin",
              isSelected && platform.id === "twitter" && "text-platform-twitter",
            )} />
            <span className="text-sm font-medium">{platform.label}</span>
            {isSelected && (
              <motion.div
                layoutId={`check-${platform.id}`}
                className="w-2 h-2 rounded-full bg-primary"
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
