// Adapter stub for X (Twitter) — collect trending posts/hashtags
import { normalizeText, tokenize } from '../../../src/lib/normalize';
import { fetchWithRetry, sleep } from '../../../src/lib/http';

const BEARER = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;

export async function fetchLatest(params: { query?: string; since?: string; maxItems?: number } = {}) {
  if (!BEARER) return [];
  const maxItems = params.maxItems || 200;
  const items: any[] = [];
  let next_token: string | undefined = undefined;
  let attempts = 0;
  const qparam = params.query || 'trending OR #trending';
  try {
    while (items.length < maxItems && attempts < 10) {
      attempts += 1;
      const qs = new URLSearchParams({ query: qparam, max_results: '100' });
      if (next_token) qs.set('next_token', next_token);
      const url = `https://api.twitter.com/2/tweets/search/recent?${qs.toString()}&tweet.fields=created_at,public_metrics`;
      const res = await fetchWithRetry(url, { headers: { Authorization: `Bearer ${BEARER}` }, timeoutMs: 10000 }, 4);
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) break;
        await sleep(500);
        continue;
      }
      const body = await res.json();
      const data = body?.data || [];
      for (const t of data) {
        const text = t.text || '';
        const normalized = normalizeText(text);
        items.push({
          source: 'x',
          source_id: t.id,
          title: text.slice(0, 200),
          normalized_terms: tokenize(normalized),
          industry: null,
          platform: 'x',
          metadata: { public_metrics: t.public_metrics },
          raw_payload: t,
          timestamp: t.created_at,
        });
        if (items.length >= maxItems) break;
      }
      next_token = body?.meta?.next_token;
      if (!next_token) break;
      await sleep(300 + Math.random() * 200);
    }
    return items;
  } catch (err) {
    console.error('x adapter error', err);
    return items;
  }
}
