// unicodeFonts.ts — generate mapping tables and apply Unicode font styles
export enum FontStyle {
  None = "none",
  BoldSerif = "boldSerif",
  Italic = "italic",
  BoldItalic = "boldItalic",
  Script = "script",
  BoldScript = "boldScript",
  Fraktur = "fraktur",
  DoubleStruck = "doubleStruck",
  Monospace = "monospace",
  SansSerifBold = "sansSerifBold",
}

type Range = { upper?: number; lower?: number; digit?: number | null };

const RANGES: Record<FontStyle, Range> = {
  [FontStyle.None]: {},
  [FontStyle.BoldSerif]: { upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7d8 },
  [FontStyle.Italic]: { upper: 0x1d434, lower: 0x1d44e, digit: null },
  [FontStyle.BoldItalic]: { upper: 0x1d468, lower: 0x1d482, digit: 0x1d7ec },
  [FontStyle.Script]: { upper: 0x1d49c, lower: 0x1d4b6, digit: null },
  [FontStyle.BoldScript]: { upper: 0x1d4d0, lower: 0x1d4ea, digit: null },
  [FontStyle.Fraktur]: { upper: 0x1d504, lower: 0x1d51e, digit: null },
  [FontStyle.DoubleStruck]: { upper: 0x1d538, lower: 0x1d552, digit: 0x1d7d8 },
  [FontStyle.Monospace]: { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
  [FontStyle.SansSerifBold]: { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ce },
};

function generateMapFor(style: FontStyle): Record<string, string> {
  const out: Record<string, string> = {};
  const r = RANGES[style];
  if (!r) return out;

  if (r.upper) {
    for (let i = 0; i < 26; i++) {
      out[String.fromCharCode(65 + i)] = String.fromCodePoint(r.upper + i);
    }
  }
  if (r.lower) {
    for (let i = 0; i < 26; i++) {
      out[String.fromCharCode(97 + i)] = String.fromCodePoint(r.lower + i);
    }
  }
  if (typeof r.digit === "number" && r.digit !== null) {
    for (let i = 0; i < 10; i++) {
      out[String.fromCharCode(48 + i)] = String.fromCodePoint(r.digit + i);
    }
  }
  return out;
}

const STYLE_MAPS: Record<FontStyle, Record<string, string>> = (Object.keys(RANGES) as FontStyle[]).reduce((acc, s) => {
  acc[s] = generateMapFor(s);
  return acc;
}, {} as Record<FontStyle, Record<string, string>>);

export function applyStyle(text: string, style: FontStyle): string {
  if (!text || style === FontStyle.None) return text;
  const map = STYLE_MAPS[style] || {};
  // Use code-point aware iteration
  const out: string[] = [];
  for (const ch of Array.from(text)) {
    out.push(map[ch] ?? ch);
  }
  return out.join("");
}

export function generatePreviewSamples() {
  const sample = "AaBbCcXxYyZz012345";
  const result: Record<string, string> = {};
  for (const s of Object.values(FontStyle)) {
    result[s] = applyStyle(sample, s as FontStyle);
  }
  return result;
}

export default {
  FontStyle,
  applyStyle,
  generatePreviewSamples,
};
