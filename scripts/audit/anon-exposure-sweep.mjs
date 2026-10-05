// Read-only: for every table in the PostgREST schema, count rows visible to the anon key.
// Prints table names + counts only, never row data.
import fs from 'node:fs';
const env = {};
for (const f of ['.env.local', '.env.production.local']) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const spec = await (await fetch(`${url}/rest/v1/`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } })).json();
const tables = Object.keys(spec.paths || {}).filter((p) => p !== '/' && !p.startsWith('/rpc/')).map((p) => p.slice(1));
const out = [];
const queue = [...tables];
async function worker() {
  while (queue.length) {
    const t = queue.shift();
    try {
      const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact', Range: '0-0' }, signal: AbortSignal.timeout(15000) });
      const cr = r.headers.get('content-range') || '';
      const n = Number(cr.split('/')[1]);
      if (r.ok && n > 0) out.push({ table: t, anon_visible_rows: n });
    } catch {}
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
out.sort((a, b) => a.table.localeCompare(b.table));
console.log(JSON.stringify({ tables_checked: tables.length, anon_visible: out }, null, 1));
