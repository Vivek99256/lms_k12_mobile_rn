export interface TextPart {
  text: string;
  /** Present only for a link that is safe to open. */
  url?: string;
}

// Scheme and host are required; user:password@ is refused (a classic phishing trick); length is capped.
const SAFE_URL = /^https?:\/\/[^\s/?#@]+(?:[/?#]\S*)?$/i;
const CANDIDATE = /https?:\/\/[^\s<>"']+/gi;
const TRAILING = /[.,;:!?)\]}]+$/;
const MAX_URL = 2048;
/** Longer text is shown as plain text: no link scanning on unexpectedly large input. */
const MAX_TEXT = 5000;

/** True only for an `http(s)://host…` URL without credentials. `javascript:`, `intent:`, `tel:`, `file:` … are never safe. */
export function isSafeHttpUrl(url: string): boolean {
  return url.length <= MAX_URL && SAFE_URL.test(url);
}

/**
 * Splits text into plain and link parts. Only `http(s)` URLs become links; trailing punctuation stays in
 * the plain text. The text itself is never altered, so joining the parts gives the original string.
 */
export function splitLinks(text: string): TextPart[] {
  if (!text) return [];
  if (text.length > MAX_TEXT) return [{ text }];
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(CANDIDATE)) {
    const start = m.index ?? 0;
    let url = m[0];
    const trailing = TRAILING.exec(url)?.[0] ?? '';
    if (trailing) url = url.slice(0, url.length - trailing.length);
    if (!isSafeHttpUrl(url)) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}
