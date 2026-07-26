#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

async function main() {
  const json = process.argv.includes('--json');
  const fixSafe = process.argv.includes('--fix-safe');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const findings: Array<{ check: string; status: string; count?: number; detail?: string }> = [];

  if (fixSafe) {
  findings.push({
    check: 'fix-safe',
    status: 'blocked',
    detail: 'No deterministic repair is enabled yet; defaulting to read-only to protect production data.',
  });
  }

  if (!url || !key) {
  findings.push({
    check: 'supabase-connection',
    status: 'blocked',
    detail: 'Server-side Supabase credentials are unavailable. Use the connected Supabase audit or supply server-only environment variables.',
  });
  } else {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const checks = [
    ['expired OAuth codes', 'mcp_oauth_codes', (q: any) => q.lt('expires_at', new Date().toISOString()).eq('used', false)],
    ['pending failed email deliveries', 'email_deliveries', (q: any) => q.eq('status', 'failed')],
    ['stale pending data requests', 'data_requests', (q: any) => q.eq('status', 'pending').lt('created_at', new Date(Date.now() - 30 * 86400_000).toISOString())],
  ] as const;
  for (const [check, table, apply] of checks) {
    const result = await apply(db.from(table).select('*', { count: 'exact', head: true }));
    findings.push(result.error
      ? { check, status: 'blocked', detail: result.error.code || 'query failed' }
      : { check, status: result.count ? 'warning' : 'pass', count: result.count || 0 });
  }
  }

  if (json) console.log(JSON.stringify({ readOnly: true, findings }, null, 2));
  else for (const item of findings) console.log(`${item.status.toUpperCase()} ${item.check}${item.count == null ? '' : `: ${item.count}`}${item.detail ? ` — ${item.detail}` : ''}`);
  process.exitCode = findings.some((item) => item.status === 'blocked' && item.check !== 'fix-safe') ? 2 : 0;
}

main().catch((error) => {
  console.error(`Data integrity audit failed safely: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exitCode = 2;
});
