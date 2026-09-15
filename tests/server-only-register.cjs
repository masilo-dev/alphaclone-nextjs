/**
 * Preserve Next.js `server-only` guards in production while allowing Node's
 * mixed client/server unit suite to import server modules outside Next.js.
 */
const Module = require('node:module');
const originalLoad = Module._load;

Module._load = function loadWithServerOnlyStub(request, parent, isMain) {
  if (request === 'server-only') return {};
  return originalLoad.call(this, request, parent, isMain);
};
