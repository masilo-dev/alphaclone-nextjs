import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireClientPortalAccessDoubleGuarded } from '@/lib/auth/clientPortalAuth';
import { resolveClientByPortalToken } from '@/services/finance/clientFinancePortalService';
import { appendWorkspaceActivity } from '@/services/finance/workspaceActivityService';

const schema = z.object({ token: z.string().uuid(), approvalId: z.string().uuid(), decision: z.enum(['approved', 'changes_requested']), comment: z.string().trim().max(5000).optional() });

function mapAuthError(code: string): { status: number; message: string } {
  switch (code) {
    case 'NO_SESSION':
    case 'BAD_TOKEN':
    case 'SALT_ROTATED':
    case 'SESSION_REVOKED':
      return { status: 401, message: 'Session expired or invalid. Please log in again.' };
    case 'CLIENT_INACTIVE':
      return { status: 403, message: 'This portal account is not active.' };
    case 'TOKEN_MISMATCH':
      return { status: 403, message: 'Session does not match this portal.' };
    case 'BAD_PORTAL_TOKEN':
      return { status: 404, message: 'Portal not found.' };
    case 'INTERNAL_ERROR':
      return { status: 500, message: 'Server error.' };
    default:
      return { status: 403, message: 'Access denied.' };
  }
}

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid approval response' }, { status: 400 });
  try {
    const admin = await resolveSupabaseAdminClient();
    const guarded = await requireClientPortalAccessDoubleGuarded(admin, parsed.data.token, resolveClientByPortalToken);
    if (!guarded.ok) {
      const { status, message } = mapAuthError(guarded.error.code);
      return NextResponse.json({ error: message, code: guarded.error.code }, { status });
    }
    const client = guarded.resolvedClient;
    const { data: approval, error: lookupError } = await admin.from('project_client_approvals').select('id, project_id').eq('id', parsed.data.approvalId).eq('tenant_id', client.tenant_id).maybeSingle();
    if (lookupError) throw lookupError; if (!approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    const { data: project } = await admin.from('projects').select('id').eq('id', approval.project_id).eq('client_id', client.id).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    const now = new Date().toISOString();
    const { error } = await admin.from('project_client_approvals').update({ status: parsed.data.decision, decided_at: now, last_actor_type: 'client', last_actor_name: (client as any).name, last_actor_email: (client as any).email || null, updated_at: now }).eq('id', approval.id).eq('tenant_id', client.tenant_id);
    if (error) throw error;
    await admin.from('client_portal_events').insert({ tenant_id: client.tenant_id, client_id: client.id, project_id: approval.project_id, event_type: 'feedback_submitted', metadata: { title: parsed.data.decision === 'approved' ? 'Approval completed' : 'Changes requested', approval_id: approval.id } });

    void appendWorkspaceActivity(admin, {
      tenant_id: client.tenant_id,
      project_id: approval.project_id,
      client_id: client.id,
      invoice_id: null,
      contract_id: null,
      actor_type: 'client',
      actor_id: client.id,
      actor_display_name: (client as any).name ? `Client: ${(client as any).name}` : null,
      event_type: 'approval.decision',
      summary: parsed.data.decision === 'approved'
        ? `${(client as any).name || 'Client'} approved an approval request`
        : `${(client as any).name || 'Client'} requested changes on an approval request`,
      metadata: { approvalId: approval.id, decision: parsed.data.decision, comment: parsed.data.comment || null },
    }).catch((e) => console.error('[client-finance/approvals] workspace activity failed', e));

    return NextResponse.json({ success: true });
  } catch (error) { console.error('[client-finance/approvals]', error); return NextResponse.json({ error: 'Approval could not be recorded' }, { status: 500 }); }
}
