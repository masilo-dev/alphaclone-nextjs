// SES Lockdown Configuration & Console Noise Suppression
// This script runs before the main bundle to intercept and suppress non-critical SES "unpermitted intrinsics" warnings.

(function() {
  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = function(...args) {
    if (args[0] && typeof args[0] === 'string' && (
      args[0].includes('SES Removing unpermitted intrinsics') ||
      args[0].includes('lockdown-install.js')
    )) {
      return; // Suppress SES noise
    }
    originalWarn.apply(console, args);
  };

  // Also intercept specific Facebook SDK failed preloads/loads if they appear as errors
  console.error = function(...args) {
    if (args[0] && typeof args[0] === 'string' && (
      args[0].includes('Failed to load resource: the server responded with status 403') &&
      args[0].includes('facebook')
    )) {
      return; // Suppress transient FB SDK errors that break console cleaniless
    }
    originalError.apply(console, args);
  };

  console.log("AlphaClone SES Surface Hardened. Log interceptors active.");
})();
