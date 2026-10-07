/** Longer input is cut before processing: the text comes from a database field and is only ever shown, never executed. */
const MAX_HTML = 20_000;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(?:#(\d{1,6})|#x([0-9a-fA-F]{1,5})|([a-zA-Z]{2,6}));/g, (whole, dec: string, hex: string, name: string) => {
    if (name) return ENTITIES[name.toLowerCase()] ?? whole;
    const code = dec ? Number(dec) : parseInt(hex, 16);
    // Control characters and out-of-range values stay as they were written.
    return code >= 32 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
  });
}

/**
 * HTML (for example CKEditor question text) as plain text for a React Native `<Text>`.
 * Script and style blocks are removed with their content; block tags become line breaks, list items get a
 * bullet, every other tag is dropped, and entities are decoded **after** the tags are gone - so `&lt;b&gt;`
 * arrives as the visible characters `<b>`, never as markup. Nothing is rendered as HTML anywhere in the app.
 */
export function stripHtml(input: unknown): string {
  if (typeof input !== 'string' || !input) return '';
  const text = input
    .slice(0, MAX_HTML)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*$/gi, ' ') // an unclosed block
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|ul|ol|table|blockquote)\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
