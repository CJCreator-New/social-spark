import { describe, it, expect } from 'vitest';
import { errorMessageFromBody } from '../useFetchUrlContent';

describe('errorMessageFromBody', () => {
  it('uses the server error when present', () => {
    expect(errorMessageFromBody({ error: 'Rate limit exceeded.' }, 429)).toBe('Rate limit exceeded.');
  });
  it('falls back to message', () => {
    expect(errorMessageFromBody({ message: 'Nope' }, 400)).toBe('Nope');
  });
  it('uses a generic message otherwise', () => {
    expect(errorMessageFromBody(null, 502)).toContain('502');
    expect(errorMessageFromBody({ error: '  ' }, 500)).toContain('500');
  });
});
