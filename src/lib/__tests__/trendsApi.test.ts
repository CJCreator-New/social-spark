import { describe, it, expect } from 'vitest';
import { getTrends } from '../trendsApi';

const mockFetch = async () => ({
  ok: true,
  json: async () => ({ meta: { page: 1, limit: 25, total: 0 }, data: [] }),
}) as Response;

global.fetch = mockFetch as typeof fetch;

describe('trendsApi', () => {
  it('fetches trends', async () => {
    const res = await getTrends({ q: 'ai' });
    expect(res).toHaveProperty('meta');
    expect(res.data).toBeInstanceOf(Array);
  });
});
