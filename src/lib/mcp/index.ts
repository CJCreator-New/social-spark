import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listCalendarsTool from "./tools/list-calendars";
import getCalendarTool from "./tools/get-calendar";
import listScheduledPostsTool from "./tools/list-scheduled-posts";

// Direct supabase.co issuer (not the .lovable.cloud proxy). Built from the
// project ref that Vite inlines at build time so this module stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "contentforge-mcp",
  title: "ContentForge",
  version: "0.1.0",
  instructions:
    "Tools for ContentForge — an AI-powered social media content planner. Use `list_calendars` to browse the user's saved weekly content calendars, `get_calendar` to fetch one calendar and its posts by ID, and `list_scheduled_posts` to see upcoming scheduled posts.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listCalendarsTool, getCalendarTool, listScheduledPostsTool],
});
