// Suppress SES (Secure ECMAScript) console noise from wallet extensions (e.g. MetaMask) and similar.
// Does not install lockdown — only filters console output.
(function () {
  function isSesNoise(s) {
    if (typeof s !== 'string') {
      try {
        s = String(s);
      } catch (e) {
        return false;
      }
    }
    const lower = s.toLowerCase();
    return (
      lower.includes('ses removing unpermitted intrinsics') ||
      lower.includes('removing unpermitted intrinsics') ||
      lower.includes('unpermitted intrinsics') ||
      lower.includes('indexeddb init error') ||
      lower.includes('wrappedsendmessagecallback') ||
      lower.includes('polyfill.js') ||
      lower.includes('lockdown-install.js') ||
      (lower.includes('ses') && lower.includes('intrinsic')) ||
      lower.includes('tslib.es6.js') ||
      lower.includes('alphaclone ses surface hardened')
    );
  }

  function shouldSuppress(args) {
    for (let i = 0; i < args.length; i++) {
      if (isSesNoise(args[i])) return true;
      // Suppress Segment TypeErrors caused by SES intrinsic removal
      if (args[i] instanceof TypeError && args[i].stack && args[i].stack.includes('tslib.es6.js')) return true;
    }
    return false;
  }

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  console.log = function () {
    const args = Array.prototype.slice.call(arguments);
    if (shouldSuppress(args)) return;
    originalLog.apply(console, args);
  };

  console.warn = function () {
    const args = Array.prototype.slice.call(arguments);
    if (shouldSuppress(args)) return;
    originalWarn.apply(console, args);
  };

  console.error = function () {
    const args = Array.prototype.slice.call(arguments);
    if (shouldSuppress(args)) return;
    const msg = args[0] && typeof args[0] === 'string' ? args[0] : '';
    // Suppress Facebook/Segment/Claude noise
    if (msg.includes('Failed to load resource') && (msg.includes('facebook') || msg.includes('claude.ai')) && (msg.includes('403') || msg.includes('404'))) return;
    originalError.apply(console, args);
  };

  console.info = function () {
    const args = Array.prototype.slice.call(arguments);
    if (shouldSuppress(args)) return;
    originalInfo.apply(console, args);
  };

  console.debug = function () {
    const args = Array.prototype.slice.call(arguments);
    if (shouldSuppress(args)) return;
    originalDebug.apply(console, args);
  };

  if (typeof window !== 'undefined' && window.location.search.indexOf('debug_ses=1') !== -1) {
    originalLog.call(console, '[AlphaClone] SES console filters active (debug_ses=1)');
  }
})();

