export type PostingTimeSuggestion = {
  day: number;
  time: string;
  reason: string;
};

export const suggestedPostingTimes: PostingTimeSuggestion[] = [
  { day: 1, time: "08:00", reason: "Week-start motivation content performs well" },
  { day: 2, time: "09:00", reason: "Peak weekday engagement window" },
  { day: 3, time: "08:30", reason: "Mid-week reach is usually strong" },
  { day: 4, time: "09:00", reason: "Good planning and catch-up window" },
  { day: 5, time: "08:00", reason: "Early post before end-of-week distraction" },
  { day: 6, time: "10:00", reason: "Weekend browsing window" },
  { day: 7, time: "18:00", reason: "Sunday evening reflection and planning" },
];

export function suggestedTimeForDay(day: number): string {
  return suggestedPostingTimes.find(item => item.day === day)?.time || "09:00";
}
