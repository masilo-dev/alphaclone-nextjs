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
  if (typeof Array.prototype.filter !== 'function') return;

  // Prevent duplicate patching
  if ((Array.prototype.filter as any).__patched) return;

  const origFilter = Array.prototype.filter;

  const patchedFilter = function (this: any[], callback: any, thisArg?: any) {
    if (typeof callback !== 'function') {
      console.error('--- DETECTED BAD FILTER CALL ---');
      console.error('Callback value:', callback);
      console.error('This array:', this);
      console.error('Stack trace:', new Error().stack);
      console.error('---------------------------------');
    }
    return origFilter.call(this, callback, thisArg);
  };

  (patchedFilter as any).__patched = true;
  Array.prototype.filter = patchedFilter as any;
}
