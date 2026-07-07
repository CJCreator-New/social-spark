// Server-side orphan media cleanup.
// Verifies that a media reference is not used by profiles or calendars before deleting storage.
import { verifyCronSecret, sanitizeLogValue } from "../_shared/promptHelpers.ts";

type MediaReference = {
  id: string;
  bucket: string;
  storage_path: string;
  public_url: string;
  user_id: string | null;
};

async function getSupabaseConfig() {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing supabase env vars");
  return { SUPABASE_URL, SUPABASE_KEY };
}

async function fetchOrphans(maxAgeHours = 24): Promise<MediaReference[]> {
  const { SUPABASE_URL, SUPABASE_KEY } = await getSupabaseConfig();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/media_references?deleted_at=is.null&orphaned_at=lt.${new Date(Date.now() - maxAgeHours * 3600 * 1000).toISOString()}&order=updated_at.asc`,
    {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    }
  );
  if (!res.ok) throw new Error(`Failed to load orphan candidates: ${res.status}`);
  return res.json();
}

async function hasDbReferences(publicUrl: string) {
  const { SUPABASE_URL, SUPABASE_KEY } = await getSupabaseConfig();
  const [profileRes, refRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?avatar_url=eq.${encodeURIComponent(publicUrl)}&select=id`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/media_references?public_url=eq.${encodeURIComponent(publicUrl)}&deleted_at=is.null&reference_count=gt.0&select=id`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      }
    ),
  ]);
  if (!profileRes.ok || !refRes.ok) return true;
  const profiles = await profileRes.json().catch(() => []);
  const refs = await refRes.json().catch(() => []);
  return (profiles?.length || 0) > 0 || (refs?.length || 0) > 0;
}

async function deleteStorageObject(bucket: string, storagePath: string) {
  const { SUPABASE_URL, SUPABASE_KEY } = await getSupabaseConfig();
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${encodedPath}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Storage delete failed: ${res.status}`);
}

async function markDeleted(id: string) {
  const { SUPABASE_URL, SUPABASE_KEY } = await getSupabaseConfig();
  await fetch(`${SUPABASE_URL}/rest/v1/media_references?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function handle(req: Request) {
  try {
    if (req.method !== "POST") return new Response(null, { status: 405 });

    if (!verifyCronSecret(req)) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const maxAgeHours = Number(body?.maxAgeHours || 24);
    const candidates = await fetchOrphans(maxAgeHours);
    const deleted: MediaReference[] = [];

    for (const ref of candidates) {
      if (await hasDbReferences(ref.public_url)) continue;
      await deleteStorageObject(ref.bucket, ref.storage_path);
      await markDeleted(ref.id);
      deleted.push(ref);
    }

    return new Response(JSON.stringify({ ok: true, deletedCount: deleted.length, deleted }), {
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: sanitizeLogValue(e) }), { status: 500 });
  }
}
