// Edge Function: Ingest a single event (internal)
// POST /trends_ingest

// Example payload:
// { source, source_id, title, normalized_terms, industry, platform, metadata, raw_payload, timestamp }

import { createClient } from '@supabase/supabase-js';
import { computeDedupeHash } from '../../../src/lib/normalize';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

export async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.json().catch(() => null);
  if (!body || !body.source || !body.title) {
    return new Response(JSON.stringify({ ok: false, error: 'missing fields' }), { status: 400 });
  }

  // Basic auth check: expect x-service-key header matching service role (opt-in)
  const svc = req.headers.get('x-service-key');
  if (SUPABASE_SERVICE_KEY && svc !== SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  }

  const normalized_terms = body.normalized_terms || [];
  const dedupe_hash = computeDedupeHash((body.title || '').toLowerCase(), normalized_terms.map(String));
  const now = new Date().toISOString();

  const row = {
    dedupe_hash,
    source: body.source,
    source_id: body.source_id || null,
    title: body.title,
    normalized_terms,
    industry: body.industry || null,
    platform: body.platform || null,
    metadata: body.metadata || {},
    raw_payload: body.raw_payload || {},
    first_seen: body.timestamp || now,
    last_seen: body.timestamp || now,
    signal_count: body.signal_count || 1,
    processed: true,
    updated_at: now,
  };

  if (!supabase) return new Response(JSON.stringify({ ok: false, error: 'supabase not configured' }), { status: 500 });

  const { data, error } = await supabase.from('trending_topics').upsert(row, { onConflict: 'dedupe_hash' }).select().single();
  if (error) {
    console.error('ingest upsert error', error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, id: data.id, upserted: true }), { status: 200 });
}
