import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Loosely typed on purpose: supabase/functions/repurpose-post/index.ts reads
// each field with `post.field || ""` fallbacks, so a partial post (e.g. just a
// hook + body) is accepted the same way the app's regenerate/repurpose UI
// sends it.
const postSchema = z
  .object({
    title: z.string().optional(),
    hook: z.string().optional(),
    body: z.string().optional(),
    cta: z.string().optional(),
    hashtags: z.string().optional(),
    topic: z.string().optional(),
    format: z.string().optional(),
    dow: z.string().optional(),
  })
  .passthrough()
  .describe("The source post to repurpose. Provide at minimum a hook or body.");

/** POST to the same `repurpose-post` edge function the app UI calls, forwarding
 * the caller's verified bearer token so its own auth, rate-limit, and quota
 * checks apply exactly as they do for browser clients — this tool never
 * bypasses them. */
async function callRepurposePostFunction(
  body: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ status: number; data: Record<string, unknown> }> {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const res = await fetch(`${supabaseUrl}/functions/v1/repurpose-post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
      Authorization: `Bearer ${ctx.getToken() ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

export default defineTool({
  name: "repurpose_post",
  title: "Repurpose a post for another platform",
  description:
    "Rewrite an existing post for a different target platform (e.g. take a LinkedIn post and " +
    "rewrite it for X or Instagram), preserving the strategic angle. Calls the same " +
    "`repurpose-post` pipeline the app UI uses, so per-user rate limits and generation quota " +
    "apply.",
  inputSchema: {
    post: postSchema,
    targetPlatform: z
      .string()
      .min(1)
      .describe("Platform to rewrite the post for, e.g. X, Instagram, Facebook, Newsletter."),
    platform: z
      .string()
      .optional()
      .describe("The post's current/source platform (default LinkedIn)."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ post, targetPlatform, platform }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const scopes = ctx.getScopes() || [];
    if (!scopes.includes("generate:repurpose")) {
      return {
        content: [{ type: "text", text: "Access denied: missing generate:repurpose scope" }],
        isError: true,
      };
    }
    if (!post || (!post.hook && !post.body && !post.title)) {
      return {
        content: [
          { type: "text", text: "Malformed input: post must include at least a title, hook, or body." },
        ],
        isError: true,
      };
    }

    try {
      const { status, data } = await callRepurposePostFunction(
        { post, targetPlatform, platform },
        ctx
      );
      if (status !== 200) {
        const message =
          (typeof data.message === "string" && data.message) ||
          (typeof data.error === "string" && data.error) ||
          `repurpose-post failed (${status})`;
        return { content: [{ type: "text", text: message }], isError: true };
      }
      if (!data.post) {
        return {
          content: [{ type: "text", text: "repurpose-post returned no post." }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(data.post, null, 2) }],
        structuredContent: { post: data.post },
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: `repurpose-post request failed: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
        isError: true,
      };
    }
  },
});
