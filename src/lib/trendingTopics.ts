/**
 * Trending topics data per industry
 * Mock data for now; can be replaced with API integration later
 */

export interface TrendingTopic {
  topic: string;
  category: string;
  trending: boolean; // True if currently trending
  posts: number; // Approximate posts using this topic this week
}

const PLATFORM_ALIASES: Record<string, string> = {
  linkedin: "LinkedIn",
  "twitter/x": "Twitter/X",
  twitter: "Twitter/X",
  x: "Twitter/X",
  instagram: "Instagram",
  facebook: "Facebook",
  newsletter: "Newsletter",
  blog: "Blog",
  tiktok: "TikTok",
  threads: "Threads",
  bluesky: "Bluesky",
};

const PLATFORM_FIT_KEYWORDS: Record<string, string[]> = {
  LinkedIn: ["strategy", "leadership", "business", "metrics", "funding", "policy", "compliance", "devops", "data", "analytics", "career", "education"],
  "Twitter/X": ["ai", "trend", "news", "update", "launch", "crypto", "security", "metrics", "regulation", "product", "startup", "opinion"],
  Instagram: ["creator", "visual", "story", "wellness", "fashion", "content", "community", "behind-the-scenes", "lifestyle", "brand"],
  Facebook: ["community", "wellbeing", "family", "education", "retention", "story", "tips", "local", "support", "work culture"],
  Newsletter: ["guide", "framework", "analysis", "deep dive", "research", "case", "strategy", "insight", "metrics", "lesson"],
  Blog: ["seo", "guide", "how-to", "framework", "analysis", "research", "tutorial", "case", "opinion", "strategy"],
  TikTok: ["creator", "visual", "story", "how-to", "tutorial", "content", "brand", "lifestyle", "product", "community"],
  Threads: ["opinion", "insight", "discussion", "trend", "tech", "startup", "community", "hot take", "strategy"],
  Bluesky: ["tech", "startup", "analysis", "open source", "policy", "dev", "community", "research", "trend"],
};

const PLATFORM_DEFAULT_WEIGHTS: Record<string, number> = {
  LinkedIn: 1.1,
  "Twitter/X": 1.05,
  Instagram: 1.0,
  Facebook: 0.95,
  Newsletter: 1.15,
  Blog: 1.1,
  TikTok: 1.0,
  Threads: 1.0,
  Bluesky: 0.95,
};

function normalizeKey(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function normalizePlatform(platform?: string): string | undefined {
  if (!platform) return undefined;
  const key = normalizeKey(platform);
  return PLATFORM_ALIASES[key] || platform.trim();
}

function computePlatformFit(topic: TrendingTopic, platform?: string): number {
  const normalizedPlatform = normalizePlatform(platform);
  if (!normalizedPlatform) return 0;

  const keywords = PLATFORM_FIT_KEYWORDS[normalizedPlatform] || [];
  const haystack = normalizeKey(`${topic.topic} ${topic.category}`);
  const directMatch = keywords.reduce((score, keyword) => (haystack.includes(keyword) ? score + 1 : score), 0);
  const trendingBoost = topic.trending ? 1.25 : 0;
  const popularityBoost = Math.min(topic.posts / 1000, 1.5);
  const platformWeight = PLATFORM_DEFAULT_WEIGHTS[normalizedPlatform] || 1;

  return (directMatch * 1.5 + trendingBoost + popularityBoost) * platformWeight;
}

function rankTopics(topics: TrendingTopic[], platform?: string): TrendingTopic[] {
  return [...topics].sort((a, b) => {
    const platformDelta = computePlatformFit(b, platform) - computePlatformFit(a, platform);
    if (platformDelta !== 0) return platformDelta;
    if (a.trending !== b.trending) return a.trending ? -1 : 1;
    if (b.posts !== a.posts) return b.posts - a.posts;
    return a.topic.localeCompare(b.topic);
  });
}

const TRENDING_BY_INDUSTRY: Record<string, TrendingTopic[]> = {
  tech: [
    { topic: "AI agents", category: "AI & ML", trending: true, posts: 1200 },
    { topic: "Cursor + Claude", category: "Developer Tools", trending: true, posts: 850 },
    { topic: "TypeScript 5.4", category: "Languages", trending: false, posts: 320 },
    { topic: "Rust for web", category: "Languages", trending: true, posts: 640 },
    { topic: "LLM fine-tuning", category: "AI & ML", trending: true, posts: 950 },
    { topic: "DevOps automation", category: "DevOps", trending: false, posts: 410 },
    { topic: "Kubernetes optimization", category: "DevOps", trending: false, posts: 380 },
  ],
  health: [
    { topic: "GLP-1 weight loss", category: "Wellness", trending: true, posts: 1500 },
    { topic: "Sleep optimization", category: "Sleep Science", trending: true, posts: 980 },
    { topic: "Cold plunges", category: "Biohacking", trending: true, posts: 720 },
    { topic: "Mental health awareness", category: "Mental Health", trending: false, posts: 630 },
    { topic: "Gut microbiome", category: "Nutrition", trending: true, posts: 870 },
    { topic: "Longevity research", category: "Aging", trending: true, posts: 650 },
    { topic: "Women's hormonal health", category: "Women's Health", trending: false, posts: 540 },
  ],
  finance: [
    { topic: "2024 stock market trends", category: "Investing", trending: true, posts: 1400 },
    { topic: "Crypto market recovery", category: "Crypto", trending: true, posts: 1100 },
    { topic: "Index fund strategy", category: "Investing", trending: false, posts: 480 },
    { topic: "Real estate investing", category: "Investing", trending: true, posts: 920 },
    { topic: "Personal finance automation", category: "Personal Finance", trending: false, posts: 620 },
    { topic: "Startup financial modeling", category: "Startups", trending: true, posts: 580 },
    { topic: "Financial literacy for Gen Z", category: "Education", trending: true, posts: 750 },
  ],
  education: [
    { topic: "AI for education", category: "EdTech", trending: true, posts: 1300 },
    { topic: "Micro-credentials", category: "Learning", trending: true, posts: 890 },
    { topic: "Online degree ROI", category: "Higher Ed", trending: false, posts: 520 },
    { topic: "Career transitions", category: "Career", trending: true, posts: 1050 },
    { topic: "Skill-building frameworks", category: "Learning", trending: false, posts: 690 },
    { topic: "Coding bootcamps", category: "Tech Education", trending: true, posts: 740 },
    { topic: "Remote learning best practices", category: "Online Learning", trending: false, posts: 450 },
  ],
  ecommerce: [
    { topic: "DTC brand building", category: "Business", trending: true, posts: 1100 },
    { topic: "Shopify app strategies", category: "Platforms", trending: false, posts: 620 },
    { topic: "Customer retention tactics", category: "Customer Success", trending: true, posts: 980 },
    { topic: "Influencer partnerships", category: "Marketing", trending: true, posts: 850 },
    { topic: "Supply chain optimization", category: "Operations", trending: false, posts: 540 },
    { topic: "Product photography tips", category: "Content", trending: true, posts: 710 },
    { topic: "Subscription model trends", category: "Business Model", trending: true, posts: 680 },
  ],
  marketing: [
    { topic: "AI copywriting tools", category: "Content", trending: true, posts: 1250 },
    { topic: "SEO algorithm updates", category: "SEO", trending: true, posts: 920 },
    { topic: "TikTok marketing 2024", category: "Social Media", trending: true, posts: 1300 },
    { topic: "Email open rates", category: "Email Marketing", trending: false, posts: 580 },
    { topic: "Brand authenticity", category: "Strategy", trending: true, posts: 1100 },
    { topic: "Community building", category: "Community", trending: true, posts: 890 },
    { topic: "Marketing analytics", category: "Data", trending: false, posts: 620 },
  ],
  startup: [
    { topic: "Seed funding strategies", category: "Fundraising", trending: true, posts: 1450 },
    { topic: "Product-market fit", category: "Growth", trending: false, posts: 750 },
    { topic: "SaaS metrics", category: "Metrics", trending: true, posts: 1050 },
    { topic: "Go-to-market strategy", category: "Growth", trending: false, posts: 820 },
    { topic: "Startup pivots", category: "Strategy", trending: true, posts: 680 },
    { topic: "Founder mental health", category: "Wellbeing", trending: true, posts: 920 },
    { topic: "Startup accelerators", category: "Funding", trending: false, posts: 540 },
  ],
  legal: [
    { topic: "AI regulation 2024", category: "Policy", trending: true, posts: 1100 },
    { topic: "Startup legal templates", category: "Startup Law", trending: true, posts: 780 },
    { topic: "GDPR compliance", category: "Privacy", trending: false, posts: 620 },
    { topic: "IP protection for creators", category: "IP", trending: true, posts: 890 },
    { topic: "Employment law updates", category: "Labor", trending: false, posts: 540 },
    { topic: "Contract best practices", category: "Contracts", trending: true, posts: 650 },
    { topic: "Legal tech tools", category: "Technology", trending: true, posts: 720 },
  ],
  hr: [
    { topic: "Remote work trends 2024", category: "Work Culture", trending: true, posts: 1500 },
    { topic: "Quiet quitting reality", category: "Trends", trending: true, posts: 1200 },
    { topic: "DEI initiatives", category: "Inclusion", trending: false, posts: 850 },
    { topic: "Employee retention strategies", category: "HR Strategy", trending: true, posts: 1050 },
    { topic: "Compensation benchmarking", category: "Compensation", trending: false, posts: 680 },
    { topic: "Leadership development", category: "Leadership", trending: true, posts: 920 },
    { topic: "Workplace mental health", category: "Wellbeing", trending: true, posts: 1100 },
  ],
  sustainability: [
    { topic: "Carbon neutrality goals", category: "Climate", trending: true, posts: 980 },
    { topic: "ESG investing trends", category: "Investing", trending: true, posts: 1150 },
    { topic: "Circular economy", category: "Economics", trending: true, posts: 820 },
    { topic: "Renewable energy trends", category: "Energy", trending: false, posts: 650 },
    { topic: "Sustainable fashion", category: "Fashion", trending: true, posts: 1300 },
    { topic: "Climate tech startups", category: "Tech", trending: true, posts: 890 },
    { topic: "Impact measurement", category: "Impact", trending: false, posts: 540 },
  ],
  creator: [
    { topic: "YouTube Shorts monetization", category: "Platforms", trending: true, posts: 1400 },
    { topic: "Newsletter growth hacks", category: "Email", trending: true, posts: 1100 },
    { topic: "Creator tax tips", category: "Business", trending: true, posts: 950 },
    { topic: "Patreon alternative platforms", category: "Monetization", trending: true, posts: 780 },
    { topic: "Content repurposing", category: "Strategy", trending: false, posts: 870 },
    { topic: "Audience engagement tactics", category: "Community", trending: true, posts: 1050 },
    { topic: "Creator burnout", category: "Wellbeing", trending: true, posts: 920 },
  ],
  other: [
    { topic: "Industry trends 2024", category: "Trends", trending: true, posts: 850 },
    { topic: "Case studies", category: "Stories", trending: false, posts: 620 },
    { topic: "Behind-the-scenes insights", category: "Content", trending: true, posts: 1000 },
    { topic: "Expert predictions", category: "Opinion", trending: false, posts: 540 },
    { topic: "Lessons learned", category: "Learning", trending: true, posts: 920 },
    { topic: "Industry news roundup", category: "News", trending: false, posts: 680 },
    { topic: "Hot takes", category: "Opinion", trending: true, posts: 1100 },
  ],
};

export function getTrendingTopicsForIndustry(industry: string, platform?: string): TrendingTopic[] {
  const topics = TRENDING_BY_INDUSTRY[industry] || TRENDING_BY_INDUSTRY.other;
  return rankTopics(topics, platform);
}

export function getTrendingTopicsCount(industry: string, platform?: string): { trending: number; total: number } {
  const topics = getTrendingTopicsForIndustry(industry, platform);
  const trending = topics.filter((t) => t.trending).length;
  return { trending, total: topics.length };
}

/**
 * Get last updated timestamp
 * In production, this would be the actual update time from the API
 */
export function getTrendingTopicsLastUpdated(): string {
  // Mock: always say "this week"
  return "Updated this week";
}
