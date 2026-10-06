import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

/** Read-only checklist projection; no tutorial clicks or provider secrets count as success. */
export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, req);
    const scoped = (table: string) => admin.from(table).select('id').eq('tenant_id', tenantId).limit(1);
    const [business, client, project, mailbox, social, execution] = await Promise.all([
      admin.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
      scoped('business_clients'), scoped('projects'),
      scoped('outbound_mailboxes').eq('connection_state', 'connected').is('deleted_at', null),
      scoped('social_identities').eq('is_active', true).eq('can_publish', true),
      scoped('external_actions').eq('status', 'completed').not('completed_at', 'is', null),
    ]);
    const exists = (result: { data: unknown[] | null; error: unknown }) =>
      result.error ? null : Boolean(result.data?.length);
    return NextResponse.json({ progress: {
      profile: business.error ? null : Boolean(business.data?.name?.trim()),
      client: exists(client), project: exists(project), email: exists(mailbox),
      social: exists(social), execution: exists(execution),
    } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return routeErrorResponse(error, 'Getting started progress could not be loaded', req); }
}
