// Pre-baked Newsletter calendar shown via "See an example" on Step 1.
// No API call, no auth — purely client-side walkthrough content.

export interface SamplePost {
  day: number;
  dow: string;
  topic: string;
  format: string;
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
  rationale: string;
}

export const SAMPLE_FORM = {
  industry: "creator",
  industryLabel: "Creator Economy",
  platform: "Newsletter",
  coreIdea: "Helping indie newsletter writers grow past 1,000 subscribers without paid ads.",
  audiences: ["Newsletter writers", "Aspiring creators", "Coaches & consultants"],
  voice: "Founder POV",
  style: "First-person story",
  goals: ["Awareness", "Engagement", "Community building"],
  format: "Storytelling-led",
  cta: "Drive to profile / newsletter",
  length: "medium",
  structure: "mixed",
};

export const SAMPLE_POSTS: SamplePost[] = [
  {
    day: 1,
    dow: "Mon",
    topic: "Why most newsletters die at 200 subs",
    format: "Opinion — hybrid",
    title: "The 200-subscriber wall isn't about growth. It's about belief.",
    hook: "Almost every newsletter I've watched die in the past two years died at the same place: somewhere between 180 and 240 subscribers.\n\nNot because the writing got worse. Because the writer stopped believing anyone was reading.",
    body: "Here's what nobody tells you about that early plateau:\n\n• Open rates look the same at 50 subs and 500 — you can't feel growth in a number that small.\n• You publish on Tuesday, get 3 replies, and convince yourself that's all there is.\n• You start writing for the silence instead of the audience.\n\nThe writers who break through aren't the ones who post more. They're the ones who keep writing the exact same way they did at issue #4 — with conviction, like the room is full.",
    cta: "If you're stuck at the 200 wall, hit reply and tell me what you wrote about last week. I read every reply.",
    hashtags: "",
    rationale: "Founder POV with a contrarian opening that immediately validates the reader's hidden fear. Drives replies — which is the highest-signal newsletter engagement metric.",
  },
  {
    day: 2,
    dow: "Tue",
    topic: "The one section every issue should have",
    format: "How-to — hybrid",
    title: "I added one section to my newsletter and reply rate tripled.",
    hook: "Three months ago, my newsletter had a 1.2% reply rate. After one structural change — same writing, same cadence — it's been sitting at 4.7%.\n\nThe change took 90 seconds.",
    body: "I added a single line at the bottom of every issue:\n\n→ 'Hit reply with one word: what's the hardest thing about [topic] for you right now?'\n\nThat's it. No new content, no new design, no list-building tactic. Just permission to respond.\n\nWhat I learned:\n\n• Most subscribers want to engage but don't know they're allowed.\n• A specific question gets specific replies — vague invitations get silence.\n• Reading 40 replies a week is the best market research money can't buy.",
    cta: "Try it on your next issue. Then forward me the best reply you get — I want to see what your audience is really thinking.",
    hashtags: "",
    rationale: "Concrete before/after numbers earn trust early. The action is small enough that readers can implement it before forgetting — which is the only thing that drives word-of-mouth growth.",
  },
  {
    day: 3,
    dow: "Wed",
    topic: "Subject lines that don't sound like marketing",
    format: "List — bullets",
    title: "7 subject lines from my best-performing issues (none use the word 'newsletter').",
    hook: "I went back through the 60 issues I've sent and pulled the 7 with the highest open rates. Patterns emerged that I didn't expect.",
    body: "Here they are, exactly as I sent them:\n\n• 'I almost killed this newsletter on Sunday'\n• 'The math nobody wants to do'\n• 'What 11 readers got wrong (including me)'\n• 'Why I stopped writing on Tuesdays'\n• 'A tiny rant about Substack'\n• 'Three things I was wrong about in 2023'\n• 'The reply that changed how I write'\n\nNotice what's missing: no 'best practices', no 'ultimate guide', no 'X tips for Y'. They sound like emails from a friend, not a brand. Because that's what readers want to open.",
    cta: "Steal the structure, not the words. What's your most opened subject line this year?",
    hashtags: "",
    rationale: "Tactical, immediately useful, and demonstrates the writer's voice through example. List format makes it screenshot-able and shareable.",
  },
  {
    day: 4,
    dow: "Thu",
    topic: "Why I'm not on Substack",
    format: "Opinion — paragraphs",
    title: "I left Substack at 800 subscribers. Here's the math.",
    hook: "Last March I migrated 800 subscribers off Substack to a self-hosted setup. Most people I told thought I was insane.\n\nNine months later, I'm convinced it was the most important business decision I've made.",
    body: "Substack solves the wrong problem for serious writers. It solves discovery — which is genuinely useful at the start. But discovery is a one-time tax. Owning your relationship with readers is a compounding asset.\n\nThe specific things that pushed me out: Substack's 10% take on every paid subscriber, the recommendation engine pulling readers toward bigger publications, and the slow erosion of differentiation as everyone's homepage started looking identical.\n\nWhat I gave up: easy growth from cross-recommendations.\n\nWhat I gained: full control over the email file, ability to A/B test landing pages, lower long-term cost, and most importantly — a sense that this is mine, not rented.",
    cta: "Where are you hosted, and have you ever thought about moving? Genuinely curious — reply and let me know.",
    hashtags: "",
    rationale: "Mid-week is a good slot for a longer, opinion-led piece. The vulnerability of 'most people thought I was insane' creates trust before the argument lands.",
  },
  {
    day: 5,
    dow: "Fri",
    topic: "The friction that kills referrals",
    format: "Case study — hybrid",
    title: "We removed two clicks from our referral flow. Sign-ups doubled in a week.",
    hook: "On April 8th our referral program converted at 3.1%. On April 16th it converted at 7.4%. The product didn't change. The audience didn't change. Two clicks disappeared.",
    body: "Here's what the old flow looked like:\n\n• Reader clicks share link → lands on a 'why share' explainer page → clicks 'get my link' → copies link → shares.\n\nHere's the new flow:\n\n• Reader clicks share link → their personal share text is already in the clipboard → toast says 'paste anywhere'.\n\nFour steps became one. The conversion rate didn't double because we made it 'better'. It doubled because we stopped asking readers to want it as much as we did.\n\nThe lesson generalises: every friction point in your funnel is a place where you're asking the reader to care. They don't. You do. Build accordingly.",
    cta: "What's the most-clicked button on your site? Have you actually walked through what happens after the click? Reply with one friction point you'd remove.",
    hashtags: "",
    rationale: "Friday is a good slot for a tactical case study — readers are in 'tidy up the week' mode. Specific numbers + before/after structure make it easy to remember.",
  },
  {
    day: 6,
    dow: "Sat",
    topic: "What I read this week",
    format: "Roundup — bullets",
    title: "5 things I read this week that made me think (and one I disagreed with).",
    hook: "Saturday round-up. Coffee, no agenda. Here's what's been rattling around in my head.",
    body: "• 'The Cult of Done' manifesto by Bre Pettis — re-read it for the fourth time. Still the best thing on shipping over polishing.\n\n• A Twitter thread on why most 'audience research' surveys are useless (paraphrasing: people tell you what they think they should want, not what they'll actually do).\n\n• Patrick McKenzie's old essay 'Don't Call Yourself a Programmer' — applies word-for-word to writers in 2024.\n\n• A long-form piece on how community-led growth is the only sustainable acquisition channel for solo creators. Persuasive but oversimplified.\n\n• I read one piece arguing that newsletters are 'over' as a format. I disagree, hard. The format isn't dying — the people writing them like blogs from 2014 are.",
    cta: "What's the best thing you read this week? Reply and I'll add the top picks to next Saturday's round-up.",
    hashtags: "",
    rationale: "Saturday round-ups are a low-pressure way to demonstrate taste and curate. The dissent at the end ('one I disagreed with') signals point of view, which prevents the format from feeling like noise.",
  },
  {
    day: 7,
    dow: "Sun",
    topic: "A quiet thought to end the week",
    format: "Reflection — paragraphs",
    title: "On writing for the quiet readers.",
    hook: "97% of my subscribers will never reply to an issue. They'll never share, never comment, never tell me they read.\n\nFor a long time that statistic depressed me. Now it's the thing that keeps me writing.",
    body: "Because here's what I've slowly understood: those silent readers are doing the most important work. They're letting your ideas marinate. They're forwarding the issue to one person they trust without telling you. They're remembering one line you wrote three months ago at exactly the moment they need it.\n\nIf you only write for the loud 3% — the repliers, the sharers, the people whose engagement you can measure — you'll end up writing a different kind of newsletter. Sharper, maybe. But thinner.\n\nThe quiet readers are why the work matters. Write for them. They're paying attention in a way no dashboard will ever show you.",
    cta: "If this resonated, that's enough. No reply needed. See you Tuesday.",
    hashtags: "",
    rationale: "Sunday is for slower, more reflective content. The CTA explicitly releases the reader from the engagement contract — which paradoxically tends to drive the most genuine replies of the week.",
  },
];

export const SAMPLE_POST_TIMES: Record<string, string> = {
  "1": "08:00",
  "2": "08:00",
  "3": "07:30",
  "4": "08:00",
  "5": "08:00",
  "6": "09:00",
  "7": "10:00",
};
