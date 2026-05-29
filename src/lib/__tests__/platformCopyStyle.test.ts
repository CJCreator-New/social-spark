import { describe, it, expect } from 'vitest'
import { formatForPlatform } from '@/lib/platformCopy'
import { FontStyle } from '@/lib/unicodeFonts'

describe('platformCopy style integration', () => {
  it('applies unicode style when options.style is provided', () => {
    const post = { title: '', hook: 'Hello', body: 'Alpha 123', cta: 'Go', hashtags: '' }
    const plain = formatForPlatform(post as any, 'LinkedIn')
    const styled = formatForPlatform(post as any, 'LinkedIn', { style: FontStyle.Monospace })
    expect(styled.text).not.toBe(plain.text)
    // Ensure plain alphabets are transformed (A should not be present)
    expect(styled.text.includes('A')).toBe(false)
  })
})
