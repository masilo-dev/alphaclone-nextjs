import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ZohoMailService } from '@/services/zoho/ZohoMailService';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

async function syncUserInbox(userId: string, tenantId: string) {
  try {
    const zoho = new ZohoMailService(userId);
    const folders = await zoho.getFolders();
    const inbox = folders.find((f) => f.folderName?.toLowerCase() === 'inbox') || folders[0];
    if (!inbox) {
      return { userId, tenantId, synced: 0, skipped: 'no_inbox_folder' };
    }

    const messages = await zoho.getMessages(inbox.folderId, 20, 1);
    let synced = 0;

    for (const msg of messages) {
      try {
        await zoho.triageIncomingEmail(msg.messageId, inbox.folderId);
        synced++;
      } catch (err) {
        console.warn(`[sync-zoho-inbox] triage failed for ${msg.messageId}:`, err);
      }
    }

    return { userId, tenantId, synced };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { userId, tenantId, synced: 0, error: message };
  }
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
  for (const row of integrations || []) {
    if (!row.user_id || !row.tenant_id) continue;
    const result = await syncUserInbox(row.user_id, row.tenant_id);
    results.push(result);
  }

  return NextResponse.json({
    ok: true,
    processed: results.length,
    results,
  });
}
