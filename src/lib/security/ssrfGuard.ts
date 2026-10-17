/**
 * SSRF and outgoing URL safety validator.
 * Prevents access to internal networks, private subnets, cloud metadata, and loopbacks.
 */

import net from 'node:net';

export class SsrfSecurityError extends Error {
  code = 'SSRF_BLOCKED';
  constructor(message: string) {
    super(message);
    this.name = 'SsrfSecurityError';
  }
}

/** Check if an IPv4 address belongs to a private, loopback, or link-local range. */
export function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IPv4 treated as blocked
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local & AWS/GCP/Azure metadata service 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved)
  if (a >= 240) return true;

  return false;
}

/** Check if an IPv6 address belongs to private or loopback ranges. */
export function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  // ::1 loopback, :: unspecified
  if (normalized === '::1' || normalized === '::') return true;
  // Link-local fe80::/10
  if (normalized.startsWith('fe80:') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }
  // Unique local addresses fc00::/7 (fc00: - fdff:)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  // IPv4 mapped addresses ::ffff:192.168.x.x
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.replace('::ffff:', '');
    if (net.isIPv4(v4)) return isPrivateIpv4(v4);
  }
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (
    h === 'localhost' ||
    h === 'localhost.localdomain' ||
    h === 'metadata.google.internal' ||
    h === 'instance-data' ||
    h.endsWith('.internal') ||
    h.endsWith('.local') ||
    h.endsWith('.onion') ||
    h.endsWith('.test') ||
    h.endsWith('.invalid')
  ) {
    return true;
  }

  // Check if hostname is directly an IP
  if (net.isIPv4(h)) return isPrivateIpv4(h);
  if (net.isIPv6(h)) return isPrivateIpv6(h);

  return false;
}

/**
 * Validates that an outgoing target URL is safe to fetch from.
 * Throws SsrfSecurityError if unsafe.
 */
export function validateSafeOutgoingUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfSecurityError('Malformed target URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfSecurityError(`Blocked protocol ${parsed.protocol}. Only http: and https: are allowed.`);
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new SsrfSecurityError(`Access to destination host ${parsed.hostname} is blocked for security reasons.`);
  }

  return parsed;
}
