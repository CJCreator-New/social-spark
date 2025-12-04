import { motion } from "framer-motion";
import { Copy, Check, Heart, RefreshCw, Edit3 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Platform } from "./PlatformSelector";

interface CaptionVariationProps {
  content: string;
  platform: Platform;
  hashtags: string[];
  index: number;
  onSelect: () => void;
  isSelected: boolean;
}

export function CaptionVariation({ 
  content, 
  platform, 
  hashtags, 
  index, 
  onSelect,
  isSelected 
}: CaptionVariationProps) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(content + "\n\n" + hashtags.join(" "));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const platformColors: Record<Platform, string> = {
    facebook: "bg-platform-facebook/20 text-platform-facebook",
    instagram: "bg-platform-instagram/20 text-platform-instagram",
    linkedin: "bg-platform-linkedin/20 text-platform-linkedin",
    twitter: "bg-platform-twitter/20 text-platform-twitter",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onSelect}
      className={cn(
        "glass-card p-5 cursor-pointer transition-all duration-200 glow-effect",
        isSelected && "ring-2 ring-primary/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={cn("platform-badge", platformColors[platform])}>
            {platform.charAt(0).toUpperCase() + platform.slice(1)}
          </span>
          <span className="text-xs text-muted-foreground">
            Variation {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setLiked(!liked);
            }}
          >
            <Heart className={cn(
              "w-4 h-4 transition-colors",
              liked && "fill-destructive text-destructive"
            )} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed mb-4 text-foreground/90">
        {content}
      </p>

      {/* Hashtags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {hashtags.map((tag, i) => (
          <span 
            key={i} 
            className="text-xs text-primary/80 hover:text-primary transition-colors cursor-pointer"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border/50">
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
          <Edit3 className="w-3 h-3" />
          Edit
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5">
          <RefreshCw className="w-3 h-3" />
          Regenerate
        </Button>
      </div>
    </motion.div>
  );
}
