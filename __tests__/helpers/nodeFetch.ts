/**
 * jest-expo replaces `fetch` with a stub, so the opt-in local integration tests make real HTTP calls
 * through Node's http module instead. Returns the minimum the API client uses: status and text().
 */
export function installNodeFetch(): void {
  (global as { fetch: unknown }).fetch = (url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) =>
    new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const http = require('http') as typeof import('http');
      const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode ?? 0, text: () => Promise.resolve(text) });
        });
      });
      req.on('error', reject);
      if (init.body) req.write(init.body);
      req.end();
    });
}
