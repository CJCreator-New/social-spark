import { describe, it, expect } from 'vitest';
import { getTrends } from '../trendsApi';

global.fetch = (url: string) => {
  return Promise.resolve({ ok: true, json: () => Promise.resolve({ meta: { page:1, limit:25, total:0 }, data: [] }) } as any);
};

describe('trendsApi', () => {
  it('fetches trends', async () => {
    const res = await getTrends({ q: 'ai' });
    expect(res).toHaveProperty('meta');
    expect(res.data).toBeInstanceOf(Array);
  });
});
