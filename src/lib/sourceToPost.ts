export const URL_TEXT_MAX_CHARS = 20000;
export const MIN_ANGLES = 3;

export interface AngleNotice {
  kind: 'ok' | 'few' | 'none';
  message: string;
}

/** Tells the user how many angles the source gave and what to do if few. */
export function noticeForAngles(count: number): AngleNotice {
  if (count <= 0) {
    return {
      kind: 'none',
      message:
        'Found 0 angles. This source did not have enough distinct material. Try a longer or more detailed source.',
    };
  }
  if (count < MIN_ANGLES) {
    return {
      kind: 'few',
      message: `Found ${count} ${count === 1 ? 'angle' : 'angles'}. This source only had a little distinct material. Retry, or add more text for more angles.`,
    };
  }
  return { kind: 'ok', message: `Found ${count} angles.` };
}

/** Returns a notice when the fetched article was cut to the character limit. */
export function noticeForTruncation(truncated: boolean | undefined): string | null {
  if (!truncated) return null;
  return `This article was long, so it was shortened to ${URL_TEXT_MAX_CHARS.toLocaleString('en-US')} characters.`;
}
