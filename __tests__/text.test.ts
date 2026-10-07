import { stripHtml } from '../src/utils/text';

describe('stripHtml', () => {
  it('leaves plain text unchanged and gives an empty string for non-strings', () => {
    expect(stripHtml('What is 2 + 2?')).toBe('What is 2 + 2?');
    for (const v of [null, undefined, 5, {}, [], '']) expect(stripHtml(v)).toBe('');
  });

  it('removes tags (the question-text case)', () => {
    expect(stripHtml('<p>What is <b>2+2</b>?</p>')).toBe('What is 2+2?');
    expect(stripHtml('<span style="color:red">Red</span> <a href="https://x.example">link</a>')).toBe('Red link');
  });

  it('turns block tags into line breaks and list items into bullets', () => {
    expect(stripHtml('<p>one</p><p>two</p>')).toBe('one\ntwo');
    expect(stripHtml('a<br>b<br/>c<BR />d')).toBe('a\nb\nc\nd');
    expect(stripHtml('<ul><li>x</li><li>y</li></ul>')).toBe('• x\n• y');
  });

  it('removes script and style blocks together with their content, including an unclosed one', () => {
    expect(stripHtml('<script>alert(1)</script>Hi')).toBe('Hi');
    expect(stripHtml('A<style>p{color:red}</style>B')).toBe('A B');
    expect(stripHtml('Hello <script>evil()')).toBe('Hello');
    expect(stripHtml('<SCRIPT type="text/javascript">x</SCRIPT>ok')).toBe('ok');
  });

  it('decodes entities after the tags are gone: an encoded tag stays visible text, never markup', () => {
    expect(stripHtml('Tom &amp; Jerry &lt;3 &quot;q&quot; &#39;s&#39; &#x41; &nbsp;z')).toBe('Tom & Jerry <3 "q" \'s\' A z');
    expect(stripHtml('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('<script>alert(1)</script>');
    expect(stripHtml('&lt;b&gt;bold&lt;/b&gt;')).toBe('<b>bold</b>');
  });

  it('keeps unknown entities and control-character entities exactly as written', () => {
    expect(stripHtml('x &foo; y')).toBe('x &foo; y');
    expect(stripHtml('a &#7; b')).toBe('a &#7; b');
    expect(stripHtml('a &#9999999; b')).toBe('a &#9999999; b');
  });

  it('collapses spaces and runs of blank lines, and trims', () => {
    expect(stripHtml('  a   b  ')).toBe('a b');
    expect(stripHtml('<p>a</p><p></p><p></p><p></p><p>b</p>')).toBe('a\n\nb');
  });

  it('cuts very long input and stays fast on adversarial input', () => {
    const started = Date.now();
    expect(stripHtml('x'.repeat(50_000)).length).toBeLessThanOrEqual(20_000);
    stripHtml('<'.repeat(10_000));
    stripHtml('<p'.repeat(10_000));
    stripHtml('&#'.repeat(10_000));
    stripHtml('<script>'.repeat(2_000));
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
