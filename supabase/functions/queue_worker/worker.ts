import { createClient } from '@supabase/supabase-js';
import { computeDedupeHash } from '../../../src/lib/normalize';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('Supabase credentials not found; worker will not run upserts');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

function computeScore(signal_count: number, last_seen: string | null, sourceWeight = 1) {
  const recency = last_seen ? Math.max(1, (Date.now() - new Date(last_seen).getTime()) / (1000 * 60 * 60)) : 24; // hours
  const decay = 1 / Math.log2(recency + 2);
  return Math.log(signal_count + 1) * sourceWeight * decay;
}

export async function upsertTopics(items: Array<any>) {
  if (!supabase) return { ok: false, reason: 'no supabase' };

  const upserts = [];
  for (const it of items) {
    const dedupe_hash = computeDedupeHash((it.title || '').toLowerCase(), (it.normalized_terms || []).map(String));
    const now = new Date().toISOString();
    const row = {
      dedupe_hash,
      source: it.source,
      source_id: it.source_id || null,
      title: it.title,
      normalized_terms: it.normalized_terms || [],
      industry: it.industry || null,
      platform: it.platform || null,
      metadata: it.metadata || {},
      raw_payload: it.raw_payload || {},
      first_seen: it.timestamp || now,
      last_seen: it.timestamp || now,
      signal_count: it.signal_count || 1,
      processed: true,
      updated_at: now,
    };

    // Attempt upsert by dedupe_hash
    const { data, error } = await supabase.from('trending_topics').upsert(row, { onConflict: 'dedupe_hash' }).select().single();
    if (error) {
      console.error('upsert error', error);
    } else if (data) {
      // Recompute score and update
      const score = computeScore(data.signal_count || 1, data.last_seen || row.last_seen, 1);
      await supabase.from('trending_topics').update({ score, updated_at: now }).eq('id', data.id);
      upserts.push(data.id);
    }
  }

  return { ok: true, upserts };
}
