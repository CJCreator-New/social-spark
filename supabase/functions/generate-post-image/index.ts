declare const Deno: any;

import {
  getCorsHeaders,
  jsonResponse,
  checkRateLimit,
  checkContentLength,
  getVerifiedUserId,
  errorResponse,
  checkQuota,
  incrementGenerationCount,
  quotaExceededMessage,
  sanitizeLogValue,
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
    case "9:16":
      return "864x1536";
    case "1:1":
    default:
      return "1024x1024";
  }
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

function normalizeCalendarId(value: unknown): string | null {
  const calendarId = String(value || "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(calendarId)
  ) {
    return null;
  }
  return calendarId.toLowerCase();
}

function normalizePostDay(value: unknown): number | null {
  const postDay = Number(value || 0);
  if (!Number.isInteger(postDay) || postDay < 1 || postDay > 366) {
    return null;
  }
  return postDay;
}

function postgrestValue(value: string): string {
  return encodeURIComponent(value);
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
    body: params.bytes as any,
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
  const res = await fetch(
    `${params.supabaseUrl}/rest/v1/media_references?on_conflict=bucket,storage_path`,
    {
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
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to track media reference: (${res.status}) ${text}`.trim());
  }
}

async function verifyCalendarOwnership(params: {
  supabaseUrl: string;
  serviceRoleKey: string;
  calendarId: string;
  userId: string;
}): Promise<boolean> {
  const res = await fetch(
    `${params.supabaseUrl}/rest/v1/saved_calendars?id=eq.${postgrestValue(params.calendarId)}&user_id=eq.${postgrestValue(params.userId)}&select=id`,
    {
      headers: {
        authorization: `Bearer ${params.serviceRoleKey}`,
        apikey: params.serviceRoleKey,
      },
    }
  );
  if (!res.ok) return false;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

// Exported for Vitest (see generate-post-image.test.ts); Deno.serve is guarded below,
// same pattern as telemetry/index.ts and verify-payment/index.ts.
export async function handleGeneratePostImage(req: Request): Promise<Response> {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: getCorsHeaders(req.headers.get("origin")) });

  const contentLengthError = checkContentLength(req);
  if (contentLengthError) return contentLengthError;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Storage is not configured." }, 500);
    }
    if (!LOVABLE_API_KEY) {
      console.error(
        "LOVABLE_API_KEY environment variable is not set. Please set it in Supabase Dashboard → Edge Functions → Manage secrets."
      );
      return jsonResponse(
        {
          error: "AI is not configured.",
          message:
            "The LOVABLE_API_KEY environment variable is not set. Please configure it in Supabase Dashboard → Edge Functions → Manage secrets.",
        },
        500
      );
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const userId = await getVerifiedUserId(token);
    if (!userId) return jsonResponse({ error: "Sign in required." }, 401);

    const body = (await req.json().catch(() => ({}))) as ImageRequest;
    const calendarId = normalizeCalendarId(body.calendarId);
    const postDay = normalizePostDay(body.postDay);
    const prompt = String(body.prompt || body.post?.image_prompt || "").trim();
    const aspectRatio = String(body.aspectRatio || "1:1");
    const platform = String(body.platform || "LinkedIn");

    if (!calendarId || !postDay || !prompt) {
      return jsonResponse({ error: "Missing calendar, post day, or image prompt." }, 400);
    }

    const ownsCalendar = await verifyCalendarOwnership({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      calendarId,
      userId,
    });
    if (!ownsCalendar) {
      return jsonResponse({ error: "Calendar not found." }, 403);
    }

    const rateLimitCheck = await checkRateLimit(userId, "generate-post-image", {
      maxRequests: 8,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) return jsonResponse({ error: "Rate limit exceeded." }, 429);

    const quota = await checkQuota(userId);
    const usingSharedKey = !(quota.useOwnKey && quota.keyMode === "always");
    if (usingSharedKey && !quota.allowed) {
      return jsonResponse(
        {
          error: "QUOTA_EXCEEDED",
          message: quotaExceededMessage(quota.tier),
          quota: { used: quota.used, limit: quota.limit },
        },
        402
      );
    }

    let platformStyle = "";
    if (platform === "LinkedIn") {
      platformStyle =
        "Style: Professional, clean, corporate-editorial, minimalist flat illustrations or clean office/workspace photography. Muted executive colors.";
    } else if (platform === "Instagram" || platform === "TikTok") {
      platformStyle =
        "Style: Lifestyle photography, vibrant, authentic, high-contrast, modern aesthetic suitable for lifestyle grids or video thumbnails.";
    } else if (platform === "X" || platform === "Facebook") {
      platformStyle =
        "Style: Engaging, news-editorial or concept-graphic illustration, sharp contrast, clear central subject.";
    }

    const finalPrompt = [
      prompt,
      `Platform: ${platform}. Aspect ratio: ${aspectRatio}.`,
      platformStyle,
      "Create a polished editorial social-media visual. No logos, no UI mockups, no readable text, no captions, no watermarks.",
    ]
      .filter(Boolean)
      .join("\n");

    let imageRes: Response | undefined;
    let lastError: any = null;
    let successProvider = "";

    const providers = [];
    if (LOVABLE_API_KEY) {
      providers.push({
        name: "lovable-gateway",
        url: "https://ai.gateway.lovable.dev/v1/images/generations",
        headers: {
          authorization: `Bearer ${LOVABLE_API_KEY}`,
          "content-type": "application/json",
        },
        body: {
          model: "google/gemini-2.5-flash-image",
          prompt: finalPrompt,
          n: 1,
          size: sizeForAspectRatio(aspectRatio),
          aspect_ratio: aspectRatio,
          response_format: "b64_json",
        }
      });
    }

    const openrouterKey = Deno.env.get("PLATFORM_OPENROUTER_KEY");
    if (openrouterKey) {
      providers.push({
        name: "openrouter",
        url: "https://openrouter.ai/api/v1/images/generations",
        headers: {
          authorization: `Bearer ${openrouterKey}`,
          "content-type": "application/json",
        },
        body: {
          model: "google/gemini-2.5-flash-image",
          prompt: finalPrompt,
          n: 1,
          size: sizeForAspectRatio(aspectRatio),
          aspect_ratio: aspectRatio,
          response_format: "b64_json",
        }
      });
    }

    const openaiKey = Deno.env.get("PLATFORM_OPENAI_KEY");
    if (openaiKey) {
      let size = "1024x1024";
      if (aspectRatio === "16:9" || aspectRatio === "1.91:1") {
        size = "1792x1024";
      } else if (aspectRatio === "9:16" || aspectRatio === "4:5") {
        size = "1024x1792";
      }
      providers.push({
        name: "openai",
        url: "https://api.openai.com/v1/images/generations",
        headers: {
          authorization: `Bearer ${openaiKey}`,
          "content-type": "application/json",
        },
        body: {
          model: "dall-e-3",
          prompt: finalPrompt,
          n: 1,
          size: size,
          response_format: "b64_json",
        }
      });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (geminiKey) {
      providers.push({
        name: "gemini-imagen",
        url: `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${geminiKey}`,
        headers: {
          "content-type": "application/json",
        },
        body: {
          numberOfImages: 1,
          prompt: finalPrompt,
          aspectRatio: aspectRatio === "1:1" ? "1:1" : aspectRatio === "16:9" ? "16:9" : aspectRatio === "9:16" ? "9:16" : aspectRatio === "4:5" ? "4:5" : aspectRatio === "3:4" ? "3:4" : "1:1",
          outputMimeType: "image/png",
        }
      });
    }

    if (providers.length === 0) {
      return jsonResponse({ error: "No image generation providers are configured." }, 500);
    }

    for (const provider of providers) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      try {
        console.log(`[image-waterfall] Trying provider: ${provider.name}`);
        const response = await fetch(provider.url, {
          method: "POST",
          headers: provider.headers,
          body: JSON.stringify(provider.body),
          signal: controller.signal,
        });

        if (response.ok) {
          imageRes = response;
          successProvider = provider.name;
          clearTimeout(timeoutId);
          break;
        } else {
          const errText = await response.text().catch(() => "");
          console.error(`[image-waterfall] Provider ${provider.name} failed with status ${response.status}:`, sanitizeLogValue(errText));
          lastError = { status: response.status, message: errText };
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          console.error(`[image-waterfall] Provider ${provider.name} timed out.`);
          lastError = { status: 504, message: "Timeout" };
        } else {
          console.error(`[image-waterfall] Provider ${provider.name} encountered error:`, err);
          lastError = { status: 500, message: err instanceof Error ? err.message : String(err) };
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!imageRes) {
      return jsonResponse(
        { error: `Image generation failed. ${lastError?.message || ""}` },
        lastError?.status || 500
      );
    }

    if (usingSharedKey) {
      await incrementGenerationCount(userId);
    }

    const imageData = await imageRes.json().catch((err) => {
      console.error("Failed to parse image generator JSON response:", sanitizeLogValue(err));
      return null;
    });

    if (!imageData) {
      return jsonResponse({ error: "Image generator returned invalid JSON." }, 500);
    }

    const item = imageData?.data?.[0] || imageData?.images?.[0] || imageData;
    let b64 = item?.b64_json || item?.base64 || item?.image;
    if (successProvider === "gemini-imagen") {
      const imgObj = imageData?.generatedImages?.[0]?.image;
      b64 = imgObj?.imageBytes || b64;
    }
    const url = item?.url || item?.public_url;

    let bytes: Uint8Array;
    let contentType = "image/png";

    if (typeof b64 === "string" && b64.length > 0) {
      const decoded = bytesFromBase64(b64);
      bytes = decoded.bytes;
      contentType = decoded.contentType;
    } else if (typeof url === "string" && url.length > 0) {
      const assetRes = await fetch(url);
      if (!assetRes.ok)
        return jsonResponse({ error: "Generated image could not be downloaded." }, 500);
      bytes = new Uint8Array(await assetRes.arrayBuffer());
      contentType = assetRes.headers.get("content-type") || "image/png";
    } else {
      console.error("Unknown API response shape:", sanitizeLogValue(imageData));
      return jsonResponse({ error: "Image generator did not return an image." }, 500);
    }

    // Orphan previous images for this calendar and post day before uploading the new one
    const searchPathPattern = `${userId}/${calendarId}/day-${postDay}-`;
    const orphanRes = await fetch(
      `${SUPABASE_URL}/rest/v1/media_references?user_id=eq.${postgrestValue(userId)}&bucket=eq.post-images&reference_kind=eq.calendar&reference_key=eq.${postgrestValue(calendarId)}&storage_path=like.${postgrestValue(`${searchPathPattern}%`)}`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          reference_count: 0,
          orphaned_at: new Date().toISOString(),
        }),
      }
    );
    if (!orphanRes.ok) {
      const text = await orphanRes.text().catch(() => "");
      console.warn(`Failed to orphan old media references: ${orphanRes.status}`, sanitizeLogValue(text));
    }

    const ext = contentType.includes("jpeg")
      ? "jpg"
      : contentType.includes("webp")
        ? "webp"
        : "png";
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
    return errorResponse("generate-post-image", e);
  }
}

if (typeof Deno !== "undefined" && Deno.serve) {
  Deno.serve(handleGeneratePostImage);
}
