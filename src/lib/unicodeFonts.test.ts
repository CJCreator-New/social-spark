import { describe, it, expect } from 'vitest'
import { applyStyle, FontStyle, generatePreviewSamples } from './unicodeFonts'

describe('unicodeFonts', () => {
  it('applies bold serif mapping for letters and digits', () => {
    const input = 'AZaz09'
    const out = applyStyle(input, FontStyle.BoldSerif)
    expect(out.length).toBeGreaterThan(input.length - 1)
    // Ensure letters changed
    expect(out[0]).not.toBe('A')
    expect(out[1]).not.toBe('Z')
  })

  it('leaves characters unchanged for None style', () => {
    const s = 'Hello 123!'
    expect(applyStyle(s, FontStyle.None)).toBe(s)
  })

  it('leaves punctuation and non-ascii characters unchanged', () => {
    const input = 'Hello, мир! 123 — test.'
    const out = applyStyle(input, FontStyle.Italic)

    expect(out.includes(',')).toBe(true)
    expect(out.includes('мир')).toBe(true)
    expect(out.includes('—')).toBe(true)
  })

  it('supports additional style families', () => {
    expect(applyStyle('Ab12', FontStyle.BoldItalic)).not.toBe('Ab12')
    expect(applyStyle('Ab12', FontStyle.Monospace)).not.toBe('Ab12')
    expect(applyStyle('Ab12', FontStyle.SansSerifBold)).not.toBe('Ab12')
    expect(applyStyle('Ab12', FontStyle.DoubleStruck)).not.toBe('Ab12')
  })

  it('generates preview samples', () => {
    const samples = generatePreviewSamples()
    expect(Object.keys(samples)).toEqual(expect.arrayContaining(Object.values(FontStyle)))
    expect(typeof samples[FontStyle.BoldSerif]).toBe('string')
  })
})
