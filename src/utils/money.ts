/**
 * Indian rupee formatting: "₹1,25,000", "₹1,250.50". No Intl dependency (Hermes builds can lack locale data).
 * Works from integer paise so float noise (0.1 + 0.2) never shows; ".00" is dropped. Anything that is not a
 * finite, safely representable number gives "—" rather than a made-up amount.
 */
export function formatInr(amount: number): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  const paise = Math.round(Math.abs(amount) * 100);
  if (!Number.isSafeInteger(paise)) return '—';
  const rupees = String(Math.floor(paise / 100));
  const frac = paise % 100;
  const head = rupees.slice(0, -3);
  const tail = rupees.slice(-3);
  const grouped = head ? `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}` : tail;
  const cents = frac === 0 ? '' : `.${String(frac).padStart(2, '0')}`;
  return `${amount < 0 && paise > 0 ? '-' : ''}₹${grouped}${cents}`;
}
