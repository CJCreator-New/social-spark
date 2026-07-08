declare const Deno: any;

// Edge function: fetch-url-content
// Accepts: { url: string }
// Returns: { text: string; title: string; wordCount: number }
// Fetches a URL server-side, strips HTML tags, truncates to 8000 chars for AI
// processing. Requires auth, rate-limits callers, and blocks SSRF against
// private/loopback/link-local networks (including the cloud metadata
// endpoint at 169.254.169.254).
import {
  getCorsHeaders,
  jsonResponse,
  errorResponse,
  checkRateLimit,
  checkContentLength,
  getVerifiedUserId,
} from "../_shared/promptHelpers.ts";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
const FETCH_TIMEOUT_MS = 8_000;
const MAX_TEXT_CHARS = 8_000;

// ─── SSRF PROTECTION ────────────────────────────────────────────────────────

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (incl. cloud metadata 169.254.169.254)
  if (a === 0) return true; // 0.0.0.0/8
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1") return true; // loopback
  if (normalized === "::") return true; // unspecified
  // fc00::/7 (unique local addresses)
  const firstGroup = normalized.split(":")[0];
  if (firstGroup.length >= 2) {
    const firstByte = parseInt(firstGroup.slice(0, 2), 16);
    if (!Number.isNaN(firstByte) && firstByte >= 0xfc && firstByte <= 0xfd) return true;
  }
  // fe80::/10 (link-local)
  if (/^fe[89ab]/.test(firstGroup)) return true;
  // IPv4-mapped IPv6 addresses (::ffff:a.b.c.d) — check the embedded IPv4.
  const mappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedMatch) return isPrivateIPv4(mappedMatch[1]);
  return false;
}

function isDisallowedHostLiteral(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isPrivateIPv4(host);
  if (host.includes(":")) return isPrivateIPv6(host);
  return false;
}

/**
 * Resolves the hostname's DNS records and checks every returned address
 * against the private/loopback/link-local ranges, so an attacker can't bypass
 * the literal-hostname check with a domain that resolves to an internal IP
 * (DNS rebinding / metadata-endpoint aliasing).
 */
async function hostnameResolvesToPrivateIp(hostname: string): Promise<boolean> {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(":")) {
    // Already a literal IP — handled by isDisallowedHostLiteral.
    return false;
  }
  const lookups: Array<Promise<string[]>> = [
    Deno.resolveDns(hostname, "A").catch(() => [] as string[]),
    Deno.resolveDns(hostname, "AAAA").catch(() => [] as string[]),
  ];
  try {
    const [aRecords, aaaaRecords] = await Promise.all(lookups);
    const addresses = [...aRecords, ...aaaaRecords];
    if (addresses.length === 0) return false; // couldn't resolve — let fetch() surface the error
    return addresses.some((ip) => isPrivateIPv4(ip) || isPrivateIPv6(ip));
  } catch {
    // DNS resolution failing entirely is not itself an SSRF signal — allow
    // the subsequent fetch() to fail naturally with a network error.
    return false;
  }
}

async function assertUrlIsSafe(parsed: URL): Promise<string | null> {
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http:// and https:// URLs are supported.";
  }
  if (isDisallowedHostLiteral(parsed.hostname)) {
    return "This URL points to a private or internal network address and cannot be fetched.";
  }
  if (await hostnameResolvesToPrivateIp(parsed.hostname)) {
    return "This URL resolves to a private or internal network address and cannot be fetched.";
  }
  return null;
}

// ─── RESPONSE-SIZE-CAPPED FETCH ─────────────────────────────────────────────

async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let out = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > maxBytes) {
        // Decode only up to the cap, then stop reading further chunks.
        const allowed = value.byteLength - (received - maxBytes);
        if (allowed > 0) out += decoder.decode(value.slice(0, allowed), { stream: false });
        break;
      }
      out += decoder.decode(value, { stream: true });
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  return out;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const contentLengthError = checkContentLength(req);
  if (contentLengthError) return contentLengthError;

  try {
    // ── Auth ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const userId = await getVerifiedUserId(token);
    if (!userId) return jsonResponse({ error: "Sign in required." }, 401);

    // ── Rate limiting ───────────────────────────────────────────────────
    const rateLimitCheck = await checkRateLimit(userId, "fetch-url-content", {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });
    if (!rateLimitCheck.allowed) {
      return jsonResponse({ error: "Rate limit exceeded. Please try again shortly." }, 429);
    }

    const body = await req.json().catch(() => null);
    const url = body && typeof body.url === "string" ? body.url.trim() : "";
    if (!url || !URL.canParse(url)) {
      return jsonResponse({ error: "Invalid URL" }, 400);
    }

    const parsed = new URL(url);
    const safetyError = await assertUrlIsSafe(parsed);
    if (safetyError) {
      return jsonResponse({ error: safetyError }, 400);
    }

    // Redirects are followed manually (rather than `redirect: "follow"`) so
    // every hop's target is SSRF-validated *before* it is fetched — a server
    // could otherwise 302 an initially-safe URL to a private/metadata address
    // and have Deno follow it before any check ran.
    const MAX_REDIRECTS = 5;
    let currentUrl = parsed;
    let res: Response | null = null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        res = await fetch(currentUrl.toString(), {
          headers: { "User-Agent": "SocialSpark/1.0 (content summarizer)" },
          redirect: "manual",
          signal: controller.signal,
        });

        const isRedirect = res.status >= 300 && res.status < 400;
        if (!isRedirect) break;

        const location = res.headers.get("location");
        if (!location) break;
        const nextUrl = new URL(location, currentUrl);
        const redirectSafetyError = await assertUrlIsSafe(nextUrl);
        if (redirectSafetyError) {
          clearTimeout(timeout);
          return jsonResponse({ error: redirectSafetyError }, 400);
        }
        currentUrl = nextUrl;
        if (hop === MAX_REDIRECTS) {
          clearTimeout(timeout);
          return jsonResponse({ error: "Too many redirects." }, 502);
        }
      }
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
        return jsonResponse({ error: "The request to that URL timed out." }, 504);
      }
      return jsonResponse({ error: "Failed to fetch that URL." }, 502);
    }
    clearTimeout(timeout);

    if (!res || !res.ok) {
      return jsonResponse({ error: `Failed to fetch URL: ${res?.status ?? "unknown"}` }, 502);
    }

    const finalUrl = currentUrl;
    const html = await readBodyCapped(res, MAX_RESPONSE_BYTES);

    // Strip HTML tags
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT_CHARS);

    // Try to extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : finalUrl.hostname;

    return jsonResponse({
      text,
      title,
      wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
    });
  } catch (e) {
    return errorResponse("fetch-url-content", e);
  }
});
