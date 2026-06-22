/**
 * patch-filter.ts — DISABLED
 *
 * This was a debugging utility that monkey-patched Array.prototype.filter to
 * trace bad filter calls. It caused a TypeError crash during SSR prerendering
 * on /dashboard because:
 *   1. It was called at module-level before ssr:false dynamic imports took effect.
 *   2. Chakra UI's baseStyle function passes a non-function to .filter(), and the
 *      patched version then tried to call origFilter.apply(), which failed in the
 *      SSR V8 context.
 *
 * The patch is a no-op in production. Do not re-enable without isolating it
 * strictly to client-side useEffect or a browser devtools snippet.
 */
export function initPatch() {
  // Intentionally disabled — was causing SSR prerender crash on /dashboard.
}
