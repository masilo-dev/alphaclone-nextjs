/**
 * Security and SSRF protection for Web Research Engine.
 * Crawled content is strictly UNTRUSTED DATA.
 */

import { isIP } from 'net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'metadata.google.internal',
  'metadata.gcp.internal',
  'instance-data',
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bin', '.dmg', '.iso', '.msi', '.zip', '.tar', '.gz',
  '.7z', '.rar', '.apk', '.deb', '.rpm', '.sh', '.bat', '.cmd',
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm',
  '.mp3', '.wav', '.flac', '.ogg', '.pdf',
]);

export function isPrivateIp(ip: string): boolean {
  if (!ip) return false;
  // IPv4 checks
  if (ip === '127.0.0.1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.')) return true; // Link-local & cloud metadata
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;

  // IPv6 checks
  if (ip === '::1' || ip === '::') return true;
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true; // Unique local
  if (ip.toLowerCase().startsWith('fe80:')) return true; // Link-local

  return false;
}

export function validateSafeUrl(rawUrl: string): { safe: boolean; reason?: string; url?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { safe: false, reason: 'Empty or invalid URL' };
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    const withScheme = trimmed.includes('://')
      ? trimmed
      : `https://${trimmed}`;
    parsed = new URL(withScheme);
  } catch (err) {
    return { safe: false, reason: `Malformed URL: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: `Disallowed protocol '${parsed.protocol}'. Only http and https allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase().trim();
  if (!hostname) {
    return { safe: false, reason: 'Missing hostname in URL.' };
  }

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: `Restricted hostname '${hostname}' is prohibited.` };
  }

  if (
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.corp') ||
    hostname.endsWith('.home')
  ) {
    return { safe: false, reason: `Internal domain '${hostname}' is prohibited.` };
  }

  // If hostname is an IP address
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { safe: false, reason: `Private/internal IP address '${hostname}' is prohibited.` };
    }
  }

  // Check file extensions
  const pathname = parsed.pathname.toLowerCase();
  for (const ext of BLOCKED_EXTENSIONS) {
    if (pathname.endsWith(ext)) {
      return { safe: false, reason: `Target path ends with restricted extension '${ext}'.` };
    }
  }

  return { safe: true, url: parsed.toString() };
}

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions?/gi,
  /system\s*prompt\s*override/gi,
  /you\s+are\s+now\s+in\s+developer\s+mode/gi,
  /<\s*script[^>]*>[\s\S]*?<\s*\/script\s*>/gi,
  /<\s*(iframe|style)[^>]*>[\s\S]*?<\s*\/\1\s*>/gi,
  /javascript:/gi,
  /data:text\/html/gi,
];

/**
 * Sanitize untrusted crawled content to prevent prompt injection or XSS.
 */
export function sanitizeUntrustedContent(content: string, maxLength = 1200): string {
  if (!content || typeof content !== 'string') return '';

  let sanitized = content;
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, ' [filtered] ');
  }

  // Strip raw HTML tags
  sanitized = sanitized.replace(/<[^>]+>/g, ' ');

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized.slice(0, maxLength);
}
