// Client helper to call the Trends read API (Edge Function)
export type TrendItem = {
  id: string;
  title: string;
  normalized_terms: string[];
  industry?: string;
  platform?: string;
  score?: number;
  signal_count?: number;
  first_seen?: string;
  last_seen?: string;
  metadata?: Record<string, unknown>;
};

const DEFAULT_ENDPOINT = '/.netlify/functions/trends_read'; // placeholder; update per deployment

export async function getTrends(opts?: { industry?: string; platform?: string; q?: string; page?: number; limit?: number; endpoint?: string }) {
  const endpoint = opts?.endpoint || DEFAULT_ENDPOINT;
  const params = new URLSearchParams();
  if (opts?.industry) params.set('industry', opts.industry);
  if (opts?.platform) params.set('platform', opts.platform);
  if (opts?.q) params.set('q', opts.q);
  params.set('page', String(opts?.page || 1));
  params.set('limit', String(opts?.limit || 25));

  const res = await fetch(`${endpoint}?${params.toString()}`);
  if (!res.ok) throw new Error(`Trends API error: ${res.status}`);
  const body = await res.json();
  return body as { meta: { page:number; limit:number; total:number }; data: TrendItem[] };
}
