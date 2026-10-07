/**
 * Public marketing routes that should use the lightweight shell + providers.
 * Keep in sync with ShellSwitcher.
 */
export function isPublicMarketingRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  if (pathname === '/') return true;
  const prefixes = [
    '/marketing',
    '/solutions',
    '/reliability',
    '/execution-session',
    '/support',
    '/customers',
    '/crm',
    '/project-management',
    '/lead-management',
    '/ai-business-os',
    '/ai-agents',
    '/video-meetings',
    '/guide',
    '/docs',
    '/sla',
    '/compliance',
    '/security-policy',
    '/data-deletion',
    '/about',
    '/pricing',
    '/faq',
    '/book',
    '/meet',
    '/who-we-serve',
    '/blog',
    '/contact',
    '/legal',
    '/privacy',
    '/terms',
    '/portal',
    '/services',
    '/how-it-works',
    '/ecosystem',
    '/results',
    '/demo',
    '/book-demo',
    '/platform-status',
    '/claude-manus-integrations',
    '/tools/ai-architect',
  ];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Authenticated app surfaces (dashboard, auth flows that need full stack). */
export function isAppShellRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/app') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/billing') ||
    pathname.startsWith('/account') ||
    pathname.startsWith('/preferences') ||
    pathname.startsWith('/call') ||
    pathname.startsWith('/contract') ||
    (pathname === '/project' || pathname.startsWith('/project/')) ||
    pathname.startsWith('/p/') ||
    pathname.startsWith('/bp/')
  );
}
