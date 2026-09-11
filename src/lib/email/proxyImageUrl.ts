const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0', '::1']);

const PRIVATE_IPV4_PATTERN =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$/;

export const EMAIL_PROXY_IMAGE_PATH = '/api/email/proxy-image';

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (PRIVATE_IPV4_PATTERN.test(host)) return true;
  return false;
}

export function isAllowedProxyImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (url.username || url.password) return false;
    if (isPrivateOrLocalHost(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function buildEmailProxyImageUrl(absoluteUrl: string): string {
  return `${EMAIL_PROXY_IMAGE_PATH}?url=${encodeURIComponent(absoluteUrl)}`;
}

function isAlreadyProxied(src: string): boolean {
  const trimmed = src.trim();
  return (
    trimmed.startsWith(EMAIL_PROXY_IMAGE_PATH) ||
    trimmed.startsWith('/api/zoho/mail?action=proxy-image') ||
    trimmed.startsWith('/api/zoho/mail&action=proxy-image')
  );
}

function toAbsoluteHttpUrl(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('cid:')) return null;
  if (isAlreadyProxied(trimmed)) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return null;

  let absolute = trimmed;
  if (trimmed.startsWith('//')) {
    absolute = `https:${trimmed}`;
  } else if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(absolute);
    if (!isAllowedProxyImageUrl(url.toString())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function rewriteExternalEmailImageSources(html: string): string {
  return html.replace(
    /(<img\b[^>]*\bsrc\s*=\s*)(['"])([^'"]+)\2/gi,
    (match, prefix, quote, src) => {
      const absolute = toAbsoluteHttpUrl(src);
      if (!absolute) return match;
      return `${prefix}${quote}${buildEmailProxyImageUrl(absolute)}${quote}`;
    }
  );
}
