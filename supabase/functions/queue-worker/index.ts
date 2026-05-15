// Queue worker: enqueues jobs into Supabase `job_queue` table and can also
// process the next pending job when invoked in worker mode.
// Expects env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

type QueueJob = {
  job_type: string;
  payload?: Record<string, unknown>;
  status?: string;
  attempts?: number;
  max_attempts?: number;
  next_attempt_at?: string;
};

async function getSupabaseConfig() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing supabase env vars");
  return { SUPABASE_URL, SUPABASE_KEY };
}

async function insertJobToSupabase(job: QueueJob) {
  const { SUPABASE_URL, SUPABASE_KEY } = await getSupabaseConfig();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/job_queue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(job),
  });
  if (!res.ok) throw new Error(`Supabase insert failed: ${res.status}`);
  return res.json();
}

async function claimNextJob(): Promise<(QueueJob & { id: string; lock_token: string }) | null> {
  const { SUPABASE_URL, SUPABASE_KEY } = await getSupabaseConfig();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/claim_next_job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=representation",
    },
    body: "{}",
  });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return rows?.[0] || null;
}

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  const { SUPABASE_URL, SUPABASE_KEY } = await getSupabaseConfig();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/job_queue?id=eq.${jobId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`job update failed: ${res.status}`);
  return res.json();
}

async function processJob(job: QueueJob & { id: string; lock_token?: string }) {
  const { SUPABASE_URL, SUPABASE_KEY } = await getSupabaseConfig();
  try {
    if (job.job_type === "publish_scheduled_post") {
      const scheduledPostId = String(job.payload?.scheduled_post_id || "");
      if (!scheduledPostId) throw new Error("Missing scheduled_post_id");
      const res = await fetch(`${SUPABASE_URL}/rest/v1/scheduled_posts?id=eq.${scheduledPostId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          workflow_status: "published",
          status: "published",
          published_at: new Date().toISOString(),
          failure_reason: null,
        }),
      });
      if (!res.ok) throw new Error(`failed publishing scheduled post: ${res.status}`);
    } else if (job.job_type === "send_webhook") {
      const url = String(job.payload?.url || "");
      if (!url) throw new Error("Missing webhook url");
      const res = await fetch(url, {
        method: String(job.payload?.method || "POST"),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job.payload?.body || {}),
      });
      if (!res.ok) throw new Error(`webhook failed: ${res.status}`);
    } else {
      throw new Error(`Unknown job type: ${job.job_type}`);
    }

    await updateJob(job.id, { status: "completed", locked_at: null, lock_token: null, updated_at: new Date().toISOString() });
    return { ok: true };
  } catch (error) {
    const attempts = Number(job.attempts || 0) + 1;
    const maxAttempts = Number(job.max_attempts || 5);
    const failed = attempts >= maxAttempts;
    const backoffMs = Math.min(60_000, 500 * Math.pow(2, attempts - 1));
    await updateJob(job.id, {
      attempts,
      status: failed ? "failed" : "pending",
      next_attempt_at: failed ? new Date().toISOString() : new Date(Date.now() + backoffMs).toISOString(),
      last_error: String(error),
      locked_at: null,
      lock_token: null,
      updated_at: new Date().toISOString(),
    });
    return { ok: false, error: String(error) };
  }
}

export async function handle(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode || (req.method === "POST" && body?.job ? "enqueue" : "process");

    if (mode === "enqueue") {
      const job = body?.job || body;
      if (!job?.job_type) return new Response(JSON.stringify({ ok: false, error: "no job_type" }), { status: 400 });
      const inserted = await insertJobToSupabase(job);
      return new Response(JSON.stringify({ ok: true, inserted }), { status: 200 });
    }

    const claimed = body?.jobId ? null : await claimNextJob();
    if (!claimed) return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 });
    const processed = await processJob(claimed);
    return new Response(JSON.stringify({ ok: true, processed: 1, result: processed }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
}
