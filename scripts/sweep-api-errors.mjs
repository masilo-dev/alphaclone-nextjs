/**
 * Replaces common leaky API error patterns with clientErrorResponse.
 * Run: node scripts/sweep-api-errors.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.join(__dirname, "..", "src", "app", "api");

const SKIP = new Set([path.join(apiRoot, "health", "route.ts")]);

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) out.push(...walk(p));
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

function detectRequestParam(src) {
  const m = src.match(
    /export\s+async\s+function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(\s*(\w+)/,
  );
  return m?.[1] ?? "req";
}

function ensureImport(src) {
  if (src.includes("from '@/lib/api/clientErrorResponse'")) return src;
  const line =
    "import { clientErrorResponse } from '@/lib/api/clientErrorResponse';\n";
  const nl = src.indexOf("\n");
  if (nl === -1) return line + src;
  return src.slice(0, nl + 1) + line + src.slice(nl + 1);
}

function scopeFromFile(file) {
  return path
    .relative(apiRoot, file)
    .replace(/\\/g, "/")
    .replace(/\/route\.ts$/, "");
}

function transformFile(file) {
  if (SKIP.has(path.normalize(file))) return false;
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  if (
    !/\berror\.message\b|\berr\.message\b|\bdetails:\s*(?:error|err|e)\.message\b/.test(
      s,
    )
  ) {
    return false;
  }

  const reqParam = detectRequestParam(s);
  const scope = scopeFromFile(file);

  // Unwrap: use err in catch for clientErrorResponse
  const patterns = [
    // details: error.message
    {
      re: /return\s+NextResponse\.json\(\s*\{[^}]*error:\s*['"][^'"]+['"]\s*,\s*details:\s*error\.message\s*[^}]*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)/gs,
      fn: () =>
        `return clientErrorResponse(error, { request: ${reqParam}, scope: '${scope}' })`,
    },
    {
      re: /return\s+NextResponse\.json\(\s*\{[^}]*error:\s*['"][^'"]+['"]\s*,\s*details:\s*err\.message\s*[^}]*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)/gs,
      fn: () =>
        `return clientErrorResponse(err, { request: ${reqParam}, scope: '${scope}' })`,
    },
    // { error: error.message }, 500
    {
      re: /return\s+NextResponse\.json\(\s*\{\s*error:\s*error\.message\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)/g,
      fn: () =>
        `return clientErrorResponse(error, { request: ${reqParam}, scope: '${scope}' })`,
    },
    {
      re: /return\s+NextResponse\.json\(\s*\{\s*error:\s*err\.message\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)/g,
      fn: () =>
        `return clientErrorResponse(err, { request: ${reqParam}, scope: '${scope}' })`,
    },
    // error.message || '...'
    {
      re: /return\s+NextResponse\.json\(\s*\{\s*error:\s*error\.message\s*\|\|\s*['"][^'"]*['"]\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)/g,
      fn: () =>
        `return clientErrorResponse(error, { request: ${reqParam}, scope: '${scope}' })`,
    },
    {
      re: /return\s+NextResponse\.json\(\s*\{\s*error:\s*err\.message\s*\|\|\s*['"][^'"]*['"]\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)/g,
      fn: () =>
        `return clientErrorResponse(err, { request: ${reqParam}, scope: '${scope}' })`,
    },
    // Internal Server Error + details err.message (calendly style)
    {
      re: /return\s+NextResponse\.json\(\s*\{\s*error:\s*['"]Internal Server Error['"]\s*,\s*details:\s*err\.message\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)/g,
      fn: () =>
        `return clientErrorResponse(err, { request: ${reqParam}, scope: '${scope}' })`,
    },
  ];

  for (const { re, fn } of patterns) {
    s = s.replace(re, fn);
  }

  if (s === orig) return false;
  s = ensureImport(s);
  fs.writeFileSync(file, s);
  return true;
}

let n = 0;
for (const f of walk(apiRoot)) {
  if (transformFile(f)) {
    n++;
    console.log("updated", path.relative(path.join(__dirname, ".."), f));
  }
}
console.log("files updated:", n);
