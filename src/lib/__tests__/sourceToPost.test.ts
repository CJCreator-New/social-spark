import { describe, it, expect } from 'vitest';
import { noticeForAngles, noticeForTruncation } from '../sourceToPost';

describe('noticeForAngles', () => {
  it('reports none for 0', () => {
    const n = noticeForAngles(0);
    expect(n.kind).toBe('none');
    expect(n.message).toContain('Found 0 angles');
  });
  it('reports few for 1 and 2', () => {
    expect(noticeForAngles(1).kind).toBe('few');
    expect(noticeForAngles(1).message).toContain('Found 1 angle.');
    expect(noticeForAngles(2).kind).toBe('few');
    expect(noticeForAngles(2).message).toContain('Found 2 angles.');
  });
  it('reports ok for 3 and 10', () => {
    expect(noticeForAngles(3).kind).toBe('ok');
    expect(noticeForAngles(10).kind).toBe('ok');
  });
});

describe('noticeForTruncation', () => {
  it('returns the notice when truncated', () => {
    expect(noticeForTruncation(true)).toContain('20,000 characters');
  });
  it('returns null otherwise', () => {
    expect(noticeForTruncation(false)).toBeNull();
    expect(noticeForTruncation(undefined)).toBeNull();
  });
});
