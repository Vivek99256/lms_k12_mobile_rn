import { feeView } from '../src/screens/student/feesModel';

const v = (total: number, paid: number, unpaid = total - paid) => feeView({ total, paid, unpaid });

describe('feeView', () => {
  it('shows the server balance as pending and the share paid', () => {
    const r = v(125000, 80000);
    expect(r).toMatchObject({ total: 125000, paid: 80000, pending: 45000, advance: 0, percent: 64, settled: false });
    expect(r.spoken).toBe('Total ₹1,25,000. Paid ₹80,000, 64 percent. Pending ₹45,000.');
  });

  it('uses the server unpaid figure as given, not its own subtraction', () => {
    expect(v(1000, 400, 700).pending).toBe(700);
  });

  it('fully paid: settled, 100 percent, nothing pending', () => {
    const r = v(5000, 5000);
    expect(r).toMatchObject({ pending: 0, advance: 0, percent: 100, settled: true });
    expect(r.spoken).toContain('No pending fees.');
  });

  it('overpaid: pending is clamped to 0, the excess is shown as paid in advance', () => {
    const r = v(5000, 6200);
    expect(r).toMatchObject({ pending: 0, advance: 1200, percent: 100, settled: true });
    expect(r.spoken).toContain('Paid in advance ₹1,200.');
  });

  it('never rounds up to 100 percent while something is still pending', () => {
    expect(v(100000, 99999).percent).toBe(99);
    expect(v(1000, 999.9).percent).toBe(99);
  });

  it('a tiny share stays 0, never negative paid', () => {
    expect(v(100000, 1).percent).toBe(0);
    expect(v(1000, -50, 1050).percent).toBe(0);
  });

  it('no bar when the total is not positive', () => {
    expect(v(0, 0).percent).toBeNull();
    expect(v(0, 0).settled).toBe(true);
    expect(v(0, 0).spoken).toBe('Total ₹0. Paid ₹0. No pending fees.');
  });

  it('keeps paise', () => {
    expect(v(1250.5, 250.25).spoken).toBe('Total ₹1,250.50. Paid ₹250.25, 20 percent. Pending ₹1,000.25.');
  });
});
