import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Link2, FileText, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformSelector, Platform } from "./PlatformSelector";
import { ToneSelector, Tone } from "./ToneSelector";
import { TemplateSelector, Template } from "./TemplateSelector";
import { CaptionVariation } from "./CaptionVariation";
import { PostPreview } from "./PostPreview";
import { cn } from "@/lib/utils";

// Mock generated captions
const mockCaptions: Record<Platform, { content: string; hashtags: string[] }[]> = {
  facebook: [
    {
      content: "🚀 Exciting news! We've just launched something that's going to change the way you think about productivity. After months of hard work, our team is thrilled to share this with you.\n\nWhat makes it special? It's designed with YOU in mind. Simple. Powerful. Effective.",
      hashtags: ["#Innovation", "#ProductLaunch", "#GameChanger", "#Technology"],
    },
    {
      content: "Ever wondered what it takes to build something amazing? It starts with a simple idea and the courage to pursue it. Today, we're sharing our journey and the lessons we've learned along the way. 💡",
      hashtags: ["#Entrepreneurship", "#StartupLife", "#Success", "#Motivation"],
    },
    {
      content: "The future is here, and it's more accessible than ever. We believe great tools should be available to everyone, not just the few. That's why we built this. Check it out! 🌟",
      hashtags: ["#FutureTech", "#Accessibility", "#Innovation", "#Tech"],
    },
  ],
  instagram: [
    {
      content: "✨ New drop alert! Something special is coming your way. Double tap if you're ready to level up your game 🔥\n\nLink in bio to learn more 👆",
      hashtags: ["#NewLaunch", "#ComingSoon", "#ExcitingNews", "#StayTuned", "#Innovation"],
    },
    {
      content: "Behind every success is a story of dedication, late nights, and unwavering belief. This is ours. 💫\n\nSwipe to see the journey →",
      hashtags: ["#BehindTheScenes", "#JourneyToSuccess", "#Hustle", "#DreamBig"],
    },
  ],
  linkedin: [
    {
      content: "I'm thrilled to announce a major milestone in our company's journey.\n\nAfter 18 months of development, countless iterations, and invaluable feedback from our early adopters, we're finally ready to share what we've been building.\n\nHere's what I've learned: Innovation isn't about having the best idea—it's about execution, persistence, and surrounding yourself with the right team.\n\nWhat's the biggest lesson you've learned in your professional journey?",
      hashtags: ["#Leadership", "#Innovation", "#ProfessionalGrowth", "#Startup"],
    },
  ],
  twitter: [
    {
      content: "Just shipped something we've been working on for months 🚀\n\nIt's not perfect, but it's ours. And we're proud of it.\n\nThread on what we learned 🧵👇",
      hashtags: ["#BuildInPublic", "#StartupLife", "#Tech"],
    },
    {
      content: "Hot take: The best products aren't built in isolation.\n\nThey're built with users, for users.\n\nThat's exactly what we did. Here's the result:",
      hashtags: ["#ProductDev", "#UserFirst", "#Startup"],
    },
  ],
};

export function PostGenerator() {
  const [inputType, setInputType] = useState<"brief" | "url">("brief");
  const [input, setInput] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram"]);
  const [tone, setTone] = useState<Tone>("conversational");
  const [template, setTemplate] = useState<Template>("promo");
  const [isGenerating, setIsGenerating] = useState(false);
  const [captions, setCaptions] = useState<typeof mockCaptions | null>(null);
  const [selectedCaption, setSelectedCaption] = useState<number>(0);
  const [previewPlatform, setPreviewPlatform] = useState<Platform>("instagram");

  const handleGenerate = async () => {
    if (!input.trim() || platforms.length === 0) return;
    
    setIsGenerating(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setCaptions(mockCaptions);
    setPreviewPlatform(platforms[0]);
    setIsGenerating(false);
  };

  const currentCaptions = captions?.[previewPlatform] || [];

  return (
    <div className="flex gap-6 h-full">
      {/* Left Panel - Input */}
      <div className="flex-1 space-y-6">
        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6"
        >
          <h2 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            Create Your Post
          </h2>

          {/* Input Type Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputType("brief")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                inputType === "brief"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              )}
            >
              <FileText className="w-4 h-4" />
              Brief
            </button>
            <button
              onClick={() => setInputType("url")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                inputType === "url"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              )}
            >
              <Link2 className="w-4 h-4" />
              URL
            </button>
          </div>

          {/* Input Area */}
          <div className="relative mb-6">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                inputType === "brief"
                  ? "Describe your post idea, product launch, announcement, or key message..."
                  : "Paste a blog post, YouTube video, or landing page URL..."
              }
              className="w-full h-32 p-4 rounded-xl bg-secondary/30 border border-border/50 text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 input-glow transition-all"
            />
            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
              {input.length}/500
            </div>
          </div>

          {/* Platform Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Platforms</h3>
            <PlatformSelector selected={platforms} onChange={setPlatforms} />
          </div>

          {/* Tone Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Tone</h3>
            <ToneSelector selected={tone} onChange={setTone} />
          </div>

          {/* Template Selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Template</h3>
            <TemplateSelector selected={template} onChange={setTemplate} />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !input.trim() || platforms.length === 0}
            variant="gradient"
            size="lg"
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating magic...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Captions
              </>
            )}
          </Button>
        </motion.div>

        {/* Generated Captions */}
        <AnimatePresence>
          {captions && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Platform Tabs */}
              <div className="flex gap-2">
                {platforms.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPreviewPlatform(p)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      previewPlatform === p
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>

              {/* Caption Cards */}
              <div className="space-y-4">
                {currentCaptions.map((caption, index) => (
                  <CaptionVariation
                    key={`${previewPlatform}-${index}`}
                    content={caption.content}
                    hashtags={caption.hashtags}
                    platform={previewPlatform}
                    index={index}
                    onSelect={() => setSelectedCaption(index)}
                    isSelected={selectedCaption === index}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Panel - Preview */}
      <div className="w-96 flex-shrink-0">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="sticky top-6"
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Live Preview</h3>
          <PostPreview
            content={currentCaptions[selectedCaption]?.content || ""}
            hashtags={currentCaptions[selectedCaption]?.hashtags || []}
            platform={previewPlatform}
          />

          {/* Quick Actions */}
          {captions && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 flex gap-2"
            >
              <Button variant="outline" className="flex-1">
                Schedule
              </Button>
              <Button variant="gradient" className="flex-1">
                Publish Now
              </Button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
