import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

// Kept in sync with supabase/functions/extract-ideas/index.ts's own bounds so
// zod rejects obviously-invalid input before we ever call the edge function.
const SOURCE_MIN_CHARS = 200;
const SOURCE_MAX_CHARS = 20000;

/** POST to the same `extract-ideas` edge function the app UI calls, forwarding
 * the caller's verified bearer token so the function's own auth, rate-limit,
 * and quota checks (getVerifiedUserId/checkRateLimit/checkQuota in
 * _shared/promptHelpers.ts) apply exactly as they do for browser clients —
 * this tool never bypasses them. */
async function callExtractIdeasFunction(
  body: Record<string, unknown>,
  ctx: ToolContext
): Promise<{ status: number; data: Record<string, unknown> }> {
  const supabaseUrl = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const res = await fetch(`${supabaseUrl}/functions/v1/extract-ideas`, {
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
  name: "extract_ideas",
  title: "Extract post ideas from source material",
  description:
    "Analyze pasted long-form source material (an article, transcript, or notes) and extract " +
    "distinct, high-potential social post ideas mapped to proven engagement formats, for the " +
    "signed-in user. Calls the same `extract-ideas` pipeline the app UI uses, so per-user rate " +
    "limits and generation quota apply.",
  inputSchema: {
    source: z
      .string()
      .min(SOURCE_MIN_CHARS, `Source material must be at least ${SOURCE_MIN_CHARS} characters.`)
      .max(SOURCE_MAX_CHARS, `Source material must be under ${SOURCE_MAX_CHARS} characters.`)
      .describe("The long-form source text to extract ideas from."),
    count: z
      .number()
      .int()
      .min(3)
      .max(10)
      .optional()
      .describe("How many distinct ideas to extract (default 5)."),
    platform: z
      .string()
      .optional()
      .describe("Target platform for the ideas, e.g. LinkedIn, X, Instagram (default LinkedIn)."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ source, count, platform }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const scopes = ctx.getScopes() || [];
    if (!scopes.includes("generate:ideas")) {
      return {
        content: [{ type: "text", text: "Access denied: missing generate:ideas scope" }],
        isError: true,
      };
    }

    try {
      const { status, data } = await callExtractIdeasFunction({ source, count, platform }, ctx);
      if (status !== 200) {
        const message =
          (typeof data.message === "string" && data.message) ||
          (typeof data.error === "string" && data.error) ||
          `extract-ideas failed (${status})`;
        return { content: [{ type: "text", text: message }], isError: true };
      }
      const ideas = Array.isArray(data.ideas) ? data.ideas : [];
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: {
          ideas,
          requested: data.requested,
          partial: Boolean(data.partial),
        },
      };
    } catch (e) {
      return {
        content: [
          {
            type: "text",
            text: `extract-ideas request failed: ${e instanceof Error ? e.message : String(e)}`,
          },
        ],
        isError: true,
      };
    }
  },
});
