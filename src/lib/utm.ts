// Build a UTM-tagged URL from a base URL + platform + campaign.

const PLATFORM_TO_UTM: Record<string, string> = {
  linkedin: "linkedin",
  "twitter/x": "twitter",
  twitter: "twitter",
  x: "twitter",
  instagram: "instagram",
  facebook: "facebook",
  newsletter: "newsletter",
  blog: "blog",
};

export function utmSource(platform?: string | null): string {
  const k = (platform || "").toLowerCase().trim();
  return PLATFORM_TO_UTM[k] || k.replace(/[^a-z0-9]+/g, "-") || "social";
}

export function utmCampaignSlug(s: string): string {
  return (
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "calendar"
  );
}

export function buildTrackingUrl(
  base: string | null | undefined,
  platform?: string | null,
  campaign?: string | null
): string {
  const trimmed = String(base || "").trim();
  if (!trimmed) return "";
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return trimmed;
  }
  url.searchParams.set("utm_source", utmSource(platform));
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", utmCampaignSlug(campaign || "calendar"));
  return url.toString();
}
