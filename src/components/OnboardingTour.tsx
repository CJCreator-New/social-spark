import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Compass, Volume2, CalendarDays, Palette, ChevronRight } from "lucide-react";

import { APP_NAME } from "@/constants/branding";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OnboardingTourProps {
  onClose: () => void;
}

const STEPS = [
  {
    title: `Welcome to ${APP_NAME}`,
    description: `${APP_NAME} is an AI-powered workspace that designs, writes, and schedules content calendars tailored to your industry, voice, and goals.`,
    icon: Sparkles,
  },
  {
    title: "1. Define niche and core idea",
    description:
      "Select your industry niche and type in your core idea. This is the starting point for all content, guiding the AI toward what your audience cares about.",
    icon: Compass,
  },
  {
    title: "2. Tailor your voice and brand",
    description:
      "Expand 'Tailor Voice & Brand Settings' to configure target language, audience segments, tone of voice, copy style, quality tier, and custom rules (banned/required words).",
    icon: Volume2,
  },
  {
    title: "3. Set up your brand",
    description:
      "Save your brand details once on your Profile so every calendar starts from your voice, audience and rules.",
    icon: Palette,
  },
  {
    title: "4. Choose topics and generate",
    description:
      "Pick from the suggested topics or add your own, then click 'Generate' to see your posts mapped out day by day. Review and refine them before you use them.",
    icon: CalendarDays,
  },
];

const BRAND_STEP = 4;

export function OnboardingTour({ onClose }: OnboardingTourProps) {
  const [step, setStep] = useState(1);
  const current = STEPS[step - 1];
  const IconComponent = current.icon;
  const isLast = step === STEPS.length;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent border border-border flex items-center justify-center text-primary">
            <IconComponent size={28} aria-hidden="true" />
          </div>
          <p className="text-xs text-muted-foreground">
            Step {step} of {STEPS.length}
          </p>
          <DialogTitle className="font-display text-2xl font-normal leading-tight">
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {current.description}
          </DialogDescription>
        </DialogHeader>

        {step === BRAND_STEP && (
          <div className="text-center">
            <Link
              to="/profile?tab=brand"
              onClick={onClose}
              className="text-sm font-semibold text-primary underline"
            >
              Open brand settings
            </Link>
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-border pt-4 sm:space-x-0">
          {step > 1 && (
            <Button type="button" variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button type="button" onClick={() => (isLast ? onClose() : setStep(step + 1))}>
            {isLast ? "Got it, let's start" : "Next"}
            {!isLast && <ChevronRight size={14} aria-hidden="true" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
