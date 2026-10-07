import { env } from '../src/config/env';
import { safeAttachmentUrl } from '../src/screens/student/circularModel';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] as string[] } }));

const mutableEnv = env as { apiBaseUrl: string; erpHosts: string[] };
beforeEach(() => {
  mutableEnv.apiBaseUrl = 'https://dev.triz.co.in';
  mutableEnv.erpHosts = [];
});

describe('safeAttachmentUrl', () => {
  it('re-bases a production file link onto the configured API host (a dev build never opens production files)', () => {
    expect(safeAttachmentUrl('https://erp.triz.co.in/storage/circular/notice.pdf')).toBe('https://dev.triz.co.in/storage/circular/notice.pdf');
  });

  it('keeps a link that already points at the API host', () => {
    expect(safeAttachmentUrl('https://dev.triz.co.in/storage/circular/a.pdf')).toBe('https://dev.triz.co.in/storage/circular/a.pdf');
  });

  it('refuses hosts the app does not trust', () => {
    expect(safeAttachmentUrl('https://evil.example.com/storage/circular/a.pdf')).toBeNull();
    expect(safeAttachmentUrl('https://erp.triz.co.in.evil.com/a.pdf')).toBeNull();
    expect(safeAttachmentUrl('https://erp.triz.co.in@evil.com/a.pdf')).toBeNull();
    expect(safeAttachmentUrl('http://127.0.0.1/storage/circular/a.pdf')).toBeNull(); // the server's own host name, no port: not the API host
  });

  it('refuses empty values, non-http schemes and bare file names', () => {
    for (const bad of ['', '   ', 'a.pdf', '/storage/circular/a.pdf', 'javascript:alert(1)', 'file:///etc/passwd', 'ftp://erp.triz.co.in/a.pdf', 'intent://x']) {
      expect(safeAttachmentUrl(bad)).toBeNull();
    }
  });

  it('refuses everything when the app has no API base configured', () => {
    mutableEnv.apiBaseUrl = '';
    expect(safeAttachmentUrl('https://erp.triz.co.in/storage/circular/a.pdf')).toBeNull();
  });
});
