export interface ScopeDescription {
  title: string;
  description: string;
}

const KNOWN_SCOPES: Record<string, ScopeDescription> = {
  "read:calendars": {
    title: "See your content calendars",
    description: "View the calendars you have saved, including their posts and dates.",
  },
  "read:scheduled_posts": {
    title: "See your scheduled posts",
    description: "View which posts you have scheduled and when they are due.",
  },
  "generate:ideas": {
    title: "Create post ideas for you",
    description: "Generate new post ideas using your account and its generation allowance.",
  },
  "generate:repurpose": {
    title: "Rewrite content for other platforms",
    description: "Turn existing content into new posts using your account and its allowance.",
  },
  "read:trends": {
    title: "See trending topics (currently unavailable)",
    description:
      "Trend data is currently unavailable, so approving this does not give access to anything yet.",
  },
};

/** Maps a raw OAuth scope string to plain-language text for the consent screen. */
export function describeScope(scope: string): ScopeDescription {
  const known = Object.prototype.hasOwnProperty.call(KNOWN_SCOPES, scope)
    ? KNOWN_SCOPES[scope]
    : undefined;
  if (known) return known;
  return {
    title: `Other access requested: ${scope}`,
    description: "This permission is not one we recognise. Only approve it if you trust the app.",
  };
}
