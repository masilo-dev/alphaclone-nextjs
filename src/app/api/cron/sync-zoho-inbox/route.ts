import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
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
    const zoho = new ZohoMailService(userId);
    const folders = await withTimeout(zoho.getFolders(), PER_USER_TIMEOUT_MS);
    const inbox = folders.find((f) => f.folderName?.toLowerCase() === 'inbox') || folders[0];
    if (!inbox) {
      return { userId, tenantId, synced: 0, skipped: 'no_inbox_folder' };
    }

    const messages = await withTimeout(zoho.getMessages(inbox.folderId, 20, 1), PER_USER_TIMEOUT_MS);
    let synced = 0;

    for (const msg of messages) {
      try {
        await withTimeout(zoho.triageIncomingEmail(msg.messageId, inbox.folderId), PER_USER_TIMEOUT_MS);
        synced++;
      } catch (err) {
        console.warn(`[sync-zoho-inbox] triage failed for ${msg.messageId}:`, err);
      }
    }

    return { userId, tenantId, synced };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    const code = err instanceof ZohoAuthExpiredError ? 'auth_expired' : 'error';
    return { userId, tenantId, synced: 0, error: message, code };
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

  const results = [];
  const rows = (integrations || []).filter((row) => row.user_id && row.tenant_id);
  const mapped = await mapWithConcurrency(rows, CONCURRENCY, (row) =>
    syncUserInbox(row.user_id!, row.tenant_id!)
  );
  results.push(...mapped);

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}
