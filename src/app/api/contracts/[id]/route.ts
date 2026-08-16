import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import sanitizeHtml from 'sanitize-html';

const UpdateContractSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'sent', 'signed', 'void']).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  tenantId: z.string().uuid(),
});
const DeleteContractSchema = z.object({ tenantId: z.string().uuid() });

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const parsed = UpdateContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { tenantId, ...updatePayload } = parsed.data;
    const { user } = await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    // 1. Fetch current contract
    const { data: existing, error: fetchError } = await admin
      .from('contracts')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // 2. Status Guard: Block edits if approved or signed
    const immutableStatuses = ['approved', 'signed'];
    if (immutableStatuses.includes(existing.status)) {
      return NextResponse.json(
        { error: `Contract is in ${existing.status} status and cannot be modified. Void it or create a new version.` },
        { status: 409 }
      );
    }

    // 3. Versioning: Before update, save current state to versions
    if (updatePayload.content || updatePayload.title) {
        // Get current version count
        const { count } = await admin
          .from('contract_versions')
          .select('*', { count: 'exact', head: true })
          .eq('contract_id', id);

        await admin.from('contract_versions').insert({
          contract_id: id,
          tenant_id: tenantId,
          version_number: (count || 0) + 1,
          content: existing.content,
          saved_by: user.id,
          created_at: new Date().toISOString(),
        });
    }

    // 4. Sanitize Content
    if (updatePayload.content) {
      updatePayload.content = sanitizeHtml(updatePayload.content, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'table', 'tr', 'td']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          '*': ['style', 'class'],
        }
      });
    }

    // 5. Update Contract
    const { data: updated, error: updateError } = await admin
      .from('contracts')
      .update({
        ...updatePayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 6. Audit Log
    await admin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: 'contract_updated',
      entity_type: 'contract',
      entity_id: id,
      new_values: updatePayload,
      old_values: existing,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to update contract', req);
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Valid contract ID is required' }, { status: 400 });
    const parsed = DeleteContractSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Valid tenantId is required' }, { status: 400 });
    const { user } = await requireTenantAccess(parsed.data.tenantId, req);
    const admin = createAdminSupabaseClientOrThrow();
    const { data: contract, error: lookupError } = await admin.from('contracts').select('id,status,title').eq('id', id).eq('tenant_id', parsed.data.tenantId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    if (contract.status !== 'draft') return NextResponse.json({ error: 'Only draft contracts can be deleted. Void issued or signed contracts to preserve the legal record.' }, { status: 409 });
    const { error: fileError } = await admin.from('file_uploads').update({ deleted_at: new Date().toISOString() }).eq('tenant_id', parsed.data.tenantId).eq('entity_type', 'contract').eq('entity_id', id);
    if (fileError) throw fileError;
    const { error } = await admin.from('contracts').delete().eq('id', id).eq('tenant_id', parsed.data.tenantId);
    if (error) throw error;
    const { error: auditError } = await admin.from('audit_logs').insert({ tenant_id: parsed.data.tenantId, user_id: user.id, action: 'contract_deleted', entity_type: 'contract', entity_id: id, old_values: contract, created_at: new Date().toISOString() });
    if (auditError) console.error('[contracts] delete audit could not be recorded', auditError);
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Contract could not be deleted', req); }
}
