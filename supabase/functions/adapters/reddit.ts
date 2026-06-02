// Adapter stub for Reddit (Edge Function / Queue Worker usage)
import { normalizeText, tokenize } from '../../../src/lib/normalize';
import { fetchWithRetry, sleep } from '../../../src/lib/http';

export type TrendSourceItem = {
  source: string;
  source_id: string | null;
  title: string;
  normalized_terms: string[];
  industry: string | null;
  platform: string | null;
  metadata: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
  timestamp: string | null;
  signal_count?: number;
  last_seen?: string | null;
};

export async function fetchLatest(params: { subreddit?: string; since?: string; maxItems?: number } = {}) {
  const subreddit = params.subreddit || 'all';
  const maxItems = params.maxItems || 200;
  const items: TrendSourceItem[] = [];
  let after: string | null = null;
  let attempts = 0;
  try {
    while (items.length < maxItems && attempts < 10) {
      attempts += 1;
      const qs = new URLSearchParams({ limit: '100' });
      if (after) qs.set('after', after);
      const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/hot.json?${qs.toString()}`;
      const res = await fetchWithRetry(url, { headers: { 'User-Agent': 'social-spark/1.0 (+https://example.com)' }, timeoutMs: 10000 }, 4);
      if (!res.ok) {
        // stop on client errors
        if (res.status >= 400 && res.status < 500) break;
        await sleep(500);
        continue;
      }
      const body = await res.json();
      const children = body?.data?.children || [];
      for (const c of children) {
        const post = c.data;
        const title = post.title || post.link_title || '';
        const normalized = normalizeText(title);
        items.push({
          source: 'reddit',
          source_id: post.id,
          title,
          normalized_terms: tokenize(normalized),
          industry: null,
          platform: 'reddit',
          metadata: { subreddit: post.subreddit, score: post.score } as Record<string, unknown>,
          raw_payload: post,
          timestamp: new Date((post.created_utc || Date.now()/1000) * 1000).toISOString(),
        });
        if (items.length >= maxItems) break;
      }
      after = body?.data?.after || null;
      if (!after) break;
      // polite delay between pages
      await sleep(200 + Math.random() * 200);
    }
    return items;
  } catch (err) {
    console.error('reddit adapter error', err);
    return items;
  }
}
