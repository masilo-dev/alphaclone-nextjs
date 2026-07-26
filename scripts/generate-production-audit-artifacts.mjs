#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'artifacts/audit');
mkdirSync(out, { recursive: true });
const ignored = new Set(['.git', '.next', 'node_modules', 'coverage', 'artifacts']);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const absolute = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else files.push(relative(root, absolute).replaceAll('\\', '/'));
  }
  return files;
}
const files = walk(root);
const textFiles = files.filter((file) => /\.(?:[cm]?[jt]sx?|sql|json|toml|ya?ml|md|html)$/i.test(file));
const cache = new Map();
const read = (file) => {
  if (!cache.has(file)) {
    try { cache.set(file, readFileSync(resolve(root, file), 'utf8')); }
    catch { cache.set(file, ''); }
  }
  return cache.get(file);
};
const write = (name, value) => writeFileSync(resolve(out, name), `${JSON.stringify(value, null, 2)}\n`);
const matches = (regex) => textFiles.filter((file) => regex.test(read(file)));
const unique = (regex) => {
  const values = new Set();
  for (const file of textFiles) for (const match of read(file).matchAll(regex)) values.add(match[1]);
  return [...values].sort();
};

const pages = files.filter((f) => /^src\/app\/(?:.*\/)?page\.(?:tsx?|jsx?)$/.test(f));
const handlers = files.filter((f) => /^src\/app\/.*\/route\.(?:tsx?|jsx?)$/.test(f));
const apiRoutes = handlers.filter((f) => f.startsWith('src/app/api/'));
const routePath = (file) => `/${file.replace(/^src\/app\//, '').replace(/\/(?:page|route)\.[^.]+$/, '').replace(/\(.*?\)\//g, '')}`.replace(/\/+/g, '/');
const migrations = files.filter((f) => /^supabase\/migrations\/.*\.sql$/.test(f));
const migrationSql = migrations.map((file) => ({ file, sql: read(file) }));
const envNames = unique(/(?:process\.env\.|Deno\.env\.get\(['"])([A-Z][A-Z0-9_]*)/g);
const tables = unique(/\b(?:create|alter)\s+table(?:\s+if\s+(?:not\s+)?exists)?\s+(?:public\.)?["']?([a-z_][\w]*)/gi);
const policies = [];
const functions = [];
for (const { file, sql } of migrationSql) {
  for (const m of sql.matchAll(/create\s+policy\s+["']?([^"'\n]+)["']?\s+on\s+(?:public\.)?([a-z_][\w]*)/gi)) policies.push({ file, policy: m[1].trim(), table: m[2] });
  for (const m of sql.matchAll(/create(?:\s+or\s+replace)?\s+function\s+(?:public\.)?([a-z_][\w]*)/gi)) functions.push({ file, function: m[1], securityDefiner: /security\s+definer/i.test(sql), explicitSearchPath: /set\s+search_path/i.test(sql) });
}
const buckets = unique(/(?:storage\.buckets[\s\S]{0,180}?values\s*\(\s*['"]|bucket(?:_id)?\s*[:=]\s*['"])([a-z0-9_-]+)/gi);
const scheduled = files.filter((f) => /(?:\/cron\/|railway\.crons|scheduled|worker|queue)/i.test(f));
const integrationKeywords = ['anthropic','brevo','deepseek','facebook','google','hubspot','linkedin','microsoft','openai','resend','sendgrid','sentry','slack','stripe','supabase','twilio','whatsapp','x','zoho','zoom'];
const integrations = integrationKeywords.map((name) => ({ name, files: textFiles.filter((f) => new RegExp(`\\b${name}\\b`, 'i').test(read(f))).slice(0, 100) })).filter((x) => x.files.length);
const hrefs = [];
for (const file of textFiles) for (const m of read(file).matchAll(/(?:href|redirectTo|emailRedirectTo)\s*[=:]\s*['"`]([^'"`]+)['"`]/g)) hrefs.push({ file, target: m[1] });
const knownRoutes = new Set([...pages, ...handlers].map(routePath));
const broken = hrefs.filter(({ target }) => target.startsWith('/') && !target.includes('${') && !target.includes('[') && !knownRoutes.has(target.split(/[?#]/)[0]) && !target.startsWith('/api/'));
const emailFiles = textFiles.filter((f) => /email|mail|notification|digest/i.test(f));
const templates = emailFiles.filter((f) => /template|email.*(?:tsx|ts|html)$/i.test(f));
const emailEvents = unique(/event_type\s*[:=]\s*['"]([a-z0-9_.:-]+)/gi);

write('routes.json', pages.map((file) => ({ route: routePath(file), file })));
write('api-routes.json', apiRoutes.map((file) => ({ route: routePath(file), file })));
write('database-objects.json', { migrations, tables, functions });
write('rls-policies.json', { policies, migrationFiles: migrations.filter((f) => /rls|polic/i.test(f)) });
write('functions.json', { database: functions, edge: files.filter((f) => /^supabase\/functions\/.*\/index\.ts$/.test(f)) });
write('email-events.json', { detectedEventTypes: emailEvents, files: emailFiles });
write('email-templates.json', templates);
write('environment-variables.json', envNames.map((name) => ({ name, public: name.startsWith('NEXT_PUBLIC_') || name.startsWith('VITE_'), valueIncluded: false })));
write('storage-buckets.json', { buckets, files: matches(/storage\.(?:objects|buckets)|storage\.from\(/i) });
write('scheduled-jobs.json', scheduled);
write('external-integrations.json', integrations);
write('broken-links.json', broken);
write('module-coverage.json', JSON.parse(read('docs/AUDIT_REPOSITORY_INVENTORY.json') || '{}').matrix || []);
console.log(`Wrote 13 redacted audit inventories to ${relative(root, out)}.`);
