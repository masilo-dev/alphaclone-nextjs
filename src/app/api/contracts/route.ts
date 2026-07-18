import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { consumeDailyResourceQuota, releaseDailyResourceQuota } from '@/lib/server/dailyResourceQuota';

const CreateContractSchema = z.object({
  title: z.string().trim().min(1).max(300),
  client_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  content: z.string().min(1).max(500_000),
  type: z.string().trim().max(100).optional().default('service_agreement'),
  status: z.enum(['draft', 'pending_approval', 'sent']).optional().default('draft'),
  admin_signature: z.string().max(2_000_000).nullable().optional(),
  admin_signed_at: z.string().datetime().nullable().optional(),
  payment_due_date: z.union([z.string().date(), z.string().datetime(), z.null()]).optional(),
  payment_amount: z.coerce.number().min(0).max(1_000_000_000).nullable().optional(),
  payment_status: z.enum(['pending', 'paid', 'overdue', 'waived']).optional().default('pending'),
  metadata: z.record(z.string(), z.any()).optional(),
  tenantId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  let quotaReservation: { tenantId: string; userId: string } | null = null;
  try {
    const body = await req.json();
    const parsed = CreateContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { tenantId, client_id, project_id, title, content, type, status, metadata, admin_signature, admin_signed_at, payment_due_date, payment_amount, payment_status } = parsed.data;
    const { user } = await requireTenantAccess(tenantId, req);
    const admin = createAdminSupabaseClientOrThrow();

    // 1. Verify party belongs to tenant (unified contact or legacy business client)
    const { data: contact, error: contactError } = client_id ? await admin
      .from('contacts')
      .select('id')
      .eq('id', client_id)
      .eq('tenant_id', tenantId)
      .maybeSingle() : { data: null, error: null };

    const { data: businessClient } = client_id && !contact
      ? await admin
          .from('business_clients')
          .select('id')
          .eq('id', client_id)
          .eq('tenant_id', tenantId)
          .maybeSingle()
      : { data: null };

    if (contactError || (client_id && !contact && !businessClient)) {
      return NextResponse.json({ error: 'Invalid client_id for this tenant' }, { status: 422 });
    }
    if (project_id) {
      const { data: project, error: projectError } = await admin.from('projects').select('id').eq('id', project_id).eq('tenant_id', tenantId).maybeSingle();
      if (projectError) throw projectError;
      if (!project) return NextResponse.json({ error: 'Invalid project_id for this tenant' }, { status: 422 });
    }
    await consumeDailyResourceQuota(tenantId, user.id, 'contracts');
    quotaReservation = { tenantId, userId: user.id };

    // 2. Insert contract
    const { data: contract, error: contractError } = await admin
      .from('contracts')
      .insert({
        tenant_id: tenantId,
        client_id: client_id || null,
        project_id: project_id || null,
        owner_id: user.id,
        title,
        content,
        type,
        status,
        signing_token: crypto.randomUUID(),
        admin_signature: admin_signature || null,
        admin_signed_at: admin_signed_at || null,
        payment_due_date: payment_due_date ? payment_due_date.slice(0, 10) : null,
        payment_amount: payment_amount ?? null,
        payment_status,
        metadata: { ...metadata, created_by_api: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (contractError) throw contractError;

    // 3. Create initial approval gate record
    const { error: approvalError } = await admin.from('contract_approvals').insert({
      contract_id: contract.id,
      tenant_id: tenantId,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    if (approvalError) {
      await admin.from('contracts').delete().eq('id', contract.id).eq('tenant_id', tenantId);
      throw approvalError;
    }
    quotaReservation = null;

    // 4. Audit Log
    const { error: auditError } = await admin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: 'contract_created',
      entity_type: 'contract',
      entity_id: contract.id,
      new_values: contract,
      created_at: new Date().toISOString()
    });
    if (auditError) console.error('[contracts] create audit could not be recorded', auditError);

    return NextResponse.json({ success: true, data: contract }, { status: 201 });
  } catch (error) {
    if (quotaReservation) await releaseDailyResourceQuota(quotaReservation.tenantId, quotaReservation.userId, 'contracts');
    return routeErrorResponse(error, 'Failed to create contract', req);
  }
}
