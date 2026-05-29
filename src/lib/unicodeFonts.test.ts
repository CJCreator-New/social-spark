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

  it('generates preview samples', () => {
    const samples = generatePreviewSamples()
    expect(Object.keys(samples).length).toBeGreaterThan(0)
    expect(typeof samples[FontStyle.BoldSerif]).toBe('string')
  })
})
