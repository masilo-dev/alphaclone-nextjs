import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveClientByPortalToken } from '@/services/finance/clientFinancePortalService';

const schema = z.object({ token: z.string().uuid(), approvalId: z.string().uuid(), decision: z.enum(['approved', 'changes_requested']), comment: z.string().trim().max(5000).optional() });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => ({}));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid approval response' }, { status: 400 });
  try {
    const admin = await resolveSupabaseAdminClient(); const client = await resolveClientByPortalToken(admin, parsed.data.token);
    if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    const { data: approval, error: lookupError } = await admin.from('project_client_approvals').select('id, project_id').eq('id', parsed.data.approvalId).eq('tenant_id', client.tenant_id).maybeSingle();
    if (lookupError) throw lookupError; if (!approval) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    const { data: project } = await admin.from('projects').select('id').eq('id', approval.project_id).eq('client_id', client.id).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    const now = new Date().toISOString();
    const { error } = await admin.from('project_client_approvals').update({ status: parsed.data.decision, decided_at: now, last_actor_type: 'client', last_actor_name: client.name, last_actor_email: client.email || null, updated_at: now }).eq('id', approval.id).eq('tenant_id', client.tenant_id);
    if (error) throw error;
    // The approval-status trigger appends the immutable history row.
    await admin.from('client_portal_events').insert({ tenant_id: client.tenant_id, client_id: client.id, project_id: approval.project_id, event_type: 'feedback_submitted', metadata: { title: parsed.data.decision === 'approved' ? 'Approval completed' : 'Changes requested', approval_id: approval.id } });
    return NextResponse.json({ success: true });
  } catch (error) { console.error('[client-finance/approvals]', error); return NextResponse.json({ error: 'Approval could not be recorded' }, { status: 500 }); }
}
