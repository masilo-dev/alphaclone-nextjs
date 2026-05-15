import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const CreateContractSchema = z.object({
  title: z.string().min(1),
  client_id: z.string().uuid(),
  content: z.string().min(1),
  type: z.string().optional().default('service_agreement'),
  metadata: z.record(z.string(), z.any()).optional(),
  tenantId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateContractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
    }

    const { tenantId, client_id, title, content, type, metadata } = parsed.data;
    const { user } = await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    // 1. Verify client belongs to tenant
    const { data: client, error: clientError } = await admin
      .from('contacts')
      .select('id')
      .eq('id', client_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Invalid client_id for this tenant' }, { status: 422 });
    }

    // 2. Insert contract
    const { data: contract, error: contractError } = await admin
      .from('contracts')
      .insert({
        tenant_id: tenantId,
        client_id,
        title,
        content,
        type,
        status: 'draft',
        metadata: { ...metadata, created_by_api: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (contractError) throw contractError;

    // 3. Create initial approval gate record
    await admin.from('contract_approvals').insert({
      contract_id: contract.id,
      tenant_id: tenantId,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    // 4. Audit Log
    await admin.from('audit_logs').insert({
      tenant_id: tenantId,
      user_id: user.id,
      action: 'contract_created',
      entity_type: 'contract',
      entity_id: contract.id,
      new_values: contract,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true, data: contract });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to create contract', req);
  }
}
