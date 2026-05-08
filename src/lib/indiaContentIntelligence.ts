/**
 * India-specific content intelligence for enhancing prompts with regional context
 */

export interface IndiaTrend {
  topic: string;
  region: string; // North, South, East, West, Central, or "National"
  relevance: number; // 1-10, how relevant for social content
  hashtags: string[];
  context: string; // Brief explanation of why it's trending
}

export interface FestivalInfo {
  name: string;
  date: string; // Approximate date or period
  significance: string;
  hashtags: string[];
  contentIdeas: string[];
}

export interface CulturalReference {
  term: string;
  meaning: string;
  usage: string; // How to use in content
  region?: string;
}

// Current trending topics in India (2024-2025)
export const INDIA_TRENDS: IndiaTrend[] = [
  {
    topic: "Digital India 2.0",
    region: "National",
    relevance: 9,
    hashtags: ["#DigitalIndia", "#ModiVision", "#DigitalTransformation"],
    context: "Government's push for digital adoption in rural and urban areas"
  },
  {
    topic: "Startups in Tier-2 cities",
    region: "National",
    relevance: 8,
    hashtags: ["#StartupIndia", "#Tier2Startups", "#Entrepreneurship"],
    context: "Growing ecosystem in cities like Jaipur, Lucknow, Coimbatore"
  },
  {
    topic: "Electric vehicle adoption",
    region: "National",
    relevance: 8,
    hashtags: ["#EVMobility", "#ElectricVehicles", "#SustainableIndia"],
    context: "Government incentives and Ola, Tata dominance in EV market"
  },
  {
    topic: "Work-life balance in Indian IT",
    region: "National",
    relevance: 7,
    hashtags: ["#WorkLifeBalance", "#ITIndustry", "#BurnoutPrevention"],
    context: "Post-pandemic focus on employee wellbeing"
  },
  {
    topic: "Farmers' protests legacy",
    region: "North",
    relevance: 6,
    hashtags: ["#FarmersRights", "#MSP", "#AgriculturalReforms"],
    context: "Ongoing discussions about farmer welfare and policy changes"
  },
  {
    topic: "South Indian cinema OTT",
    region: "South",
    relevance: 8,
    hashtags: ["#SouthCinema", "#OTTRevolution", "#RegionalCinema"],
    context: "Rise of regional language content on streaming platforms"
  },
  {
    topic: "Bengaluru tech layoffs",
    region: "South",
    relevance: 7,
    hashtags: ["#TechLayoffs", "#JobMarket", "#CareerTransition"],
    context: "Industry adjustments affecting thousands of professionals"
  },
  {
    topic: "Mumbai real estate bubble",
    region: "West",
    relevance: 6,
    hashtags: ["#RealEstate", "#MumbaiProperty", "#HousingCrisis"],
    context: "Skyrocketing prices and affordability concerns"
  },
  {
    topic: "Ahmedabad smart city initiatives",
    region: "West",
    relevance: 7,
    hashtags: ["#SmartCities", "#Ahmedabad", "#UrbanDevelopment"],
    context: "Gujarat's model for urban transformation"
  },
  {
    topic: "Kolkata cultural renaissance",
    region: "East",
    relevance: 6,
    hashtags: ["#KolkataCulture", "#BengaliHeritage", "#CulturalRevival"],
    context: "Revival of arts, literature, and cultural institutions"
  },
  {
    topic: "Odisha tribal tourism",
    region: "East",
    relevance: 5,
    hashtags: ["#TribalTourism", "#Odisha", "#CulturalTourism"],
    context: "Growing interest in indigenous cultures and experiences"
  },
  {
    topic: "Bhopal lake conservation",
    region: "Central",
    relevance: 6,
    hashtags: ["#LakeConservation", "#Bhopal", "#EnvironmentalProtection"],
    context: "Efforts to save Upper Lake and promote eco-tourism"
  }
];

// Upcoming festivals and cultural events (2025-2026)
export const INDIA_FESTIVALS: FestivalInfo[] = [
  {
    name: "Diwali",
    date: "October-November",
    significance: "Festival of lights, victory of good over evil",
    hashtags: ["#Diwali", "#Deepavali", "#FestivalOfLights"],
    contentIdeas: [
      "Business growth and prosperity themes",
      "Family traditions and modern celebrations",
      "Lighting up communities and overcoming darkness"
    ]
  },
  {
    name: "Holi",
    date: "March",
    significance: "Festival of colors celebrating spring",
    hashtags: ["#Holi", "#FestivalOfColors", "#SpringFestival"],
    contentIdeas: [
      "Team building and workplace celebrations",
      "Renewal and fresh starts",
      "Cultural diversity in organizations"
    ]
  },
  {
    name: "Durga Puja",
    date: "September-October",
    significance: "Celebration of Goddess Durga's victory",
    hashtags: ["#DurgaPuja", "#BengaliFestival", "#Navratri"],
    contentIdeas: [
      "Strength and resilience in business",
      "Community celebrations and social bonds",
      "Traditional values in modern contexts"
    ]
  },
  {
    name: "Ganesh Chaturthi",
    date: "August-September",
    significance: "Celebration of Lord Ganesha",
    hashtags: ["#GaneshChaturthi", "#LordGanesha", "#Festival"],
    contentIdeas: [
      "Wisdom and new beginnings",
      "Removing obstacles in career/business",
      "Community service and social responsibility"
    ]
  },
  {
    name: "Republic Day",
    date: "January 26",
    significance: "Constitution of India",
    hashtags: ["#RepublicDay", "#26January", "#IndianConstitution"],
    contentIdeas: [
      "Democratic values in organizations",
      "National unity and diversity",
      "Constitutional principles in business"
    ]
  }
];

// Cultural references for content enhancement
export const INDIA_CULTURAL_REFERENCES: CulturalReference[] = [
  {
    term: "Jugaad",
    meaning: "Innovative, frugal problem-solving",
    usage: "Emphasize resourcefulness and innovation",
    region: "National"
  },
  {
    term: "Namaste",
    meaning: "Greeting of respect and humility",
    usage: "Cultural greetings and respectful communication",
    region: "National"
  },
  {
    term: "Dharma",
    meaning: "Duty, righteousness, moral order",
    usage: "Ethical business practices and social responsibility",
    region: "National"
  },
  {
    term: "Karma",
    meaning: "Action and consequence",
    usage: "Cause and effect in business decisions",
    region: "National"
  },
  {
    term: "Guru",
    meaning: "Teacher, mentor, expert",
    usage: "Leadership and knowledge sharing",
    region: "National"
  },
  {
    term: "Satsanga",
    meaning: "Company of truth, spiritual gathering",
    usage: "Team alignment and shared values",
    region: "National"
  },
  {
    term: "Puja",
    meaning: "Ritual worship and respect",
    usage: "Showing reverence for traditions and values",
    region: "National"
  }
];

export function getIndiaTrendsForRegion(region: string): IndiaTrend[] {
  if (region === "National") return INDIA_TRENDS;
  return INDIA_TRENDS.filter(trend => trend.region === region || trend.region === "National");
}

export function getUpcomingFestivals(): FestivalInfo[] {
  return INDIA_FESTIVALS;
}

export function getCulturalReferences(): CulturalReference[] {
  return INDIA_CULTURAL_REFERENCES;
}

export function isIndiaSpecificTopic(topic: string): boolean {
  const indiaKeywords: string[] = [
    "india", "indian", "hindu", "bharat", "bharatiya", "desi",
    "ayushman", "modi", "gandhi", "mahatma", "sardar", "sardarji",
    "bollywood", "cricket", "ipl", "kohli", "dhoni", "rohit",
    "taj mahal", "red fort", "india gate", "gateway of india",
    "diwali", "holi", "durga puja", "ganesh chaturthi",
    "ramadan", "eid", "christmas", "pongal", "baisakhi"
  ];

  const lowerTopic = topic.toLowerCase();
  return indiaKeywords.some((keyword: string) => lowerTopic.includes(keyword));
}</content>
<parameter name="filePath">C:\Users\HP\OneDrive\Desktop\Projects\VS Code\social-spark\src\lib\indiaContentIntelligence.ts