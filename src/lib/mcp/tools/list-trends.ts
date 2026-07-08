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
  name: "list_trends",
  title: "List trending topics",
  description:
    "List recent trending keywords from the `trends` table populated by the trends-ingest " +
    "pipeline (supabase/functions/trends-ingest), ordered by volume. This is shared, non-personal " +
    "data readable by any signed-in user — the same table src/components/InspirationBank.tsx reads.",
  inputSchema: {
    category: z
      .string()
      .optional()
      .describe(
        "Filter to trends whose category matches this text (case-insensitive substring match, e.g. an industry name)."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max trends to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ category, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const scopes = ctx.getScopes() || [];
    if (!scopes.includes("read:trends")) {
      return { content: [{ type: "text", text: "Access denied: missing read:trends scope" }], isError: true };
    }
    let query = supabaseForUser(ctx)
      .from("trends")
      .select("keyword, category, volume, source, last_seen")
      .order("volume", { ascending: false })
      .limit(limit ?? 20);
    if (category) query = query.ilike("category", `%${category}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { trends: data ?? [] },
    };
  },
});
