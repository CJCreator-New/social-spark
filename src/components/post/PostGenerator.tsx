import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Link2, FileText, Wand2, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformSelector, Platform } from "./PlatformSelector";
import { ToneSelector, Tone } from "./ToneSelector";
import { TemplateSelector, Template } from "./TemplateSelector";
import { CaptionVariation } from "./CaptionVariation";
import { PostPreview } from "./PostPreview";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type CaptionData = { content: string; hashtags: string[] };
type CaptionsResult = Record<Platform, CaptionData[]>;

// Check if Supabase env vars are available
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export function PostGenerator() {
  const [inputType, setInputType] = useState<"brief" | "url">("brief");
  const [input, setInput] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>(["instagram"]);
  const [tone, setTone] = useState<Tone>("conversational");
  const [template, setTemplate] = useState<Template>("promo");
  const [isGenerating, setIsGenerating] = useState(false);
  const [captions, setCaptions] = useState<CaptionsResult | null>(null);
  const [selectedCaption, setSelectedCaption] = useState<number>(0);
  const [previewPlatform, setPreviewPlatform] = useState<Platform>("instagram");
  const [backendReady, setBackendReady] = useState(isSupabaseConfigured);
  const { toast } = useToast();

  // Check backend availability on mount
  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.log("Waiting for backend configuration...");
      // Check again after a delay
      const timer = setTimeout(() => {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (url && key) {
          setBackendReady(true);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleGenerate = async () => {
    if (!input.trim() || platforms.length === 0) {
      toast({
        title: "Missing information",
        description: "Please enter a brief and select at least one platform.",
        variant: "destructive",
      });
      return;
    }

    if (!backendReady) {
      toast({
        title: "Backend initializing",
        description: "Please wait a moment and try again, or refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    setCaptions(null);
    
    try {
      // Dynamic import of supabase client to avoid initialization errors
      const { supabase } = await import("@/integrations/supabase/client");
      
      const { data, error } = await supabase.functions.invoke('generate-captions', {
        body: {
          brief: input,
          platforms,
          tone,
          template,
          variationsPerPlatform: 3,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to generate captions");
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.captions) {
        setCaptions(data.captions as CaptionsResult);
        setPreviewPlatform(platforms[0]);
        setSelectedCaption(0);
        toast({
          title: "Captions generated!",
          description: `Created ${platforms.length * 3} unique variations across ${platforms.length} platform${platforms.length > 1 ? 's' : ''}.`,
        });
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const currentCaptions = captions?.[previewPlatform] || [];

  return (
    <div className="flex gap-6 h-full">
      {/* Left Panel - Input */}
      <div className="flex-1 space-y-6">
        {/* Backend Status Banner */}
        {!backendReady && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 border-l-4 border-primary/50"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
              <div>
                <p className="text-sm font-medium">Backend initializing...</p>
                <p className="text-xs text-muted-foreground">Please refresh the page if this persists.</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => window.location.reload()}
                className="ml-auto"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            </div>
          </motion.div>
        )}

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
                    onClick={() => {
                      setPreviewPlatform(p);
                      setSelectedCaption(0);
                    }}
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
                {currentCaptions.length > 0 ? (
                  currentCaptions.map((caption, index) => (
                    <CaptionVariation
                      key={`${previewPlatform}-${index}`}
                      content={caption.content}
                      hashtags={caption.hashtags}
                      platform={previewPlatform}
                      index={index}
                      onSelect={() => setSelectedCaption(index)}
                      isSelected={selectedCaption === index}
                    />
                  ))
                ) : (
                  <div className="glass-card p-6 text-center">
                    <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No captions generated for this platform yet.</p>
                  </div>
                )}
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
          {captions && currentCaptions.length > 0 && (
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
