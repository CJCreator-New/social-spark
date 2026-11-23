import { describe, it, expect } from "vitest";
import {
  classifyGenerationAbort,
  allowsTemplateFallback,
  generationAbortMessage,
} from "../generationAbort";

function abortedSignal(reason: unknown) {
  const ac = new AbortController();
  ac.abort(reason);
  return ac.signal;
}

describe("classifyGenerationAbort", () => {
  it("classifies reason 'timeout' as timeout", () => {
    expect(classifyGenerationAbort(abortedSignal("timeout"), new Error("x"))).toBe("timeout");
  });
  it("classifies user cancel as cancelled", () => {
    expect(classifyGenerationAbort(abortedSignal("user"))).toBe("cancelled");
  });
  it("classifies a non-aborted signal as other", () => {
    expect(classifyGenerationAbort(new AbortController().signal, new Error("boom"))).toBe("other");
    expect(classifyGenerationAbort(null)).toBe("other");
  });
  it("never allows template fallback for timeout or cancel", () => {
    expect(allowsTemplateFallback("timeout")).toBe(false);
    expect(allowsTemplateFallback("cancelled")).toBe(false);
    expect(allowsTemplateFallback("other")).toBe(true);
  });
  it("has messages for timeout and cancel only", () => {
    expect(generationAbortMessage("timeout")).toMatch(/timed out/);
    expect(generationAbortMessage("cancelled")).toMatch(/cancelled/);
    expect(generationAbortMessage("other")).toBeNull();
  });
});
