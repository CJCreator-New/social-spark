import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWizardStore } from "@/stores/useWizardStore";
import { isE2EMode, type GeneratedPostPayload, type GeneratedResponse, type InlineRewritePayload, type RepurposePayload } from "./shared";

export function useRegeneratePostMutation(calendarId?: string) {
  const qc = useQueryClient();
  const setKeySource = useWizardStore((state) => state.setKeySource);
  const setKeyMode = useWizardStore((state) => state.setKeyMode);

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (isE2EMode()) {
        // Return a deterministic regenerated post in E2E mode
        const incoming = payload?.post as { title?: string; body?: string; hook?: string; cta?: string; hashtags?: string; topic?: string } | undefined;
        const voice = (payload.voice as string) || "alternate";
        const post = incoming
          ? {
              ...incoming,
              title: `${incoming.title || 'E2E Title'} (${voice})`,
              hook: `${incoming.hook || 'E2E hook'} (${voice})`,
              body: `${incoming.body || 'E2E body'} (${voice})`,
              cta: `${incoming.cta || 'E2E cta'} (${voice})`
            }
          : { id: `e2e-reg-${Date.now()}`, day: 1, title: `E2E regenerated (${voice})`, hook: `E2E hook (${voice})`, body: `E2E regenerated body (${voice})`, cta: `No CTA (${voice})` };
        return post;
      }


      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback("regenerate-post", payload);
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);
      return (data as GeneratedResponse<GeneratedPostPayload>).post;
    },
    onSuccess: () => {
      if (calendarId) qc.invalidateQueries({ queryKey: ["calendar", calendarId] });
    },
  });
}

export function useRepurposePostMutation() {
  const setKeySource = useWizardStore((state) => state.setKeySource);
  const setKeyMode = useWizardStore((state) => state.setKeyMode);
  return useMutation({
    mutationFn: async (payload: RepurposePayload) => {
      if (isE2EMode()) {
        const post = payload.post || {};
        const target = payload.targetPlatform || "LinkedIn";
        return {
          ...post,
          format: target === "Instagram" ? "Instagram carousel script" : `${target} version`,
          title: `${post.title || post.topic || "Repurposed post"} (${target})`,
          body: `[${target}] ${post.body || post.hook || "Repurposed body"}`,
          cta: post.cta || "Save this for later.",
        };
      }
      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback("repurpose-post", payload);
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);
      return (data as GeneratedResponse<GeneratedPostPayload>).post;
    },
  });
}

export function useInlineRewriteMutation() {
  const setKeySource = useWizardStore((state) => state.setKeySource);
  const setKeyMode = useWizardStore((state) => state.setKeyMode);
  return useMutation({
    mutationFn: async (payload: InlineRewritePayload) => {
      if (isE2EMode()) {
        return `${payload.text.trim()} (${payload.instruction})`;
      }
      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback("inline-rewrite", payload);
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);
      return String((data as GeneratedResponse<never>).rewrittenText || "");
    },
  });
}

export function useGenerateTrendsMutation() {
  const setKeySource = useWizardStore((state) => state.setKeySource);
  const setKeyMode = useWizardStore((state) => state.setKeyMode);
  return useMutation({
    mutationFn: async (payload: { industry: string; platform: string }) => {
      if (isE2EMode()) {
        return [
          { topic: `${payload.industry} AI Agents`, category: "AI & ML", trending: true, posts: 1200 },
          { topic: `${payload.industry} Future trends`, category: "Strategy", trending: true, posts: 950 },
          { topic: `${payload.industry} Optimization`, category: "Operations", trending: false, posts: 640 },
          { topic: `${payload.platform} Growth hacks`, category: "Marketing", trending: true, posts: 1100 },
          { topic: `${payload.platform} Engagement tips`, category: "Community", trending: true, posts: 870 },
          { topic: `Sustainable ${payload.industry}`, category: "Sustainability", trending: false, posts: 540 }
        ];
      }
      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback<{ trends: any[] }>("generate-trends", payload);
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);
      return data.trends || [];
    },
  });
}

