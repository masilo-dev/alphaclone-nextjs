/**
 * Preserve Next.js `server-only` guards in production while allowing Node's
 * mixed client/server unit suite to import server modules outside Next.js.
 */
const Module = require('node:module');
const originalLoad = Module._load;

Module._load = function loadWithServerOnlyStub(request, parent, isMain) {
  if (request === 'server-only') return {};
  if (request === 'inherits') return require('node:util').inherits;
  if (request === 'isexe') return () => true;
  if (request === 'parse-srcset') return function parseSrcset() { return []; };
  if (request === 'next/server') {
    return {
      NextResponse: class NextResponse extends Response {
        static json(body, init) {
          return new Response(JSON.stringify(body), {
            ...init,
            headers: { 'content-type': 'application/json', ...(init && init.headers) },
          });
        }
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
