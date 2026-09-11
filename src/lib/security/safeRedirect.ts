const ALLOWED_PREFIXES = [
  '/dashboard',
  '/oauth/',
  '/authorize',
  '/api/mcp/authorize',
  '/auth/',
] as const;

/**
 * Returns a same-origin relative path safe for post-auth navigation, or null.
 */
export function sanitizeInternalRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) {
    return null;
  }

  if (/^\s*javascript:/i.test(decoded) || decoded.includes('://')) {
    return null;
  }

  if (decoded.includes('\\') || decoded.includes('\0')) {
    return null;
  }

  const allowed = ALLOWED_PREFIXES.some((prefix) => decoded.startsWith(prefix));
  return allowed ? decoded : null;
}

/**
 * Returns true when a storage path segment looks like traversal.
 */
export function hasStoragePathTraversal(segments: string[]): boolean {
  for (const segment of segments) {
    if (!segment) return true;
    if (segment === '.' || segment === '..') return true;
    if (segment.includes('\0')) return true;

    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return true;
    }

    if (decoded === '.' || decoded === '..') return true;
    if (decoded.includes('..')) return true;
  }

  const joined = segments.join('/');
  return joined.includes('..') || joined.includes('\\');
}
