import { FeeSummary } from '../../api/student';
import { formatInr } from '../../utils/money';

/** What the fees screen shows, derived from the server's three whole-year totals. Nothing is invented or re-added. */
export interface FeeView {
  total: number;
  paid: number;
  /** The server's balance, never shown negative. */
  pending: number;
  /** Paid above the total (the server's balance went negative); 0 otherwise. */
  advance: number;
  /** Whole percent paid for the bar, or null when the total is not positive. Never 100 while something is still pending. */
  percent: number | null;
  settled: boolean;
  /** One sentence for screen readers. */
  spoken: string;
}

export function feeView(s: FeeSummary): FeeView {
  const pending = Math.max(0, s.unpaid);
  const advance = Math.max(0, -s.unpaid);
  const settled = pending <= 0;
  let percent: number | null = null;
  if (s.total > 0) {
    const raw = Math.floor((Math.max(0, s.paid) / s.total) * 100);
    percent = settled ? 100 : Math.min(99, Math.max(0, raw));
  }
  const parts = [`Total ${formatInr(s.total)}.`, `Paid ${formatInr(s.paid)}${percent === null ? '' : `, ${percent} percent`}.`];
  parts.push(settled ? 'No pending fees.' : `Pending ${formatInr(pending)}.`);
  if (advance > 0) parts.push(`Paid in advance ${formatInr(advance)}.`);
  return { total: s.total, paid: s.paid, pending, advance, percent, settled, spoken: parts.join(' ') };
}
