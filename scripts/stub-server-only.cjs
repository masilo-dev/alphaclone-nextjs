/**
 * Stub Next.js `server-only` for CLI/tsx validators that load MCP tool modules
 * outside the App Router server runtime.
 */
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'server-only') return {};
  return originalLoad.apply(this, arguments);
};
