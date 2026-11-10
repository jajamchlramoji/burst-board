/**
 * "Is this a link someone else could actually open?"
 *
 * This is a product rule before it is a security rule: a ship only counts when
 * it is public, so anything that resolves to this machine, a private network or
 * a reserved name is rejected. Bare IP addresses are rejected outright - GitHub,
 * X, LinkedIn and a deployed URL are all domains, and an IP literal is never the
 * public link the burst was asking for.
 */

const MAX_URL_LENGTH = 2048;

/** Names that never leave the machine or the local network. */
const PRIVATE_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa'];

/** Reserved by RFC 2606 / 6761 - they can never be a real public host. */
const RESERVED_SUFFIXES = ['.test', '.example', '.invalid'];

/** A host made only of numbers (and dots) is an IPv4 literal in some notation. */
function isNumericHost(host: string): boolean {
  const labels = host.split('.');
  return labels.every((l) => /^(?:0[xX][0-9a-fA-F]+|\d+)$/.test(l) && l.length > 0);
}

export function isPublicUrl(raw: string): boolean {
  const text = (raw ?? '').trim();
  if (!text || text.length > MAX_URL_LENGTH) return false;

  let u: URL;
  try {
    u = new URL(text.includes('://') ? text : `https://${text}`);
  } catch {
    return false;
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

  // Credentials in a link get stored in plain JSON and exported to Markdown.
  if (u.username || u.password) return false;

  // URL keeps IPv6 literals in brackets: [::1], [fe80::1], [::ffff:127.0.0.1].
  if (u.hostname.startsWith('[')) return false;

  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return false;

  if (host === 'localhost') return false;
  if (PRIVATE_SUFFIXES.some((s) => host.endsWith(s))) return false;
  if (RESERVED_SUFFIXES.some((s) => host.endsWith(s))) return false;

  // Any IPv4 notation: 127.0.0.1, 127.1, 2130706433, 0x7f.1, 010.0.0.1, 10.0.0.5
  if (isNumericHost(host)) return false;

  // A real public host is name.tld with an alphabetic TLD.
  const labels = host.split('.');
  if (labels.length < 2) return false;
  if (labels.some((l) => l.length === 0)) return false;
  const tld = labels[labels.length - 1] ?? '';
  if (!/^[a-z]{2,}$/.test(tld)) return false;

  return true;
}

/** What we store: exactly what was typed, with a scheme if it was missing. */
export function normalizeUrl(raw: string): string {
  const text = (raw ?? '').trim();
  return text.includes('://') ? text : `https://${text}`;
}
