export type PostingTimeSuggestion = {
  day: number;
  time: string;
  reason: string;
};

// Generic fallback (used when platform is unknown or unsupported below).
export const suggestedPostingTimes: PostingTimeSuggestion[] = [
  { day: 1, time: "08:00", reason: "Week-start motivation content performs well" },
  { day: 2, time: "09:00", reason: "Peak weekday engagement window" },
  { day: 3, time: "08:30", reason: "Mid-week reach is usually strong" },
  { day: 4, time: "09:00", reason: "Good planning and catch-up window" },
  { day: 5, time: "08:00", reason: "Early post before end-of-week distraction" },
  { day: 6, time: "10:00", reason: "Weekend browsing window" },
  { day: 7, time: "18:00", reason: "Sunday evening reflection and planning" },
];

// Platform-specific best-practice posting windows (industry-standard heuristics,
// not derived from per-account data). Day numbers follow the wizard's Mon=1..Sun=7.
const PLATFORM_POSTING_TIMES: Record<string, PostingTimeSuggestion[]> = {
  LinkedIn: [
    { day: 1, time: "08:00", reason: "LinkedIn: Monday morning catch-up scrolling" },
    { day: 2, time: "09:00", reason: "LinkedIn: Tue-Thu mid-morning is peak professional engagement" },
    { day: 3, time: "09:00", reason: "LinkedIn: Tue-Thu mid-morning is peak professional engagement" },
    { day: 4, time: "09:00", reason: "LinkedIn: Tue-Thu mid-morning is peak professional engagement" },
    { day: 5, time: "08:30", reason: "LinkedIn: Friday wrap-up content before weekend drop-off" },
    { day: 6, time: "10:00", reason: "LinkedIn: weekend traffic is low; late-morning is safest" },
    { day: 7, time: "10:00", reason: "LinkedIn: weekend traffic is low; late-morning is safest" },
  ],
  Instagram: [
    { day: 1, time: "11:00", reason: "Instagram: late-morning lunch-break browsing" },
    { day: 2, time: "11:00", reason: "Instagram: late-morning lunch-break browsing" },
    { day: 3, time: "11:00", reason: "Instagram: late-morning lunch-break browsing" },
    { day: 4, time: "11:00", reason: "Instagram: late-morning lunch-break browsing" },
    { day: 5, time: "11:00", reason: "Instagram: late-morning lunch-break browsing" },
    { day: 6, time: "12:00", reason: "Instagram: weekend midday leisure scrolling" },
    { day: 7, time: "19:00", reason: "Instagram: Sunday evening wind-down browsing" },
  ],
  X: [
    { day: 1, time: "09:00", reason: "X: morning commute/news-check window" },
    { day: 2, time: "09:00", reason: "X: morning commute/news-check window" },
    { day: 3, time: "12:00", reason: "X: midweek lunch-hour spike" },
    { day: 4, time: "12:00", reason: "X: midweek lunch-hour spike" },
    { day: 5, time: "09:00", reason: "X: morning commute/news-check window" },
    { day: 6, time: "10:00", reason: "X: weekend browsing is later and lighter" },
    { day: 7, time: "10:00", reason: "X: weekend browsing is later and lighter" },
  ],
  Facebook: [
    { day: 1, time: "13:00", reason: "Facebook: early afternoon engagement peak" },
    { day: 2, time: "13:00", reason: "Facebook: early afternoon engagement peak" },
    { day: 3, time: "13:00", reason: "Facebook: early afternoon engagement peak" },
    { day: 4, time: "13:00", reason: "Facebook: early afternoon engagement peak" },
    { day: 5, time: "12:00", reason: "Facebook: Friday midday before weekend drop-off" },
    { day: 6, time: "12:00", reason: "Facebook: weekend midday browsing" },
    { day: 7, time: "12:00", reason: "Facebook: weekend midday browsing" },
  ],
  TikTok: [
    { day: 1, time: "19:00", reason: "TikTok: weekday evening prime viewing" },
    { day: 2, time: "19:00", reason: "TikTok: weekday evening prime viewing" },
    { day: 3, time: "19:00", reason: "TikTok: weekday evening prime viewing" },
    { day: 4, time: "19:00", reason: "TikTok: weekday evening prime viewing" },
    { day: 5, time: "17:00", reason: "TikTok: Friday early-evening viewing surge" },
    { day: 6, time: "11:00", reason: "TikTok: weekend late-morning scrolling" },
    { day: 7, time: "19:00", reason: "TikTok: Sunday evening prime viewing" },
  ],
};

/** Returns just the suggested time string. Defaults to 09:00 if day not found. */
export function suggestedTimeForDay(day: number, platform?: string): string {
  const table = (platform && PLATFORM_POSTING_TIMES[platform]) || suggestedPostingTimes;
  return table.find(item => item.day === day)?.time || "09:00";
}

/** Returns the time + a short human-readable reason, for tooltips/badges. */
export function suggestedPostingTimeInfo(day: number, platform?: string): PostingTimeSuggestion {
  const table = (platform && PLATFORM_POSTING_TIMES[platform]) || suggestedPostingTimes;
  return table.find(item => item.day === day) || { day, time: "09:00", reason: "Default mid-morning posting window" };
}
