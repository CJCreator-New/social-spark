// deno-lint-ignore-file
// @ts-ignore - Deno ESM import resolved at runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
import { checkRateLimit, getCorsHeaders } from "../_shared/promptHelpers.ts";

// NEEDS VERIFICATION BEFORE DEPLOYMENT: confirm these endpoints, auth style and
// payload shapes against the current Buffer and Hootsuite API docs. They were
// carried over unchanged from the old browser-side code and are unverified.
const SCHEDULER_ENDPOINTS = {
  buffer: "https://api.bufferapp.com/1/updates/create.json", // NEEDS VERIFICATION
  hootsuite: "https://platform.hootsuite.com/v1/messages", // NEEDS VERIFICATION
} as const;

type SchedulerProvider = keyof typeof SCHEDULER_ENDPOINTS;

const MAX_POSTS = 31;
const MAX_TEXT_LENGTH = 5000;
const DELAY_BETWEEN_CALLS_MS = 400;
// ISO 8601 with an explicit offset (or Z), e.g. 2026-11-23T09:00:00+05:30
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

interface IncomingPost {
  text: string;
  scheduledAt?: string;
  imageUrl?: string;
}

interface PostError {
  index: number;
  message: string;
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req.headers.get("origin"));

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized access." }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "An unexpected error occurred." }, 500);
    }

    // Validate the token and retrieve the user (same pattern as decrypt-api-key)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized access." }, 401);
    }

    const rateLimitCheck = await checkRateLimit(user.id, "push-to-scheduler", {
      maxRequests: 5,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: "Too many requests. Please try again later." }, 429);
    }

    // ── Validate the request body ───────────────────────────────────────────
    const body = await req.json().catch(() => null);
    const provider = String(body?.provider || "").trim() as SchedulerProvider;
    if (!(provider in SCHEDULER_ENDPOINTS)) {
      return jsonResponse({ error: "Invalid provider." }, 400);
    }
    const profileId = String(body?.profileId || "").trim();
    if (!profileId || profileId.length > 200) {
      return jsonResponse({ error: "A profile ID is required." }, 400);
    }
    const rawPosts: unknown = body?.posts;
    if (!Array.isArray(rawPosts) || rawPosts.length === 0 || rawPosts.length > MAX_POSTS) {
      return jsonResponse({ error: `Send between 1 and ${MAX_POSTS} posts.` }, 400);
    }
    const posts: IncomingPost[] = [];
    for (const p of rawPosts) {
      const text = typeof p?.text === "string" ? p.text.trim() : "";
      const scheduledAt = typeof p?.scheduledAt === "string" ? p.scheduledAt.trim() : "";
      const imageUrl = typeof p?.imageUrl === "string" ? p.imageUrl.trim() : "";
      if (!text || text.length > MAX_TEXT_LENGTH) {
        return jsonResponse({ error: "Each post needs text (up to 5000 characters)." }, 400);
      }
      if (scheduledAt && (!ISO_WITH_OFFSET.test(scheduledAt) || isNaN(Date.parse(scheduledAt)))) {
        return jsonResponse({ error: "scheduledAt must be ISO 8601 with a time zone offset." }, 400);
      }
      if (imageUrl && !/^https:\/\//i.test(imageUrl)) {
        return jsonResponse({ error: "Image URLs must use https." }, 400);
      }
      posts.push({ text, scheduledAt: scheduledAt || undefined, imageUrl: imageUrl || undefined });
    }

    // ── Load the user's stored, encrypted scheduler key for this provider ──
    const { data: keyData, error: rpcError } = await supabase.rpc("get_scheduler_api_key", {
      p_provider: provider,
    });
    if (rpcError) {
      console.error("push-to-scheduler: key lookup failed");
      return jsonResponse({ error: "An unexpected error occurred." }, 500);
    }
    if (typeof keyData !== "string" || !keyData) {
      return jsonResponse(
        { error: `No saved ${provider} key found. Save your ${provider} key first.` },
        400
      );
    }
    const apiKey: string = keyData;

    // ── Push each post, collect real per-post results ───────────────────────
    let succeeded = 0;
    const errors: PostError[] = [];

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      try {
        let response: Response;
        if (provider === "buffer") {
          const form = new URLSearchParams();
          form.append("profile_ids[]", profileId);
          form.append("text", post.text);
          if (post.scheduledAt) form.append("scheduled_at", post.scheduledAt);
          if (post.imageUrl) {
            form.append("media[picture]", post.imageUrl);
            form.append("media[thumbnail]", post.imageUrl);
          }
          response = await fetch(SCHEDULER_ENDPOINTS.buffer, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          });
        } else {
          response = await fetch(SCHEDULER_ENDPOINTS.hootsuite, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: post.text,
              socialProfileIds: [profileId],
              ...(post.scheduledAt
                ? { scheduledSendTime: new Date(post.scheduledAt).toISOString() }
                : {}),
              ...(post.imageUrl ? { media: [{ url: post.imageUrl }] } : {}),
            }),
          });
        }

        if (response.ok) {
          succeeded++;
        } else {
          // Do not forward the raw provider body; keep a short, safe message.
          errors.push({ index: i, message: `${provider} rejected the post (HTTP ${response.status}).` });
        }
      } catch {
        errors.push({ index: i, message: `Could not reach ${provider}.` });
      }

      if (i < posts.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_CALLS_MS));
      }
    }

    console.info("push-to-scheduler finished:", {
      user_id: user.id,
      provider,
      attempted: posts.length,
      succeeded,
      failed: errors.length,
    });

    return jsonResponse({
      attempted: posts.length,
      succeeded,
      failed: errors.length,
      errors,
    });
  } catch (_e) {
    console.error("push-to-scheduler handler error");
    return jsonResponse({ error: "An unexpected error occurred." }, 500);
  }
});
