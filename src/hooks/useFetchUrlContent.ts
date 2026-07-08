import { useState } from 'react';

export interface UrlFetchResult {
  text: string;
  title: string;
  wordCount: number;
}

export function useFetchUrlContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchUrl(url: string): Promise<UrlFetchResult | null> {
    setLoading(true);
    setError(null);
    try {
      // Use direct fetch since this doesn't need AI key fallback
      const { resolveFunctionsBaseUrl } = await import('@/lib/functionsBaseUrl');
      const { supabase } = await import('@/integrations/supabase/client');
      const base = resolveFunctionsBaseUrl(import.meta.env.VITE_SUPABASE_URL || '');
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${base}/functions/v1/fetch-url-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: key,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data as UrlFetchResult;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch URL';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { fetchUrl, loading, error };
}
