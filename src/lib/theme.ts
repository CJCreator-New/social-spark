/**
 * Single source of truth for warm-editorial hex values needed outside CSS
 * (third-party SDK themes, canvas/chart fills, inline SVG). Keep these in
 * sync with the HSL tokens in src/index.css and src/styles/tokens.css —
 * this file exists only because some consumers can't read CSS custom
 * properties (e.g. the Razorpay checkout SDK).
 */
export const WARM_PALETTE = {
  primary: "#c2410c",
  primaryHover: "#9a3412",
  background: "#faf8f4",
  surface: "#ffffff",
  surfaceMuted: "#f5f0e8",
  text: "#1c1917",
  textSecondary: "#57534e",
  textMuted: "#78716c",
  border: "#e7e5e4",
  scoreHigh: "#15803d",
  scoreGold: "#ffd700",
  scoreMed: "#b45309",
  scoreLow: "#b91c1c",
  checkout: "#c2410c",
} as const;

export type WarmPaletteKey = keyof typeof WARM_PALETTE;
