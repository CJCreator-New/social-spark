import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyHashtagPolicy,
  cleanPayload,
  normalizePost,
} from "./promptHelpers.ts";

Deno.test("long-form platforms return empty hashtags", () => {
  assertEquals(applyHashtagPolicy("#ai #saas", "Newsletter", [], ["#brand"]), "");
  assertEquals(applyHashtagPolicy("#ai #saas", "Blog", [], ["#brand"]), "");
});

Deno.test("banned tags are stripped from generated hashtags", () => {
  assertEquals(
    applyHashtagPolicy("#AI #Spam #Growth", "LinkedIn", ["#spam"], []),
    "#ai #growth",
  );
});

Deno.test("required tags are appended when room is available", () => {
  assertEquals(
    applyHashtagPolicy("#ai #growth", "LinkedIn", [], ["#ContentForge"]),
    "#ai #growth #contentforge",
  );
});

Deno.test("cleanPayload applies defaults and normalizes policy lists", () => {
  assertEquals(cleanPayload(null), {
    industry: "",
    industryLabel: "",
    platform: "LinkedIn",
    coreIdea: "",
    audiences: [],
    voice: "",
    style: "",
    goals: [],
    topic: "",
    topics: [],
    dow: "Mon",
    date: "",
    format: "Balanced mix",
    cta: "Share & repost bait",
    length: "medium",
    structure: "mixed",
    extra: "",
    bannedWords: [],
    requiredWords: [],
    bannedHashtags: [],
    requiredHashtags: [],
  });

  assertEquals(
    cleanPayload({ bannedHashtags: ["Spam"], requiredHashtags: ["#Brand"] }),
    {
      industry: "",
      industryLabel: "",
      platform: "LinkedIn",
      coreIdea: "",
      audiences: [],
      voice: "",
      style: "",
      goals: [],
      topic: "",
      topics: [],
      dow: "Mon",
      date: "",
      format: "Balanced mix",
      cta: "Share & repost bait",
      length: "medium",
      structure: "mixed",
      extra: "",
      bannedWords: [],
      requiredWords: [],
      bannedHashtags: ["#spam"],
      requiredHashtags: ["#brand"],
    },
  );
});

Deno.test("normalizePost enforces hashtag policy", () => {
  const post = normalizePost(
    { hashtags: "#AI #Spam", title: "Title" },
    "Tue",
    { platform: "LinkedIn", bannedHashtags: ["#spam"], requiredHashtags: ["#brand"] },
  );

  assertEquals(post?.hashtags, "#ai #brand");
  assertEquals(post?.dow, "Tue");
});
