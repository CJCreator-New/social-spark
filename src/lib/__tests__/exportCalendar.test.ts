import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { downloadMd } from "@/lib/exportCalendar";
import { FontStyle, applyStyle } from "@/lib/unicodeFonts";

describe("exportCalendar", () => {
  const createObjectURLMock = vi.fn(() => "blob:mock");
  const revokeObjectURLMock = vi.fn();
  let capturedBlob: Blob | null = null;

  beforeEach(() => {
    capturedBlob = null;
    vi.stubGlobal("URL", {
      createObjectURL: (blob: Blob) => {
        capturedBlob = blob;
        return createObjectURLMock();
      },
      revokeObjectURL: revokeObjectURLMock,
    } as unknown as typeof URL);
    vi.spyOn(document.body, "appendChild");
    vi.spyOn(document.body, "removeChild");
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      const el = document.createElementNS("http://www.w3.org/1999/xhtml", tagName);
      if (tagName === "a") {
        (el as HTMLAnchorElement).click = vi.fn();
      }
      return el as HTMLAnchorElement;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("styles markdown content while preserving markdown structure", async () => {
    downloadMd(
      {
        title: "Weekly Plan",
        industryLabel: "Marketing",
        platform: "LinkedIn",
        coreIdea: "AI launch",
      },
      [
        {
          day: 1,
          dow: "Mon",
          topic: "AI tools",
          format: "Balanced mix",
          title: "Start here",
          hook: "Open strong",
          body: "Body copy",
          cta: "Reply now",
          hashtags: "#AI #Growth",
          rationale: "Works because it is specific",
          image_prompt: "Cinematic key art of a founder at dusk.",
        },
      ],
      { style: FontStyle.BoldSerif }
    );

    expect(capturedBlob).not.toBeNull();
    const text = await capturedBlob!.text();
    expect(text).toContain("# ");
    expect(text).toContain("### Hook");
    expect(text).toContain(applyStyle("Weekly Plan", FontStyle.BoldSerif));
    expect(text).toContain(applyStyle("Start here", FontStyle.BoldSerif));
    expect(text).toContain(applyStyle("Open strong", FontStyle.BoldSerif));
    expect(text).toContain(applyStyle("Reply now", FontStyle.BoldSerif));
    expect(text).toContain(applyStyle("#AI #Growth", FontStyle.BoldSerif));
    expect(text).toContain(
      applyStyle("Cinematic key art of a founder at dusk.", FontStyle.BoldSerif)
    );
  });
});
