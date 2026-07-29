import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
<<<<<<< HEAD
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
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
=======
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const CreateContractSchema = z.object({
  title: z.string().min(1),
  client_id: z.string().uuid(),
  content: z.string().min(1),
  type: z.string().optional().default('service_agreement'),
>>>>>>> origin/main
  metadata: z.record(z.string(), z.any()).optional(),
  tenantId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
<<<<<<< HEAD
  let quotaReservation: { tenantId: string; userId: string } | null = null;
=======
>>>>>>> origin/main
  try {
    const body = await req.json();
    const parsed = CreateContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

<<<<<<< HEAD
    const { tenantId, client_id, project_id, title, content, type, status, metadata, admin_signature, admin_signed_at, payment_due_date, payment_amount, payment_status } = parsed.data;
    const { user, admin } = await requireTenantAccess(tenantId, req);

    // 1. Verify party belongs to tenant (unified contact or legacy business client)
    const { data: contact, error: contactError } = client_id ? await admin
=======
    const { tenantId, client_id, title, content, type, metadata } = parsed.data;
    const { user } = await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    // 1. Verify client belongs to tenant
    const { data: client, error: clientError } = await admin
>>>>>>> origin/main
      .from('contacts')
      .select('id')
      .eq('id', client_id)
      .eq('tenant_id', tenantId)
<<<<<<< HEAD
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

    // 2. Create the canonical shared document first. Contract Manager owns
    // lifecycle metadata; Documents owns the content/version surface.
    const { data: sharedDocument, error: documentError } = await admin
      .from('documents')
      .insert({
        tenant_id: tenantId,
        title,
        name: title,
        content,
        document_type: 'contract',
        status: 'draft',
        owner_user_id: user.id,
        uploaded_by: user.id,
        metadata: { contract_type: type, source: 'contract_manager' },
      })
      .select('id')
      .single();
    if (documentError) throw documentError;

    // 3. Insert contract
=======
      .maybeSingle();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Invalid client_id for this tenant' }, { status: 422 });
    }

    // 2. Insert contract
>>>>>>> origin/main
    const { data: contract, error: contractError } = await admin
      .from('contracts')
      .insert({
        tenant_id: tenantId,
<<<<<<< HEAD
        client_id: client_id || null,
        project_id: project_id || null,
        owner_id: user.id,
        owner_user_id: user.id,
        document_id: sharedDocument.id,
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
=======
        client_id,
        title,
        content,
        type,
        status: 'draft',
>>>>>>> origin/main
        metadata: { ...metadata, created_by_api: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

<<<<<<< HEAD
    if (contractError) {
      await admin.from('documents').delete().eq('tenant_id', tenantId).eq('id', sharedDocument.id);
      throw contractError;
    }

    await admin.from('document_relationships').insert({
      tenant_id: tenantId,
      document_id: sharedDocument.id,
      entity_type: 'contract',
      entity_id: contract.id,
      relationship_type: 'belongs_to',
      is_primary: true,
      created_by: user.id,
    });
    if (client_id) {
      await admin.from('document_relationships').insert({
        tenant_id: tenantId, document_id: sharedDocument.id, entity_type: 'customer',
        entity_id: client_id, relationship_type: 'signed_agreement', created_by: user.id,
      });
    }
    if (project_id) {
      await admin.from('document_relationships').insert({
        tenant_id: tenantId, document_id: sharedDocument.id, entity_type: 'project',
        entity_id: project_id, relationship_type: 'project_file', created_by: user.id,
      });
    }

    // 4. Create initial approval gate record
    const { error: approvalError } = await admin.from('contract_approvals').insert({
=======
    if (contractError) throw contractError;

    // 3. Create initial approval gate record
    await admin.from('contract_approvals').insert({
>>>>>>> origin/main
      contract_id: contract.id,
      tenant_id: tenantId,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
<<<<<<< HEAD
    if (approvalError) {
      await admin.from('contracts').delete().eq('id', contract.id).eq('tenant_id', tenantId);
      throw approvalError;
    }
    quotaReservation = null;

    // 5. Audit Log
    const { error: auditError } = await admin.from('audit_logs').insert({
=======

    // 4. Audit Log
    await admin.from('audit_logs').insert({
>>>>>>> origin/main
      tenant_id: tenantId,
      user_id: user.id,
      action: 'contract_created',
      entity_type: 'contract',
      entity_id: contract.id,
      new_values: contract,
      created_at: new Date().toISOString()
    });
<<<<<<< HEAD
    if (auditError) console.error('[contracts] create audit could not be recorded', auditError);

    return NextResponse.json({ success: true, data: contract }, { status: 201 });
  } catch (error) {
    if (quotaReservation) await releaseDailyResourceQuota(quotaReservation.tenantId, quotaReservation.userId, 'contracts');
=======

    return NextResponse.json({ success: true, data: contract });
  } catch (error) {
>>>>>>> origin/main
    return routeErrorResponse(error, 'Failed to create contract', req);
  }
}
