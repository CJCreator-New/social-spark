import crypto from 'crypto';

export function normalizeText(s: string) {
  return s
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/[’'`]/g, "'")
    .replace(/[^\p{L}\p{N}\s#@-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(s: string) {
  if (!s) return [];
  const parts = s.split(/\s+/).filter(Boolean);
  const uniq = Array.from(new Set(parts));
  return uniq.slice(0, 10);
}

export function computeDedupeHash(title: string, terms: string[]) {
  const canonical = `${title}|${terms.join(',')}`;
  return crypto.createHash('sha256').update(canonical).digest('hex');
}
