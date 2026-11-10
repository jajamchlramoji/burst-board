import { describe, expect, it } from 'vitest';
import { isPublicUrl, normalizeUrl } from '../shared/url';

describe('isPublicUrl - accepts a real public link', () => {
  for (const url of [
    'https://github.com/me/thing',
    'http://example.com',
    'example.com',
    'https://x.com/me/status/123',
    'https://my-app.vercel.app/path?q=1#top',
    'https://sub.domain.co.uk',
    'https://xn--80ak6aa92e.com',
  ]) {
    it(url, () => expect(isPublicUrl(url)).toBe(true));
  }
});

describe('isPublicUrl - rejects anything that is not public', () => {
  for (const [url, why] of [
    ['', 'empty'],
    ['   ', 'blank'],
    ['not a url', 'nonsense'],
    ['javascript:alert(1)', 'script scheme'],
    ['file:///etc/passwd', 'file scheme'],
    ['ftp://example.com', 'non-http scheme'],
    ['http://localhost:3000', 'localhost'],
    ['http://localhost', 'bare localhost'],
    ['http://app.localhost', 'localhost suffix'],
    ['http://mymac.local', 'mDNS name'],
    ['http://thing.internal', 'internal suffix'],
    ['http://box.lan', 'lan suffix'],
    ['http://foo.test', 'reserved test TLD'],
    ['http://foo.example', 'reserved example TLD'],
    ['http://foo.invalid', 'reserved invalid TLD'],
    ['http://127.0.0.1:8080', 'loopback'],
    // These are the shapes the first version let through.
    ['http://127.1', 'short-form loopback'],
    ['http://2130706433', 'decimal loopback'],
    ['http://0x7f.1', 'hex loopback'],
    ['http://010.0.0.1', 'octal loopback'],
    ['http://169.254.1.1', 'link-local'],
    ['http://100.64.0.1', 'CGNAT'],
    ['http://10.0.0.5', 'private class A'],
    ['http://192.168.1.10', 'private class C'],
    ['http://172.16.0.1', 'private class B'],
    ['http://8.8.8.8', 'bare public IP is still not a shipped link'],
    ['http://[::1]/', 'IPv6 loopback'],
    ['http://[fe80::1]/', 'IPv6 link-local'],
    ['http://[::ffff:127.0.0.1]/', 'IPv4-mapped IPv6'],
    ['https://user:pass@example.com', 'credentials in the URL'],
    ['http://nodot', 'no TLD'],
    ['http://foo.123', 'numeric TLD'],
    ['http://foo..com', 'empty label'],
  ] as const) {
    it(`${why}: ${url || '(empty)'}`, () => expect(isPublicUrl(url)).toBe(false));
  }

  it('rejects an absurdly long URL', () => {
    expect(isPublicUrl(`https://example.com/${'a'.repeat(3000)}`)).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('adds https when no scheme was typed', () => {
    expect(normalizeUrl('example.com/x')).toBe('https://example.com/x');
  });
  it('leaves an explicit scheme alone', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });
  it('trims surrounding whitespace', () => {
    expect(normalizeUrl('  example.com  ')).toBe('https://example.com');
  });
});
