export type GenerationAbortKind = "timeout" | "cancelled" | "other";

/**
 * Classify why a generation request ended, using the abort signal itself
 * (not the error type). Timeout and user cancel must never fall back to
 * local template posts.
 */
export function classifyGenerationAbort(
  signal: Pick<AbortSignal, "aborted" | "reason"> | null | undefined,
  _error?: unknown
): GenerationAbortKind {
  if (!signal || !signal.aborted) return "other";
  return signal.reason === "timeout" ? "timeout" : "cancelled";
}

export function generationAbortMessage(kind: GenerationAbortKind): string | null {
  if (kind === "timeout") return "Generation timed out. Please try again.";
  if (kind === "cancelled") return "Generation was cancelled.";
  return null;
}

/** Template fallback is only allowed for errors that are not timeout/cancel. */
export function allowsTemplateFallback(kind: GenerationAbortKind): boolean {
  return kind === "other";
}
