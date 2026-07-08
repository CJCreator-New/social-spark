import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_scheduled_posts",
  title: "List scheduled posts",
  description:
    "List the signed-in user's upcoming scheduled ContentForge posts, ordered by scheduled_at.",
  inputSchema: {
    status: z
      .enum(["scheduled", "published", "failed", "draft"])
      .optional()
      .describe("Filter by status."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Max posts to return (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const scopes = ctx.getScopes() || [];
    if (!scopes.includes("read:scheduled_posts")) {
      return { content: [{ type: "text", text: "Access denied: missing read:scheduled_posts scope" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("scheduled_posts")
      .select(
        "id, calendar_id, platform, scheduled_at, status, workflow_status, copy_text, published_at"
      )
      .order("scheduled_at", { ascending: true })
      .limit(limit ?? 25);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { posts: data ?? [] },
    };
  },
});
