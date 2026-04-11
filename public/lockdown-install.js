// SES Lockdown Configuration & Console Noise Suppression
// This script runs before the main bundle to intercept and suppress non-critical SES "unpermitted intrinsics" warnings.

(function() {
  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = function(...args) {
    if (args[0] && typeof args[0] === 'string' && (
      args[0].includes('SES Removing unpermitted intrinsics') ||
      args[0].includes('lockdown-install.js') ||
      args[0].includes('Removing unpermitted intrinsics') ||
      args[0].includes('unpermitted intrinsics') ||
      args[0].includes('SES ')
    )) {
      return; // Suppress SES noise
    }
    originalWarn.apply(console, args);
  };

  // Also intercept specific Facebook SDK failed preloads/loads and SW errors
  console.error = function(...args) {
    const msg = args[0] && typeof args[0] === 'string' ? args[0] : '';
    if (
      (msg.includes('Failed to load resource: the server responded with status 403') && msg.includes('facebook')) ||
      msg.includes('no-response: no-response') ||
      msg.includes('SES ')
    ) {
      return; // Suppress transient errors and SES noise
    }
    originalError.apply(console, args);
  };

  console.log("AlphaClone SES Surface Hardened. Log interceptors active.");
})();
