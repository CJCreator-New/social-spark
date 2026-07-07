// Adapter stub for News sources (RSS / API)
import { normalizeText, tokenize } from "../../../src/lib/normalize";
import { fetchWithRetry, sleep } from "../../../src/lib/http";

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

const NEWS_KEY = process.env.NEWSAPI_KEY;

export async function fetchLatest(
  params: { sources?: string[]; since?: string; maxItems?: number } = {}
) {
  if (!NEWS_KEY) return [];
  const sources = params.sources || ["technology"];
  const maxItems = params.maxItems || 200;
  const q = encodeURIComponent(sources.join(" OR "));
  const items: TrendSourceItem[] = [];
  let page = 1;
  try {
    while (items.length < maxItems && page < 6) {
      // NewsAPI limits pages
      const url = `https://newsapi.org/v2/everything?q=${q}&pageSize=50&page=${page}&apiKey=${NEWS_KEY}`;
      const res = await fetchWithRetry(url, { timeoutMs: 10000 }, 4);
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500) break;
        await sleep(500);
        page += 1;
        continue;
      }
      const body = await res.json();
      const articles = body?.articles || [];
      for (const a of articles) {
        const title = a.title || a.description || "";
        const normalized = normalizeText(title);
        items.push({
          source: "newsapi",
          source_id: a.url,
          title,
          normalized_terms: tokenize(normalized),
          industry: null,
          platform: "news",
          metadata: { source: a.source?.name } as Record<string, unknown>,
          raw_payload: a,
          timestamp: a.publishedAt,
        });
        if (items.length >= maxItems) break;
      }
      if (articles.length === 0) break;
      page += 1;
      await sleep(300 + Math.random() * 200);
    }
    return items;
  } catch (err) {
    console.error("news adapter error", err);
    return items;
  }
}
