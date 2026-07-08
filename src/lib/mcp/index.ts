import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCalendarsTool from "./tools/list-calendars";
import getCalendarTool from "./tools/get-calendar";
import listScheduledPostsTool from "./tools/list-scheduled-posts";
import extractIdeasTool from "./tools/extract-ideas";
import repurposePostTool from "./tools/repurpose-post";
import listTrendsTool from "./tools/list-trends";

// Direct supabase.co issuer (not the .lovable.cloud proxy). Built from the
// project ref that Vite inlines at build time so this module stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

// Fail fast if the key the tools use to build a per-request Supabase client
// (see `supabaseForUser` in each tool) is actually a service-role key rather
// than the anon/publishable key. Service-role bypasses RLS entirely, which
// would turn every "current user's own rows" query into an unscoped one.
// Supabase JWTs encode their privilege level in the `role` claim.
function assertNotServiceRoleKey(key: string | undefined): void {
  if (!key) return; // absence is handled by the tools themselves at call time
  const parts = key.split(".");
  if (parts.length !== 3) return; // not a JWT (e.g. new-style sb_publishable_ key) — nothing to decode
  try {
    const payloadJson = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson) as { role?: string };
    if (payload.role === "service_role") {
      throw new Error(
        "SUPABASE_PUBLISHABLE_KEY resolves to a service-role JWT. Refusing to start the MCP " +
          "server: this key must be the anon/publishable key so RLS applies to every tool call."
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("SUPABASE_PUBLISHABLE_KEY resolves")) throw e;
    // Malformed/undecodable token — not our concern here, let downstream calls fail naturally.
  }
}

assertNotServiceRoleKey(
  typeof process !== "undefined" ? process.env?.SUPABASE_PUBLISHABLE_KEY : undefined
);

export default defineMcp({
  name: "contentforge-mcp",
  title: "ContentForge",
  version: "0.1.0",
  instructions:
    "Tools for ContentForge — an AI-powered social media content planner. Use `list_calendars` to browse the user's saved weekly content calendars, `get_calendar` to fetch one calendar and its posts by ID, `list_scheduled_posts` to see upcoming scheduled posts, `extract_ideas` to pull distinct post ideas out of pasted long-form source material, `repurpose_post` to rewrite an existing post for a different target platform, and `list_trends` to browse recent trending keywords.",
  // Scope vocabulary for this server: `read:calendars` (list_calendars,
  // get_calendar), `read:scheduled_posts` (list_scheduled_posts),
  // `generate:ideas` (extract_ideas), `generate:repurpose` (repurpose_post),
  // and `read:trends` (list_trends). The SDK's per-issuer `requiredScopes`
  // gates ALL tools on the same scope set, which would force every client to
  // hold every scope even if it only needs one — so scopes are declared here
  // for documentation and enforced per-tool instead, via `ctx.getScopes()` in
  // each handler (see get-calendar.ts, list-calendars.ts,
  // list-scheduled-posts.ts, extract-ideas.ts, repurpose-post.ts,
  // list-trends.ts).
  //
  // extract_ideas and repurpose_post call the SAME `extract-ideas` /
  // `repurpose-post` Supabase Edge Functions the app UI calls, forwarding the
  // caller's verified bearer token (`ctx.getToken()`) as the Authorization
  // header. Those functions do their own auth (getVerifiedUserId), per-user
  // rate limiting (checkRateLimit), and generation quota gating (checkQuota)
  // exactly as they do for browser clients — the MCP tools do not (and must
  // not) duplicate or bypass that logic; they only add the OAuth-scope check
  // above it.
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listCalendarsTool,
    getCalendarTool,
    listScheduledPostsTool,
    extractIdeasTool,
    repurposePostTool,
    listTrendsTool,
  ],
});
