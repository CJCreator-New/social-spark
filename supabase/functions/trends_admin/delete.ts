import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

export async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.json().catch(() => null);
  if (!body || !body.id) return new Response(JSON.stringify({ ok: false, error: 'missing id' }), { status: 400 });

  const svc = req.headers.get('x-service-key');
  if (!SUPABASE_SERVICE_KEY || svc !== SUPABASE_SERVICE_KEY) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });

  if (!supabase) return new Response(JSON.stringify({ ok: false, error: 'supabase not configured' }), { status: 500 });

  const { error } = await supabase.from('trending_topics').delete().eq('id', body.id);
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
