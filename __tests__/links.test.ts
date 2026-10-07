import { isSafeHttpUrl, splitLinks } from '../src/utils/links';

const urls = (t: string) => splitLinks(t).filter((p) => p.url).map((p) => p.url);
const joined = (t: string) => splitLinks(t).map((p) => p.text).join('');

describe('isSafeHttpUrl', () => {
  it('accepts http and https URLs with a host', () => {
    for (const ok of ['https://example.com', 'http://example.com/a?b=1#c', 'https://sub.example.co.in:8443/x', 'HTTPS://EXAMPLE.COM/X']) {
      expect(isSafeHttpUrl(ok)).toBe(true);
    }
  });

  it('refuses every other scheme', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<b>x</b>', 'intent://x#Intent;end', 'tel:+911234567890', 'file:///etc/passwd', 'ftp://example.com', 'mailto:a@b.com', 'sms:123', 'content://x', 'market://details?id=x', 'whatsapp://send?text=x']) {
      expect(isSafeHttpUrl(bad)).toBe(false);
    }
  });

  it('refuses credentials in the URL, missing hosts, whitespace and absurd lengths', () => {
    expect(isSafeHttpUrl('https://user:pw@evil.example.com/')).toBe(false);
    expect(isSafeHttpUrl('https://erp.triz.co.in@evil.example.com/')).toBe(false);
    expect(isSafeHttpUrl('https://')).toBe(false);
    expect(isSafeHttpUrl('https:///path')).toBe(false);
    expect(isSafeHttpUrl('https://exa mple.com')).toBe(false);
    expect(isSafeHttpUrl(`https://example.com/${'a'.repeat(2100)}`)).toBe(false);
  });
});

describe('splitLinks', () => {
  it('splits a sentence around a link and keeps the trailing full stop out of it', () => {
    expect(splitLinks('See https://school.example/fees.')).toEqual([
      { text: 'See ' },
      { text: 'https://school.example/fees', url: 'https://school.example/fees' },
      { text: '.' },
    ]);
  });

  it('strips trailing punctuation and brackets but keeps query strings', () => {
    expect(urls('(https://a.example/x?y=1&z=2), then https://b.example!')).toEqual(['https://a.example/x?y=1&z=2', 'https://b.example']);
  });

  it('never alters the text: the parts always join back to the original', () => {
    for (const t of ['plain', 'a https://x.example b', 'https://x.example', '(https://x.example).', 'javascript:alert(1) https://ok.example', 'http://u:p@evil.example/ x', '']) {
      expect(joined(t)).toBe(t);
    }
  });

  it('makes only safe http(s) links tappable', () => {
    expect(urls('javascript:alert(1)')).toEqual([]);
    expect(urls('call tel:+911234567890 or open intent://x')).toEqual([]);
    expect(urls('http://user:pw@evil.example/x')).toEqual([]);
    expect(urls('click https://erp.triz.co.in@evil.example/x now')).toEqual([]);
    expect(urls('both http://a.example and https://b.example')).toEqual(['http://a.example', 'https://b.example']);
  });

  it('returns no parts for empty text and one plain part for text without links', () => {
    expect(splitLinks('')).toEqual([]);
    expect(splitLinks('no links here')).toEqual([{ text: 'no links here' }]);
  });

  it('does not scan very long text, and stays fast on adversarial input', () => {
    const long = `https://a.example ${'x'.repeat(6000)}`;
    expect(splitLinks(long)).toEqual([{ text: long }]);
    const started = Date.now();
    splitLinks('http://'.repeat(700));
    splitLinks(`https://${'a'.repeat(4000)}`);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
