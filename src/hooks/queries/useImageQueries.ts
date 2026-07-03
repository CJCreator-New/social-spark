import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveFunctionsBaseUrl } from "@/lib/functionsBaseUrl";
import { isE2EMode, type GeneratePostImagePayload } from "./shared";

export function useGeneratePostImageMutation() {
  return useMutation({
    mutationFn: async (payload: GeneratePostImagePayload) => {
      if (isE2EMode()) {
        return {
          publicUrl: "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='1200'%20height='1200'%20viewBox='0%200%201200%201200'%3E%3Crect%20width='1200'%20height='1200'%20fill='%2307080d'/%3E%3Crect%20x='80'%20y='80'%20width='1040'%20height='1040'%20rx='48'%20fill='%23181a26'/%3E%3Ctext%20x='600'%20y='580'%20fill='%23c8f09a'%20font-family='Arial'%20font-size='48'%20text-anchor='middle'%3EGenerated%20visual%3C/text%3E%3Ctext%20x='600'%20y='650'%20fill='%23edeae3'%20font-family='Arial'%20font-size='28'%20text-anchor='middle'%3EE2E%20placeholder%3C/text%3E%3C/svg%3E",
          storagePath: `e2e/${payload.calendarId}/${payload.postDay}.svg`,
          aspectRatio: payload.aspectRatio || "1:1",
          prompt: payload.prompt,
        };
      }
      const SUPABASE_URL = resolveFunctionsBaseUrl((import.meta.env.VITE_SUPABASE_URL as string) || "");
      const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || "";
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-post-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error || `Image generation failed (${res.status})`);
      return data;
    },
  });
}
