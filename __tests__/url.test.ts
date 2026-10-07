import { env } from '../src/config/env';
import { ApiError } from '../src/api/errors';
import { resolveUrl } from '../src/api/url';

jest.mock('../src/config/env', () => ({
  env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] as string[] },
}));

const mutableEnv = env as { apiBaseUrl: string; erpHosts: string[] };
const kindOf = (u: string) => {
  try {
    resolveUrl(u);
  } catch (e) {
    return (e as ApiError).kind;
  }
  return 'none';
};

beforeEach(() => {
  mutableEnv.apiBaseUrl = 'https://dev.triz.co.in';
  mutableEnv.erpHosts = [];
});

describe('resolveUrl', () => {
  it('joins a relative path onto the API base', () => {
    expect(resolveUrl('studentAttendanceAPI')).toBe('https://dev.triz.co.in/studentAttendanceAPI');
    expect(resolveUrl('/api/own-profile')).toBe('https://dev.triz.co.in/api/own-profile');
  });

  it('re-bases a production tile URL onto the configured API host, keeping path and query', () => {
    expect(resolveUrl('https://erp.triz.co.in/studentAttendanceAPI')).toBe('https://dev.triz.co.in/studentAttendanceAPI');
    expect(resolveUrl('https://erp.triz.co.in/circular/fetchData?x=1&y=2')).toBe(
      'https://dev.triz.co.in/circular/fetchData?x=1&y=2',
    );
    expect(resolveUrl('HTTPS://ERP.TRIZ.CO.IN/a')).toBe('https://dev.triz.co.in/a');
  });

  it('never downgrades the scheme: an http URL for the same host is rebuilt on the base', () => {
    expect(resolveUrl('http://dev.triz.co.in/x')).toBe('https://dev.triz.co.in/x');
  });

  it('works for a local base', () => {
    mutableEnv.apiBaseUrl = 'http://127.0.0.1:8000';
    expect(resolveUrl('https://erp.triz.co.in/studentAttendanceAPI')).toBe('http://127.0.0.1:8000/studentAttendanceAPI');
    expect(resolveUrl('http://127.0.0.1:8000/x')).toBe('http://127.0.0.1:8000/x');
  });

  it('blocks unknown hosts, so the token is never sent there', () => {
    expect(kindOf('https://evil.example.com/steal')).toBe('config');
    expect(kindOf('http://localhost:8000/x')).toBe('config');
  });

  it('blocks look-alike hosts and URL tricks', () => {
    expect(kindOf('https://erp.triz.co.in.evil.com/x')).toBe('config');
    expect(kindOf('https://evil.com/erp.triz.co.in/x')).toBe('config');
    expect(kindOf('https://erp.triz.co.in@evil.com/x')).toBe('config');
    expect(kindOf('https://evil.com#@erp.triz.co.in/x')).toBe('config');
    expect(kindOf('https://erp.triz.co.in:8443/x')).toBe('config');
    expect(kindOf('https://notriz.co.in/x')).toBe('config');
  });

  it('honours EXPO_PUBLIC_ERP_HOSTS instead of the defaults', () => {
    mutableEnv.erpHosts = ['erp.school.example'];
    expect(resolveUrl('https://erp.school.example/a')).toBe('https://dev.triz.co.in/a');
    expect(kindOf('https://erp.triz.co.in/a')).toBe('config');
  });

  it('needs an API base', () => {
    mutableEnv.apiBaseUrl = '';
    expect(kindOf('studentAttendanceAPI')).toBe('config');
    expect(kindOf('https://erp.triz.co.in/x')).toBe('config');
  });
});
