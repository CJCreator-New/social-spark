import {
  corsHeaders,
  jsonResponse,
  checkRateLimit,
} from "../_shared/promptHelpers.ts";

type ImageRequest = {
  calendarId?: string;
  postDay?: number;
  prompt?: string;
  platform?: string;
  aspectRatio?: string;
  post?: {
    title?: string;
    hook?: string;
    body?: string;
    image_prompt?: string;
  };
};

function sizeForAspectRatio(aspectRatio: string): string {
  switch (aspectRatio) {
    case "1.91:1":
      return "1536x804";
    case "16:9":
      return "1536x864";
    case "4:5":
      return "1024x1280";
    case "1:1":
    default:
      return "1024x1024";
  }
}

async function getUserId(req: Request, supabaseUrl: string, apiKey: string): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      authorization: authHeader,
      apikey: apiKey,
    },
  });

  if (!res.ok) return null;
  const user = await res.json().catch(() => null);
  return typeof user?.id === "string" ? user.id : null;
}

function bytesFromBase64(input: string): { bytes: Uint8Array; contentType: string } {
  const match = input.match(/^data:([^;]+);base64,(.+)$/);
  const contentType = match?.[1] || "image/png";
  const base64 = match?.[2] || input;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, contentType };
}

async function uploadToStorage(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  path: string;
  bytes: Uint8Array;
  contentType: string;
}) {
  const uploadUrl = `${params.supabaseUrl}/storage/v1/object/${params.bucket}/${encodeURI(params.path)}`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.serviceRoleKey}`,
      apikey: params.serviceRoleKey,
      "content-type": params.contentType,
      "x-upsert": "true",
    },
    body: params.bytes,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Storage upload failed (${res.status}) ${text}`.trim());
  }
}

async function upsertMediaReference(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  bucket: string;
  storagePath: string;
  publicUrl: string;
  referenceKey: string;
}) {
  const res = await fetch(`${params.supabaseUrl}/rest/v1/media_references?on_conflict=bucket,storage_path`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${params.serviceRoleKey}`,
      apikey: params.serviceRoleKey,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: params.userId,
      bucket: params.bucket,
      storage_path: params.storagePath,
      public_url: params.publicUrl,
      reference_kind: "calendar",
      reference_key: params.referenceKey,
      reference_count: 1,
      last_referenced_at: new Date().toISOString(),
      orphaned_at: null,
      deleted_at: null,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`media_references upsert failed (${res.status})`, text);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || SUPABASE_SERVICE_ROLE_KEY;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return jsonResponse({ error: "Storage is not configured." }, 500);
    }
    if (!LOVABLE_API_KEY) return jsonResponse({ error: "AI image generation is not configured." }, 500);

    const userId = await getUserId(req, SUPABASE_URL, SUPABASE_ANON_KEY);
    if (!userId) return jsonResponse({ error: "Sign in required." }, 401);

    const body = await req.json().catch(() => ({})) as ImageRequest;
    const calendarId = String(body.calendarId || "");
    const postDay = Number(body.postDay || 0);
    const prompt = String(body.prompt || body.post?.image_prompt || "").trim();
    const aspectRatio = String(body.aspectRatio || "1:1");
    const platform = String(body.platform || "LinkedIn");

    if (!calendarId || !postDay || !prompt) {
      return jsonResponse({ error: "Missing calendar, post day, or image prompt." }, 400);
    }

    const rateLimitCheck = await checkRateLimit(userId, "generate-post-image", {
      maxRequests: 8,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) return jsonResponse({ error: "Rate limit exceeded." }, 429);

    const finalPrompt = [
      prompt,
      `Platform: ${platform}. Aspect ratio: ${aspectRatio}.`,
      "Create a polished editorial social-media visual. No logos, no UI mockups, no readable text, no captions, no watermarks.",
    ].join("\n");

    const imageRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        authorization: `Bearer ${LOVABLE_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        prompt: finalPrompt,
        n: 1,
        size: sizeForAspectRatio(aspectRatio),
        aspect_ratio: aspectRatio,
        response_format: "b64_json",
      }),
    });

    if (!imageRes.ok) {
      const text = await imageRes.text().catch(() => "");
      console.error(`Image gateway error ${imageRes.status}`, text);
      return jsonResponse({ error: `Image generation failed (${imageRes.status}).` }, imageRes.status || 500);
    }

    const imageData = await imageRes.json();
    const item = imageData?.data?.[0] || imageData?.images?.[0] || imageData;
    const b64 = item?.b64_json || item?.base64 || item?.image;
    const url = item?.url || item?.public_url;

    let bytes: Uint8Array;
    let contentType = "image/png";

    if (typeof b64 === "string" && b64.length > 0) {
      const decoded = bytesFromBase64(b64);
      bytes = decoded.bytes;
      contentType = decoded.contentType;
    } else if (typeof url === "string" && url.length > 0) {
      const assetRes = await fetch(url);
      if (!assetRes.ok) return jsonResponse({ error: "Generated image could not be downloaded." }, 500);
      bytes = new Uint8Array(await assetRes.arrayBuffer());
      contentType = assetRes.headers.get("content-type") || "image/png";
    } else {
      return jsonResponse({ error: "Image generator did not return an image." }, 500);
    }

    const ext = contentType.includes("jpeg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
    const storagePath = `${userId}/${calendarId}/day-${postDay}-${Date.now()}.${ext}`;
    await uploadToStorage({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      bucket: "post-images",
      path: storagePath,
      bytes,
      contentType,
    });

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/post-images/${encodeURI(storagePath)}`;
    await upsertMediaReference({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      userId,
      bucket: "post-images",
      storagePath,
      publicUrl,
      referenceKey: calendarId,
    });

    return jsonResponse({
      publicUrl,
      storagePath,
      aspectRatio,
      prompt,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("generate-post-image error", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
