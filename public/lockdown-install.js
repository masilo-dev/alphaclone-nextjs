// Suppress SES (Secure ECMAScript) console noise from wallet extensions (e.g. MetaMask) and similar.
// Does not install lockdown — only filters console output.
(function () {
  function isSesNoise(s) {
    if (typeof s !== 'string') return false;
    return (
      s.includes('SES Removing unpermitted intrinsics') ||
      s.includes('Removing unpermitted intrinsics') ||
      s.includes('unpermitted intrinsics') ||
      s.includes('lockdown-install.js') ||
      (s.includes('SES') && s.includes('intrinsic')) ||
      s.includes('AlphaClone SES Surface Hardened')
    );
  }

  function shouldSuppress(args) {
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] === 'string' && isSesNoise(args[i])) return true;
    }
    return false;
  }

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

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
    if (msg.includes('Failed to load resource') && msg.includes('facebook') && msg.includes('403')) return;
    originalError.apply(console, args);
  };

  if (typeof window !== 'undefined' && window.location.search.indexOf('debug_ses=1') !== -1) {
    originalLog.call(console, '[AlphaClone] SES console filters active (debug_ses=1)');
  }
})();
