import { normalizeEnvelope } from '../src/api/envelope';
import { ApiError } from '../src/api/errors';

const kind = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as ApiError).kind;
  }
  return 'none';
};

describe('normalizeEnvelope', () => {
  it('accepts legacy and status_code success shapes', () => {
    expect(normalizeEnvelope({ status: '1', message: 'ok', data: [1] }, 200).data).toEqual([1]);
    expect(normalizeEnvelope({ status: 1, data: { a: 1 } }, 200).data).toEqual({ a: 1 });
    expect(normalizeEnvelope({ status_code: 1, data: 5 }, 200).data).toBe(5);
    expect(normalizeEnvelope({ success: true, data: 'x' }, 200).data).toBe('x');
  });

  it("treats status '2' (HTTP 200) as an auth failure", () => {
    expect(kind(() => normalizeEnvelope({ status: '2', message: 'Token Auth Failed' }, 200))).toBe('unauthorized');
    expect(kind(() => normalizeEnvelope({ status_code: 2 }, 200))).toBe('unauthorized');
  });

  it('maps HTTP statuses', () => {
    expect(kind(() => normalizeEnvelope({}, 401))).toBe('unauthorized');
    expect(kind(() => normalizeEnvelope({}, 403))).toBe('forbidden');
    expect(kind(() => normalizeEnvelope({}, 422))).toBe('validation');
    expect(kind(() => normalizeEnvelope({}, 500))).toBe('server');
  });

  it('maps failure flags and keeps field errors', () => {
    expect(kind(() => normalizeEnvelope({ status: '0', message: 'bad' }, 200))).toBe('validation');
    expect(kind(() => normalizeEnvelope({ success: false, message: 'no' }, 200))).toBe('validation');
    try {
      normalizeEnvelope({ message: 'Invalid', errors: { email: ['required'] } }, 422);
    } catch (e) {
      expect((e as ApiError).fieldErrors).toEqual({ email: ['required'] });
    }
  });

  it('does not treat an unwrapped array body as an error', () => {
    expect(normalizeEnvelope([1, 2], 200).data).toEqual([1, 2]);
  });
});
