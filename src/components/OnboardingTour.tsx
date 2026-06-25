import React, { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Compass, Volume2, CalendarDays, ChevronRight, X } from "lucide-react";

interface OnboardingTourProps {
  onSeeExample: () => void;
  onClose: () => void;
}

export function OnboardingTour({ onSeeExample, onClose }: OnboardingTourProps) {
  const [step, setStep] = useState(1);

  const steps = [
    {
      title: "Welcome to Social Spark ✨",
      description: "Social Spark is an AI-powered workspace that designs, writes, and schedules high-performance content calendars tailored to your specific industry, voice, and goals.",
      icon: Sparkles,
    },
    {
      title: "1. Define Niche & Core Idea 🎯",
      description: "Select your industry niche and type in your core idea. This serves as the north star for all content, guiding the AI to output exactly what your audience cares about.",
      icon: Compass,
    },
    {
      title: "2. Tailor Your Voice & Brand 🗣️",
      description: "Expand 'Tailor Voice & Brand Settings' to configure target language, audience segments, tone of voice, copy style, quality tier, and custom rules (banned/required words).",
      icon: Volume2,
    },
    {
      title: "3. Choose Topics & Generate 🚀",
      description: "Pick from the suggested topics or add your own, then click 'Generate' to see your posts mapped out day-by-day. Review, refine, and export your week instantly!",
      icon: CalendarDays,
    },
  ];

  const current = steps[step - 1];
  const IconComponent = current.icon;

  const handleSeeExample = () => {
    localStorage.setItem("social_spark_onboarding_completed", "true");
    onSeeExample();
  };

  const handleFinish = () => {
    localStorage.setItem("social_spark_onboarding_completed", "true");
    onClose();
  };

  const handleNext = () => {
    if (step < steps.length) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", duration: 0.4, bounce: 0 }}
        className="w-full max-w-lg rounded-2xl border border-white/10 p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #10121d 0%, #080910 100%)",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Glow decoration */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[radial-gradient(circle_at_center,rgba(200,240,154,0.08)_0%,transparent_70%)] pointer-events-none" />

        {/* Close button */}
        <button
          type="button"
          onClick={handleFinish}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-white/5"
          aria-label="Skip tour"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center text-center mt-4">
          {/* Step Icon */}
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-[#c8f09a] mb-6 shadow-inner">
            <IconComponent size={28} />
          </div>

          {/* Stepper Dots */}
          <div className="flex gap-1.5 mb-4">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: idx + 1 === step ? 24 : 6,
                  background: idx + 1 === step ? "#c8f09a" : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>

          <h2 className="font-display text-2xl font-normal text-[#edeae3] leading-tight mb-3">
            {current.title}
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-sm mb-8">
            {current.description}
          </p>
        </div>

        {/* Actions Footer */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4 border-t border-white/5 pt-5">
          {step === 1 ? (
            <>
              <button
                type="button"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-[#07080d] bg-gradient-to-r from-[#c8f09a] to-[#a0e86b] hover:shadow-lg hover:shadow-[#c8f09a]/10 active:scale-[0.96] transition-all duration-200"
                onClick={handleSeeExample}
              >
                ✨ See Example Calendar
              </button>
              <button
                type="button"
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-300 border border-white/10 hover:bg-white/[0.02] active:scale-[0.96] transition-all duration-200"
                onClick={handleNext}
              >
                Start Setup Guide
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="w-full sm:w-1/3 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-400 border border-transparent hover:text-slate-200 active:scale-[0.96] transition-all duration-200"
                onClick={handleBack}
              >
                Back
              </button>
              <button
                type="button"
                className="w-full sm:w-2/3 py-2.5 px-4 rounded-xl text-xs font-semibold text-[#07080d] bg-gradient-to-r from-[#c8f09a] to-[#a0e86b] hover:shadow-lg hover:shadow-[#c8f09a]/10 active:scale-[0.96] transition-all duration-200 flex items-center justify-center gap-1.5"
                onClick={handleNext}
              >
                <span>{step === steps.length ? "Got it, let's start!" : "Next Step"}</span>
                {step < steps.length && <ChevronRight size={14} />}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
