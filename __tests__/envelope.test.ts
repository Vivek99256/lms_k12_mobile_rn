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

  it('419 (CSRF host rule) is a server-address problem, not an auth failure', () => {
    try {
      normalizeEnvelope({}, 419);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as ApiError).kind).toBe('server');
      expect((e as ApiError).status).toBe(419);
      expect((e as ApiError).message).toMatch(/server address/i);
    }
  });

  it('a response-only body is a validation failure with field errors', () => {
    try {
      normalizeEnvelope({ response: { title: ['The title field is required.'], date: ['bad date'] } }, 200);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as ApiError).kind).toBe('validation');
      expect((e as ApiError).message).toBe('The title field is required.');
      expect((e as ApiError).fieldErrors).toEqual({ title: ['The title field is required.'], date: ['bad date'] });
    }
  });

  it('keeps a body that has a status key or data AND a response as a success (fees, WRT report)', () => {
    const r = normalizeEnvelope({ status: '1', message: 'ok', response: { paid_amount: 5 } }, 200);
    expect(r.raw.response).toEqual({ paid_amount: 5 });
    expect(normalizeEnvelope({ response: 'plain string' }, 200).raw.response).toBe('plain string');
    expect(normalizeEnvelope({ data: [1], response: { a: ['x'] } }, 200).data).toEqual([1]);
  });

  it('accepts a bare quoted-URL body (fee receipt) as data', () => {
    expect(normalizeEnvelope('https://erp.test/receipt.pdf', 200).data).toBe('https://erp.test/receipt.pdf');
  });
});
