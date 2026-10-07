import { formatInr } from '../src/utils/money';

describe('formatInr', () => {
  it.each([
    [0, '₹0'],
    [5, '₹5'],
    [999, '₹999'],
    [1000, '₹1,000'],
    [12345, '₹12,345'],
    [100000, '₹1,00,000'],
    [125000, '₹1,25,000'],
    [1234567, '₹12,34,567'],
    [123456789, '₹12,34,56,789'],
  ])('groups %p the Indian way', (n, out) => expect(formatInr(n)).toBe(out));

  it('shows paise only when present, always with two digits', () => {
    expect(formatInr(1250.5)).toBe('₹1,250.50');
    expect(formatInr(1250)).toBe('₹1,250');
    expect(formatInr(1250.0)).toBe('₹1,250');
    expect(formatInr(0.05)).toBe('₹0.05');
    expect(formatInr(123456789.5)).toBe('₹12,34,56,789.50');
  });

  it('works from paise, so float noise never shows', () => {
    expect(formatInr(0.1 + 0.2)).toBe('₹0.30');
    expect(formatInr(1.1 * 3)).toBe('₹3.30');
    expect(formatInr(19.999)).toBe('₹20');
  });

  it('marks negatives and never shows "-₹0"', () => {
    expect(formatInr(-1500)).toBe('-₹1,500');
    expect(formatInr(-0.001)).toBe('₹0');
  });

  it('refuses to invent an amount for unreadable input', () => {
    expect(formatInr(NaN)).toBe('—');
    expect(formatInr(Infinity)).toBe('—');
    expect(formatInr(-Infinity)).toBe('—');
    expect(formatInr(1e20)).toBe('—');
    expect(formatInr(null as unknown as number)).toBe('—');
    expect(formatInr('12' as unknown as number)).toBe('—');
  });
});
