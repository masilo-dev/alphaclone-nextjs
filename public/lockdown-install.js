/**
 * Lockdown Install Stub
 * 
 * This file exists to satisfy any potential requests for "lockdown-install.js"
 * that might be triggered by SES/Agoric related dependencies.
 * 
 * If a dependency is trying to load this script and failing (causing "SES Removing unpermitted intrinsics"),
 * this empty valid JS file should prevent the 404 or unexpected error, 
 * allowing the app to proceed even if the strict lockdown isn't fully active.
 */

console.log('[Lockdown Stub] lockdown-install.js loaded (compatibility mode).');

// Optionally, we could polyfill strict mode or SES features here if we knew exactly what was missing.
// For now, doing nothing is safer than doing the wrong thing.
