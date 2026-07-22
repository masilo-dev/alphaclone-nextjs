/**
 * Canonical public origin and MCP resource identity.
 *
 * Server-side OAuth / MCP auth MUST use these values — never request.url,
 * request.nextUrl.origin, raw Host, 0.0.0.0, localhost, or container ports.
 */

const DEFAULT_PRODUCTION_ORIGIN = 'https://alphaclonesystems.com';

const BLOCKED_HOST_FRAGMENTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '.railway.internal',
  '.internal',
];

export class PublicOriginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicOriginConfigurationError';
  }
}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.RAILWAY_ENVIRONMENT === 'production'
  );
}

/** Normalize to scheme://host[:port] with no trailing slash. */
export function normalizeOrigin(value: string): string {
  const url = new URL(value);
  return url.origin.replace(/\/+$/, '');
}

/**
 * Normalize an absolute resource URL for audience comparison.
 * - HTTPS required in production
 * - lowercase hostname
 * - strip default ports
 * - preserve path (no trailing slash except root)
 * - drop search/hash
 */
export function normalizeResourceUrl(value: string): string {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  url.search = '';

  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  ) {
    url.port = '';
  }

  let path = url.pathname.replace(/\/+$/, '') || '';
  if (path === '/') path = '';
  return `${url.protocol}//${url.host}${path}`;
}

function containsBlockedHost(value: string): boolean {
  const lower = value.toLowerCase();
  return BLOCKED_HOST_FRAGMENTS.some((fragment) => lower.includes(fragment));
}

function resolveRawOrigin(): string {
  const candidates = [
    process.env.PUBLIC_APP_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    try {
      return normalizeOrigin(trimmed);
    } catch {
      // try next
    }
  }

  return DEFAULT_PRODUCTION_ORIGIN;
}

function assertSafePublicOrigin(origin: string): void {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new PublicOriginConfigurationError(`PUBLIC_APP_ORIGIN is not a valid URL: ${origin}`);
  }

  if (containsBlockedHost(origin) || containsBlockedHost(parsed.hostname)) {
    throw new PublicOriginConfigurationError(
      `PUBLIC_APP_ORIGIN must not use localhost, 0.0.0.0, or internal Railway hostnames: ${origin}`
    );
  }

  if (isProductionRuntime() && parsed.protocol !== 'https:') {
    throw new PublicOriginConfigurationError(
      `PUBLIC_APP_ORIGIN must use HTTPS in production: ${origin}`
    );
  }
}

function assertSafeMcpResource(resource: string, origin: string): void {
  let parsed: URL;
  try {
    parsed = new URL(resource);
  } catch {
    throw new PublicOriginConfigurationError(`PUBLIC_MCP_RESOURCE is not a valid URL: ${resource}`);
  }

  if (containsBlockedHost(resource) || containsBlockedHost(parsed.hostname)) {
    throw new PublicOriginConfigurationError(
      `PUBLIC_MCP_RESOURCE must not use internal or loopback hosts: ${resource}`
    );
  }

  if (isProductionRuntime() && parsed.protocol !== 'https:') {
    throw new PublicOriginConfigurationError(
      `PUBLIC_MCP_RESOURCE must be HTTPS in production: ${resource}`
    );
  }

  const allowCrossOrigin =
    process.env.ALLOW_MCP_RESOURCE_CROSS_ORIGIN === 'true' ||
    process.env.ALLOW_MCP_RESOURCE_CROSS_ORIGIN === '1';

  if (!allowCrossOrigin) {
    const resourceOrigin = normalizeOrigin(resource);
    if (resourceOrigin !== origin) {
      throw new PublicOriginConfigurationError(
        `PUBLIC_MCP_RESOURCE origin (${resourceOrigin}) must match PUBLIC_APP_ORIGIN (${origin})`
      );
    }
  }
}

const resolvedOrigin = resolveRawOrigin();
assertSafePublicOrigin(resolvedOrigin);

const resolvedMcpResource = normalizeResourceUrl(
  process.env.PUBLIC_MCP_RESOURCE?.trim() || `${resolvedOrigin}/api/mcp`
);
assertSafeMcpResource(resolvedMcpResource, resolvedOrigin);

/** Canonical public app origin (no trailing slash). */
export const PUBLIC_APP_ORIGIN = resolvedOrigin;

/** Canonical MCP protected-resource identifier (RFC 8707 audience). */
export const PUBLIC_MCP_RESOURCE = resolvedMcpResource;

/** Validate configured public origin/resource (safe to call at startup). */
export function validatePublicOriginConfig(): {
  ok: boolean;
  publicOrigin: string;
  mcpResource: string;
  errors: string[];
} {
  const errors: string[] = [];
  try {
    assertSafePublicOrigin(PUBLIC_APP_ORIGIN);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  try {
    assertSafeMcpResource(PUBLIC_MCP_RESOURCE, PUBLIC_APP_ORIGIN);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }
  return {
    ok: errors.length === 0,
    publicOrigin: PUBLIC_APP_ORIGIN,
    mcpResource: PUBLIC_MCP_RESOURCE,
    errors,
  };
}

/** Build an absolute public URL from a path starting with `/`. */
export function buildPublicCallbackUrl(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error('Callback path must start with /');
  }
  return new URL(path, `${PUBLIC_APP_ORIGIN}/`).toString();
}

/** True when two resource URLs are equivalent after normalization (+ /api/mcp/sse alias). */
export function resourcesMatch(tokenResource: string | null | undefined, expected: string): boolean {
  if (!tokenResource) return true;
  const alias = (value: string) =>
    normalizeResourceUrl(value).replace(/\/api\/mcp\/sse$/, '/api/mcp');
  try {
    const a = alias(tokenResource);
    const b = alias(expected);
    if (a === b) return true;
    // Token for /api/mcp also covers /api/mcp/*
    if (b.startsWith(`${a}/`)) return true;
    return false;
  } catch {
    return false;
  }
}
