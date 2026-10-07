/** Authentication must use the browser network stack, including redirects and CORS. */
export function bypassAuthenticationFetch(event: Pick<FetchEvent, 'request' | 'stopImmediatePropagation'>, origin: string): void {
    const url = new URL(event.request.url);
    const isProvider = url.hostname === 'challenges.cloudflare.com' ||
        url.hostname.endsWith('.challenges.cloudflare.com') ||
        url.hostname.endsWith('.supabase.co');
    const isAuthPath = url.origin === origin && [
        '/auth', '/login', '/authorize', '/portal-login', '/api/auth',
        '/api/mcp', '/api/client-portal-auth',
    ].some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`));
    if (isProvider || isAuthPath) {
        // Do not call respondWith: NetworkOnly still intercepts the request and can
        // replace a redirect/CORS failure with Response.error or an offline page.
        event.stopImmediatePropagation();
    }
}
