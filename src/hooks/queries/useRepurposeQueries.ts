import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWizardStore } from "@/stores/useWizardStore";
import {
  isE2EMode,
  type ExtractedIdea,
  type ExtractIdeasPayload,
  type GeneratedPostPayload,
  type GeneratedResponse,
  type InlineRewritePayload,
  type RepurposePayload,
} from "./shared";

export function useRegeneratePostMutation(calendarId?: string) {
  const qc = useQueryClient();
  const setKeySource = useWizardStore((state) => state.setKeySource);
  const setKeyMode = useWizardStore((state) => state.setKeyMode);

  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (isE2EMode()) {
        // Return a deterministic regenerated post in E2E mode
        const incoming = payload?.post as
          | {
              title?: string;
              body?: string;
              hook?: string;
              cta?: string;
              hashtags?: string;
              topic?: string;
            }
          | undefined;
        const voice = (payload.voice as string) || "alternate";
        const post = incoming
          ? {
              ...incoming,
              title: `${incoming.title || "E2E Title"} (${voice})`,
              hook: `${incoming.hook || "E2E hook"} (${voice})`,
              body: `${incoming.body || "E2E body"} (${voice})`,
              cta: `${incoming.cta || "E2E cta"} (${voice})`,
            }
          : {
              id: `e2e-reg-${Date.now()}`,
              day: 1,
              title: `E2E regenerated (${voice})`,
              hook: `E2E hook (${voice})`,
              body: `E2E regenerated body (${voice})`,
              cta: `No CTA (${voice})`,
            };
        return post;
      }

      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback(
        "regenerate-post",
        payload
      );
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

export function useExtractIdeasMutation() {
  const setKeySource = useWizardStore((state) => state.setKeySource);
  const setKeyMode = useWizardStore((state) => state.setKeyMode);
  return useMutation({
    mutationFn: async (payload: ExtractIdeasPayload): Promise<ExtractedIdea[]> => {
      if (isE2EMode()) {
        return Array.from({ length: payload.count }).map((_, i) => ({
          title: `E2E idea ${i + 1}`,
          format: i % 2 === 0 ? "Contrarian take" : "How-to breakdown",
          rationale: `E2E rationale ${i + 1}`,
          key_points: `E2E key points ${i + 1} drawn from source.`,
        }));
      }
      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback<{
        ideas: ExtractedIdea[];
      }>("extract-ideas", payload);
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);
      return data.ideas || [];
    },
  });
}

const DOW_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function useGenerateFromIdeaMutation() {
  const setKeySource = useWizardStore((state) => state.setKeySource);
  const setKeyMode = useWizardStore((state) => state.setKeyMode);
  return useMutation({
    mutationFn: async ({
      idea,
      platform,
    }: {
      idea: ExtractedIdea;
      platform: string;
    }): Promise<GeneratedPostPayload> => {
      if (isE2EMode()) {
        return {
          topic: idea.title,
          format: idea.format,
          title: `${idea.title} (${platform})`,
          hook: `E2E hook for ${idea.title}`,
          body: `[${platform}] E2E post grounded in: ${idea.key_points}`,
          cta: "Save this for later.",
          hashtags: "#e2e",
        };
      }
      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback(
        "generate-single-post",
        {
          platform,
          topic: idea.title,
          format: idea.format,
          coreIdea: idea.key_points,
          dow: DOW_NAMES[new Date().getDay()],
          quality: "polished",
          extra: `This post repurposes existing source material. Ground the post ONLY in these facts (do not invent statistics, names, or claims): ${idea.key_points}. The strategic angle is: ${idea.title} (${idea.format}). ${idea.rationale}`,
        }
      );
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);
      return (data as GeneratedResponse<GeneratedPostPayload>).post || {};
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
          {
            topic: `${payload.industry} AI Agents`,
            category: "AI & ML",
            trending: true,
            posts: 1200,
          },
          {
            topic: `${payload.industry} Future trends`,
            category: "Strategy",
            trending: true,
            posts: 950,
          },
          {
            topic: `${payload.industry} Optimization`,
            category: "Operations",
            trending: false,
            posts: 640,
          },
          {
            topic: `${payload.platform} Growth hacks`,
            category: "Marketing",
            trending: true,
            posts: 1100,
          },
          {
            topic: `${payload.platform} Engagement tips`,
            category: "Community",
            trending: true,
            posts: 870,
          },
          {
            topic: `Sustainable ${payload.industry}`,
            category: "Sustainability",
            trending: false,
            posts: 540,
          },
        ];
      }
      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback<{ trends: any[] }>(
        "generate-trends",
        payload
      );
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);
      return data.trends || [];
    },
  });
}

export function useGenerateSinglePostMutation() {
  const setKeySource = useWizardStore((state) => state.setKeySource);
  const setKeyMode = useWizardStore((state) => state.setKeyMode);
  return useMutation({
    mutationFn: async (payload: {
      platform: string;
      topic: string;
      format: string;
      coreIdea: string;
      dow: string;
      day: number;
      quality?: "draft" | "polished";
      extra?: string;
    }): Promise<any> => {
      if (isE2EMode()) {
        return {
          day: payload.day,
          dow: payload.dow,
          topic: payload.topic,
          format: payload.format,
          title: `Draft post for ${payload.topic}`,
          hook: `E2E hook for ${payload.topic}`,
          body: `E2E body for ${payload.topic} on ${payload.platform}`,
          cta: `Learn more about ${payload.topic}`,
          hashtags: `#${payload.topic.toLowerCase().replace(/\s+/g, "")}`,
          rationale: "Generated matching the missing campaign theme.",
        };
      }
      const { generateWithFallback } = await import("@/lib/brandMemory");
      const { data, usedFallback, keyMode } = await generateWithFallback(
        "generate-single-post",
        payload
      );
      setKeySource(usedFallback ? "user" : "platform");
      setKeyMode(keyMode);
      return (data as GeneratedResponse<GeneratedPostPayload>).post || {};
    },
  });
}
