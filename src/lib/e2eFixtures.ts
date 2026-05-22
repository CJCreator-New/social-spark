export const E2E_AUTH_FLAG = "ss:e2e-auth";
export const E2E_USER_ID = "00000000-0000-4000-8000-000000000001";
export const E2E_USER_EMAIL = "e2e@contentforge.test";

export const E2E_CALENDAR = {
  id: "e2e-calendar-1",
  title: "E2E Marketing Launch Week",
  industry_label: "Marketing & Growth",
  platform: "LinkedIn",
  core_idea: "Deterministic test calendar for Playwright coverage.",
  created_at: "2026-05-21T10:00:00.000Z",
  is_favorite: false,
  posts: [{ day: 1 }, { day: 2 }, { day: 3 }],
  industry: "marketing",
  form_payload: { mode: "week", language: "English" },
  timezone: "UTC",
  tracking_url: null,
};

export const E2E_SCHEDULE_ROWS = [
  {
    id: "e2e-row-1",
    calendar_id: E2E_CALENDAR.id,
    post_day: 1,
    platform: "LinkedIn",
    scheduled_at: "2026-05-22T08:00:00.000Z",
    status: "scheduled",
    workflow_status: "drafted" as const,
    copy_text: "Draft copy for deterministic Playwright coverage.",
    post_snapshot: { title: "Test day 1", topic: "Deterministic auth and data" },
    published_at: null,
    failure_reason: null,
  },
  {
    id: "e2e-row-2",
    calendar_id: E2E_CALENDAR.id,
    post_day: 2,
    platform: "LinkedIn",
    scheduled_at: "2026-05-23T08:00:00.000Z",
    status: "scheduled",
    workflow_status: "approved" as const,
    copy_text: "Approved copy for deterministic Playwright coverage.",
    post_snapshot: { title: "Test day 2", topic: "Schedule state" },
    published_at: null,
    failure_reason: null,
  },
];
