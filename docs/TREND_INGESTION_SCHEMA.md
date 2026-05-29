# Trending Topics: DB Schema & API Contract

Summary
- Lightweight, Supabase-backed trends table to store normalized trending topics from multiple sources (Reddit, X, news, etc.).
- Includes deduplication, scoring, signal counts, and metadata. Read API is paginated and filterable by industry and platform.

Schema (recommended)
- id: uuid PK
- source: text — source system (e.g., reddit, x, news)
- source_id: text — original source identifier (optional)
- title: text — human-friendly topic/title
- normalized_terms: text[] — tokenized/normalized keywords for dedupe & search
- industry: text — optional industry/tag
- platform: text — optional platform tag (facebook, instagram, x, linkedin)
- score: numeric — aggregated relevance score (higher = more trending)
- signal_count: int — number of signals seen across adapters
- first_seen: timestamptz
- last_seen: timestamptz
- metadata: jsonb — arbitrary source-specific metadata
- dedupe_hash: text — computed hash used for deduplication
- raw_payload: jsonb — raw adapter payload
- confidence: numeric — optional confidence metric
- processed: boolean — ingestion pipeline flag
- inserted_at / updated_at: timestamps

Indexes & constraints
- UNIQUE(source, source_id) where source_id is present — avoid duplicate source rows.
- INDEX on (industry, platform, score DESC) — for fast reads by filters and top-k.
- INDEX on dedupe_hash — for dedupe/upsert fast-path.

Dedupe strategy
- Compute `dedupe_hash` by normalizing `title` and `normalized_terms` (lowercase, remove punctuation, stem/strip stopwords) and hashing the canonical form (e.g., SHA256).
- Upsert by `dedupe_hash` (or `source+source_id` when available): merge signals, max(updated_at), increment `signal_count`, recompute `score`.

Scoring
- Score is a weighted aggregate (example):
  - recency: exponential decay on `last_seen`
  - signal_count: log(signal_count + 1)
  - source weight: source-specific multiplier (e.g., X posts > Reddit threads)
- Implement scoring in the queue worker; store final `score` for fast sorting.

Retention & lifecycle
- Keep raw_payload for a configurable window (e.g., 90 days) and periodically compact older rows (aggregate signals / drop raw_payload).
- Provide admin job to downsample low-confidence/low-score rows.

API Contract (Read)

GET /api/trends
- Query params:
  - `industry` (optional)
  - `platform` (optional)
  - `q` (optional) free-text search across `title` and `normalized_terms`
  - `since` (optional) ISO timestamp to limit recency
  - `page` (int, default 1)
  - `limit` (int, default 25, max 200)
  - `sort` (optional: `score`, `last_seen`)

Response (200):
{
  "meta": { "page": 1, "limit": 25, "total": 123 },
  "data": [
    {
      "id": "uuid",
      "title": "Generative AI tools",
      "normalized_terms": ["generative ai","gpt","ai tools"],
      "industry": "marketing",
      "platform": "x",
      "score": 12.34,
      "signal_count": 42,
      "first_seen": "2026-05-29T00:00:00Z",
      "last_seen": "2026-05-29T10:00:00Z",
      "metadata": { }
    }
  ]
}

API Contract (Ingest — internal/protected)

POST /api/trends/ingest
- Auth: service key or scoped `trend_ingest` role (Edge function uses service role)
- Body (JSON):
  - `source` (string)
  - `source_id` (string | null)
  - `title` (string)
  - `normalized_terms` (string[])
  - `industry` (string | null)
  - `platform` (string | null)
  - `metadata` (object | null)
  - `raw_payload` (object | null)
  - `timestamp` (ISO string) — event time

Response (200): { "ok": true, "id": "uuid", "upserted": true }

GET /api/trends/{id}
- Public read of a single trend item. Returns full fields.

Permissions
- Ingest endpoints require a service role or signed Edge Function token.
- Read endpoints can be public (anonymous) but should be rate-limited. Consider returning top N aggregated trends for unauthenticated clients.

Operational notes
- Use a scheduled queue worker (Edge Function or background job) to run adapters, compute dedupe_hash, upsert with merge logic, and recompute scores.
- Adapters should normalize terms consistently (same normalization library used by the queue worker and by the frontend's trending helper).
- Expose an admin endpoint to trigger manual re-scores and compacting.

Next steps
- Add SQL migration (migrations/0001_create_trending_topics_table.sql) and implement the queue worker/Edge Function adapters.
