import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { withCronJob } from '@/lib/cron/withCronJob';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';
import { ZohoAuthExpiredError } from '@/services/zoho/ZohoService';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PER_USER_TIMEOUT_MS = 20_000;
const CONCURRENCY = 5;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function syncUserInbox(userId: string, tenantId: string) {
  try {
    const { MailboxService } = await import('@/lib/email/mailboxService');
    const mailbox = new MailboxService(tenantId,userId);
    const accounts = (await mailbox.accounts()).filter((row) => row.provider === 'zoho' && row.account_type !== 'platform');
    const jobs = [];
    for (const account of accounts) jobs.push(await mailbox.sync(account.id));
    return {userId,tenantId,jobs};
  } catch (err) {
    return {userId,tenantId,error:err instanceof Error ? err.message : String(err)};
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  return withCronJob('sync-zoho-inbox', async () => {
  const admin = createSupabaseAdminClient();

  const { data: integrations, error } = await admin
    .from('integrations')
    .select('user_id, tenant_id')
    .eq('type', 'zoho')
    .eq('enabled', true)
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type ZohoIntegrationRow = { user_id: string | null; tenant_id: string | null };
  type ActiveZohoIntegration = { user_id: string; tenant_id: string };

  const rows: ActiveZohoIntegration[] = ((integrations ?? []) as ZohoIntegrationRow[]).filter(
    (row): row is ActiveZohoIntegration => Boolean(row.user_id && row.tenant_id)
  );
  const results = await mapWithConcurrency(rows, CONCURRENCY, (row: ActiveZohoIntegration) =>
    syncUserInbox(row.user_id, row.tenant_id)
  );

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
  }, { maxDurationMs: 25_000, lockTtlSec: 180 });
}
