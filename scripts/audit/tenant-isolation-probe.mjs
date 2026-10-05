#!/usr/bin/env node
/**
 * Tenant isolation probe (READ-ONLY).
 *
 * 1. Catalog check (POSTGRES_URL): every critical tenant-scoped table must have
 *    RLS enabled and at least one policy; materialized views must not be
 *    readable by anon/authenticated.
 * 2. Anonymous REST probe (anon key): critical tables must return 0 rows or be
 *    denied to an unauthenticated caller.
 *
 * Never writes, never creates users, never prints row contents or secrets.
 * Usage: node scripts/audit/tenant-isolation-probe.mjs [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

export const CRITICAL_TABLES = [
  'business_clients', 'contacts', 'leads', 'deals', 'quotes', 'contracts',
  'business_invoices', 'projects', 'email_messages', 'documents', 'activity_logs',
  'external_actions', 'mcp_action_receipts', 'durable_jobs', 'journal_entries',
  'tenant_users', 'external_integration_links', 'finance_reconciliation_findings',
];

function loadEnv() {
  const env = { ...process.env };
  for (const file of ['.env.local', '.env.production.local']) {
    const p = path.resolve(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m || env[m[1]]) continue;
      env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return env;
}

async function catalogCheck(dbUrl) {
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('SET TRANSACTION READ ONLY').catch(() => {});
    const { rows } = await client.query(
      `SELECT c.relname, c.relkind, c.relrowsecurity,
              (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname)::int AS policies,
              has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
              has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_select
         FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND (c.relname = ANY($1) OR c.relkind='m')`,
      [CRITICAL_TABLES],
    );
    const findings = [];
    const seen = new Set();
    for (const r of rows) {
      seen.add(r.relname);
      if (r.relkind === 'm') {
        if (r.anon_select || r.auth_select) findings.push({ table: r.relname, issue: 'materialized_view_readable', anon: r.anon_select, authenticated: r.auth_select });
        continue;
      }
      if (!r.relrowsecurity) findings.push({ table: r.relname, issue: 'rls_disabled' });
      else if (r.policies === 0 && (r.anon_select || r.auth_select)) findings.push({ table: r.relname, issue: 'rls_enabled_no_policies_info', note: 'deny-all for API roles' });
    }
    const missing = CRITICAL_TABLES.filter((t) => !seen.has(t));
    return { checked: rows.length, findings, missing };
  } finally {
    await client.end();
  }
}

async function anonProbe(url, anonKey) {
  const results = [];
  for (const t of CRITICAL_TABLES) {
    try {
      const res = await fetch(`${url}/rest/v1/${t}?select=id&limit=1`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        signal: AbortSignal.timeout(10_000),
      });
      let rows = 0;
      if (res.ok) {
        const body = await res.json().catch(() => []);
        rows = Array.isArray(body) ? body.length : 0;
      }
      results.push({ table: t, status: res.status, leaked: res.ok && rows > 0 });
    } catch (err) {
      results.push({ table: t, status: 'error', leaked: false, error: String(err?.name || err) });
    }
  }
  return results;
}

async function main() {
  const env = loadEnv();
  const report = { generated_at: new Date().toISOString(), catalog: null, anon: null };
  if (env.POSTGRES_URL) report.catalog = await catalogCheck(env.POSTGRES_URL).catch((e) => ({ error: e.message }));
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (env.NEXT_PUBLIC_SUPABASE_URL && anonKey) report.anon = await anonProbe(env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, ''), anonKey);

  const leaks = (report.anon || []).filter((r) => r.leaked);
  const hard = (report.catalog?.findings || []).filter((f) => f.issue === 'rls_disabled' || f.issue === 'materialized_view_readable');
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`catalog: ${report.catalog?.error ? 'ERROR ' + report.catalog.error : `${report.catalog?.checked ?? 0} relations checked`}`);
    for (const f of report.catalog?.findings || []) console.log(`  [${f.issue}] ${f.table}`);
    if (report.catalog?.missing?.length) console.log(`  not present (ok if unused): ${report.catalog.missing.join(', ')}`);
    console.log(`anon probe: ${(report.anon || []).length} tables, ${leaks.length} leaking`);
    for (const l of leaks) console.log(`  LEAK ${l.table}`);
  }
  process.exitCode = leaks.length || hard.length ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
