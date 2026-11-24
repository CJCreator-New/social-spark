/**
 * Step 3 is the in-flight "generating" screen. After a reload nothing is in
 * flight, so return to step 2 (or step 4 when posts already exist).
 */
export function clampRestoredStep(step: number, hasPosts: boolean): number {
  if (step === 3) return hasPosts ? 4 : 2;
  return step;
}
