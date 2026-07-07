export async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export type FetchOptions = RequestInit & { timeoutMs?: number };

export async function fetchWithRetry(url: string, opts: FetchOptions = {}, maxAttempts = 4) {
  let attempt = 0;
  const baseDelay = 300; // ms
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const controller = new AbortController();
      const timeout = opts.timeoutMs || 15000;
      const id = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(id);

      if (res.status === 429) {
        // rate limited — honor Retry-After header if present
        const ra = res.headers.get("Retry-After");
        const wait = ra ? Number(ra) * 1000 : baseDelay * Math.pow(2, attempt);
        await sleep(wait + Math.random() * 200);
        continue;
      }

      if (res.status >= 500) {
        const wait = baseDelay * Math.pow(2, attempt);
        await sleep(wait + Math.random() * 200);
        continue;
      }

      return res;
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      const wait = baseDelay * Math.pow(2, attempt);
      await sleep(wait + Math.random() * 200);
    }
  }
  throw new Error("fetchWithRetry: exhausted attempts");
}
