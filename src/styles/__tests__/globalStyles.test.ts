import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const css = readFileSync(resolve(__dirname, "../../index.css"), "utf8");
const tokens = readFileSync(resolve(__dirname, "../tokens.css"), "utf8");

describe("global styles (src/index.css)", () => {
  it("has a global :focus-visible ring", () => {
    expect(css).toMatch(/(^|\n)\s*:focus-visible\s*\{[^}]*outline:\s*2px solid/);
  });

  it("has a global prefers-reduced-motion rule", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it("has no linear-gradient inside the body token block", () => {
    const body = css.match(/(^|\n)\s*body\s*\{[^}]*\}/)?.[0] ?? "";
    expect(body).not.toBe("");
    expect(body).not.toMatch(/linear-gradient/);
  });

  it("keeps the shadcn accent separate from the page --accent alias", () => {
    expect(css).toMatch(/--accent-ui:/);
    expect(css).not.toMatch(/(^|\n)\s*--accent:/);
    expect(tokens).toMatch(/(^|\n)\s*--accent:\s*var\(--color-primary\)/);
  });
});
