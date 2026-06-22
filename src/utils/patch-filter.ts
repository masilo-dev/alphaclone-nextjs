export function initPatch() {
  if (typeof globalThis !== 'undefined' && !(globalThis as any).__filter_patched) {
    (globalThis as any).__filter_patched = true;
    const origFilter = Array.prototype.filter;
    Array.prototype.filter = function (this: any[], callback: any, ...args: any[]) {
      if (typeof callback !== 'function') {
        console.error('--- DETECTED BAD FILTER CALL ---');
        console.error('This:', this);
        console.error('Callback:', callback);
        try {
          throw new Error('Stack trace for bad filter');
        } catch (e: any) {
          console.error(e.stack);
        }
        console.error('--------------------------------');
      }
      return origFilter.apply(this, [callback, ...args] as any);
    };
    console.log('--- Array.prototype.filter successfully patched ---');
  }
}
