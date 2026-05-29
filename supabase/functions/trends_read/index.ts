// Edge Function: Read trends (public, paginated)
// GET /trends_read?page=1&limit=25&industry=marketing&platform=x&q=ai

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

export async function handler(req: Request) {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const limit = Math.min(Number(url.searchParams.get('limit') || '25'), 200);
  const industry = url.searchParams.get('industry') || undefined;
  const platform = url.searchParams.get('platform') || undefined;
  const q = url.searchParams.get('q') || undefined;

  if (!supabase) return new Response(JSON.stringify({ meta: { page, limit, total: 0 }, data: [] }), { status: 200 });

  let query = supabase.from('trending_topics').select('id,title,normalized_terms,industry,platform,score,signal_count,first_seen,last_seen,metadata').order('score', { ascending: false }).range((page-1)*limit, page*limit - 1);
  if (industry) query = query.eq('industry', industry);
  if (platform) query = query.eq('platform', platform);
  if (q) query = query.ilike('title', `%${q}%`);

  const { data, error, count } = await query;
  if (error) return new Response(JSON.stringify({ meta: { page, limit, total: 0 }, data: [] }), { status: 200 });

  const meta = { page, limit, total: count || (data || []).length };
  return new Response(JSON.stringify({ meta, data }), { status: 200 });
}
