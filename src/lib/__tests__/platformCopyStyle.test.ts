import { describe, it, expect } from 'vitest'
import { buildRawMarkdown, formatForPlatform, niceLabelFor, normalizeHashtags, resolvePlatform, stripMarkdown } from '@/lib/platformCopy'
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

  it('resolves and labels platforms consistently', () => {
    expect(resolvePlatform('Newsletter')).toBe('facebook')
    expect(resolvePlatform('LinkedIn')).toBe('linkedin')
    expect(resolvePlatform('X / Twitter')).toBe('twitter')
    expect(niceLabelFor('twitter')).toBe('X')
  })

  it('strips markdown and normalizes hashtags', () => {
    const text = '## Title\n\n**Bold** [link](https://example.com) `code`'
    expect(stripMarkdown(text)).toContain('Title')
    expect(stripMarkdown(text)).toContain('Bold')
    expect(stripMarkdown(text)).toContain('link (https://example.com)')
    expect(normalizeHashtags(['#AI', 'ai', 'growth!'], 2)).toEqual(['#AI', '#growth'])
  })

  it('builds raw markdown from the original post structure', () => {
    const raw = buildRawMarkdown({
      title: 'Weekly plan',
      hook: 'Open strong',
      body: 'Body text',
      cta: 'Reply now',
      hashtags: ['#One', '#Two'],
    })

    expect(raw).toContain('# Weekly plan')
    expect(raw).toContain('> Open strong')
    expect(raw).toContain('**CTA:** Reply now')
    expect(raw).toContain('#One #Two')
  })
})
