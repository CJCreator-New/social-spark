import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeToClipboard } from "../platformCopy";

describe("platformCopy — clipboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when navigator.clipboard.writeText succeeds", async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      configurable: true,
    });

    const result = await writeToClipboard("hello world");
    expect(result).toBe(true);
    expect(mockWriteText).toHaveBeenCalledWith("hello world");
  });

  it("falls back to execCommand when clipboard API throws", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });

    let selected = false;
    const mockExecCommand = vi.fn().mockImplementation(() => {
      selected = true;
      return true;
    });

    const ta = document.createElement("textarea");
    ta.value = "fallback text";
    vi.spyOn(document, "createElement").mockReturnValue(ta as HTMLTextAreaElement);
    vi.spyOn(ta, "select").mockImplementation(() => {
      selected = true;
    });
    vi.spyOn(document.body, "appendChild").mockImplementation(() => ta as HTMLTextAreaElement);
    vi.spyOn(document.body, "removeChild").mockImplementation(() => ta as HTMLTextAreaElement);

    (document as unknown as { execCommand: () => boolean }).execCommand = mockExecCommand;

    const result = await writeToClipboard("fallback text");
    expect(result).toBe(true);
    expect(mockExecCommand).toHaveBeenCalledWith("copy");
  });

  it("returns false when both clipboard and execCommand are unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });

    const ta = document.createElement("textarea");
    vi.spyOn(document, "createElement").mockReturnValue(ta as HTMLTextAreaElement);
    vi.spyOn(ta, "select").mockImplementation(() => {});
    vi.spyOn(document.body, "appendChild").mockImplementation(() => ta as HTMLTextAreaElement);
    vi.spyOn(document.body, "removeChild").mockImplementation(() => ta as HTMLTextAreaElement);

    (document as unknown as { execCommand: () => boolean }).execCommand = () => false;

    const result = await writeToClipboard("fail");
    expect(result).toBe(false);
  });

  it("does not crash on empty string", async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockWriteText },
      configurable: true,
    });

    const result = await writeToClipboard("");
    expect(result).toBe(true);
  });
});
