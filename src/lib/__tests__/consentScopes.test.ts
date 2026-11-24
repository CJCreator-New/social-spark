import { describe, it, expect } from "vitest";
import { describeScope } from "../consentScopes";

describe("describeScope", () => {
  it("returns plain-language titles for known scopes", () => {
    for (const s of ["read:calendars", "read:scheduled_posts", "generate:ideas", "generate:repurpose"]) {
      const d = describeScope(s);
      expect(d.title).not.toContain(":");
      expect(d.title.length).toBeGreaterThan(5);
      expect(d.description.length).toBeGreaterThan(10);
    }
  });

  it("falls back for unknown scopes", () => {
    expect(describeScope("write:everything").title).toBe(
      "Other access requested: write:everything"
    );
  });

  it("does not treat prototype keys as known scopes", () => {
    expect(describeScope("constructor").title).toBe("Other access requested: constructor");
  });

  it("says read:trends is unavailable", () => {
    const d = describeScope("read:trends");
    expect(`${d.title} ${d.description}`.toLowerCase()).toContain("unavailable");
  });
});
