// Queue worker: orchestrates adapters, deduping, scoring, and upserts
import { fetchLatest as fetchReddit } from '../adapters/reddit.ts';
import { fetchLatest as fetchX } from '../adapters/x.ts';
import { fetchLatest as fetchNews } from '../adapters/news.ts';
import { upsertTopics } from './worker.ts';
import { sleep, fetchWithRetry } from '../../../src/lib/http';
import { computeDedupeHash } from '../../../src/lib/normalize';
import { pushMetrics, summarizeCounts } from '../../../src/lib/metrics';
import { addBreadcrumb } from '../../../src/lib/monitoring';

type TrendItem = {
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

async function attemptAdapter<Args extends unknown[], T>(fn: (...args: Args) => Promise<T>, args: Args, maxAttempts = 3): Promise<T> {
  let attempt = 0;
  let lastError: unknown = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const res = await fn(...args);
      return res;
    } catch (err) {
      lastError = err;
      console.error('adapter attempt failed', { attempt, err });
      if (attempt >= maxAttempts) throw err;
      const wait = 200 * Math.pow(2, attempt) + Math.random() * 200;
      await sleep(wait);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('adapter failed');
}

function mergeItems(items: TrendItem[]) {
  const map = new Map<string, TrendItem & { dedupe_hash: string; signal_count: number }>();
  for (const it of items) {
    const hash = computeDedupeHash((it.title || '').toLowerCase(), (it.normalized_terms || []).map(String));
    if (!map.has(hash)) {
      map.set(hash, { ...it, dedupe_hash: hash, signal_count: it.signal_count || 1 });
    } else {
      const existing = map.get(hash);
      existing.signal_count = (existing.signal_count || 1) + (it.signal_count || 1);
      // update last_seen to newest
      const last = existing.last_seen || existing.timestamp || null;
      const cand = it.last_seen || it.timestamp || null;
      if (cand && (!last || new Date(cand) > new Date(last))) existing.last_seen = cand;
    }
  }
  return Array.from(map.values());
}

export async function handler() {
  const out: { adapters: Record<string, number>; total_raw: number; total_merged: number; upserts: number } = { adapters: {}, total_raw: 0, total_merged: 0, upserts: 0 };

  // Run adapters with retries in parallel
  const promises = [
    attemptAdapter(fetchReddit, [{ subreddit: 'all', maxItems: 200 }], 3).catch((e) => { console.error('reddit failed', e); return [] as TrendItem[] }),
    attemptAdapter(fetchX, [{ query: 'trending OR #trending', maxItems: 200 }], 3).catch((e) => { console.error('x failed', e); return [] as TrendItem[] }),
    attemptAdapter(fetchNews, [{ sources: ['technology','business'], maxItems: 200 }], 3).catch((e) => { console.error('news failed', e); return [] as TrendItem[] }),
  ];

  const [r, x, n] = await Promise.all(promises);
  out.adapters.reddit = (r || []).length;
  out.adapters.x = (x || []).length;
  out.adapters.news = (n || []).length;

  const raw = [...(r || []), ...(x || []), ...(n || [])];
  out.total_raw = raw.length;

  // Merge / dedupe
  const merged = mergeItems(raw);
  out.total_merged = merged.length;

  // Upsert in batches with retry
  const batchSize = 50;
  for (let i = 0; i < merged.length; i += batchSize) {
    const chunk = merged.slice(i, i + batchSize);
    let attempts = 0;
    while (attempts < 4) {
      attempts += 1;
      try {
        const res = await upsertTopics(chunk);
        if (res && res.ok) {
          out.upserts += (res.upserts || []).length;
          break;
        }
        throw new Error('upsert failed');
      } catch (err) {
        console.error('upsert chunk failed', { attempt: attempts, err });
        addBreadcrumb('upsert_chunk_failed', { attempt: attempts, err: String(err) });
        if (attempts >= 4) {
          console.error('upsert chunk permanently failed, skipping chunk');
          addBreadcrumb('upsert_chunk_permanent_fail', { chunkSize: chunk.length });
          break;
        }
        const wait = 500 * Math.pow(2, attempts) + Math.random() * 300;
        await sleep(wait);
      }
    }
  }

  // Emit metrics and breadcrumbs
  try {
    const flat = summarizeCounts(out);
    await pushMetrics('trends_ingest_summary', flat);
    addBreadcrumb('ingest_summary', flat);
  } catch (err) {
    console.error('metrics push failed', err);
    addBreadcrumb('metrics_push_failed', { err: String(err) });
  }

  return out;
}
