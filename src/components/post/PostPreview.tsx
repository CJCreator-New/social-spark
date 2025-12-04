import { motion } from "framer-motion";
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal } from "lucide-react";
import { Platform } from "./PlatformSelector";
import { cn } from "@/lib/utils";

interface PostPreviewProps {
  content: string;
  hashtags: string[];
  platform: Platform;
}

export function PostPreview({ content, hashtags, platform }: PostPreviewProps) {
  const platformStyles: Record<Platform, { bg: string; accent: string }> = {
    facebook: { bg: "from-[#1877F2]/10 to-[#1877F2]/5", accent: "text-platform-facebook" },
    instagram: { bg: "from-[#E4405F]/10 to-[#833AB4]/10", accent: "text-platform-instagram" },
    linkedin: { bg: "from-[#0A66C2]/10 to-[#0A66C2]/5", accent: "text-platform-linkedin" },
    twitter: { bg: "from-[#1DA1F2]/10 to-[#1DA1F2]/5", accent: "text-platform-twitter" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "glass-card overflow-hidden",
        `bg-gradient-to-br ${platformStyles[platform].bg}`
      )}
    >
      {/* Post Header */}
      <div className="p-4 flex items-center gap-3 border-b border-border/30">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Your Brand</p>
          <p className="text-xs text-muted-foreground">Just now · 🌍</p>
        </div>
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {content || "Your caption will appear here..."}
        </p>
        {hashtags.length > 0 && (
          <p className={cn("mt-3 text-sm", platformStyles[platform].accent)}>
            {hashtags.join(" ")}
          </p>
        )}
      </div>

      {/* Image Placeholder */}
      <div className="mx-4 mb-4 aspect-video rounded-lg bg-secondary/50 flex items-center justify-center border border-border/30">
        <span className="text-xs text-muted-foreground">Image Preview</span>
      </div>

      {/* Engagement Stats */}
      <div className="px-4 py-2 border-t border-border/30">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>❤️ 247</span>
          <span>💬 32 comments</span>
          <span>↗️ 18 shares</span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border/30 flex items-center justify-around">
        {[
          { icon: Heart, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Share2, label: "Share" },
          { icon: Bookmark, label: "Save" },
        ].map((action) => (
          <button
            key={action.label}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors py-2 px-3 rounded-lg hover:bg-secondary/50"
          >
            <action.icon className="w-4 h-4" />
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
