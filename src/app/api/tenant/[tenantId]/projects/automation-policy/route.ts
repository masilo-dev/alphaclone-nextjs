import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const policySchema = z.object({
  name: z.string().trim().min(1).max(120).default('Default project kickoff'),
  enabled: z.boolean().default(false),
  triggerEvent: z.enum(['contract.signed', 'payment.received']).default('contract.signed'),
  templateId: z.string().uuid().nullable().optional(),
  requireSignedContract: z.boolean().default(true),
  requireDeposit: z.boolean().default(false),
  minimumDepositAmount: z.number().nonnegative().nullable().optional(),
  minimumDepositPercent: z.number().min(0).max(100).nullable().optional(),
  createCalendarEvents: z.boolean().default(true),
  createApprovalCheckpoints: z.boolean().default(true),
  createInvoiceCheckpoints: z.boolean().default(true),
  createDocumentRequirements: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('project_automation_policies')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ policies: data || [] });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string }> },
) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = policySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid project automation policy', fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const admin = createSupabaseAdminClient();

    if (input.templateId) {
      const { data: template, error: templateError } = await admin
        .from('project_templates')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('id', input.templateId)
        .maybeSingle();
      if (templateError) throw templateError;
      if (!template) return NextResponse.json({ error: 'Project template not found' }, { status: 404 });
    }

    const { data: existing, error: existingError } = await admin
      .from('project_automation_policies')
      .select('id, version')
      .eq('tenant_id', tenantId)
      .eq('name', input.name)
      .maybeSingle();
    if (existingError) throw existingError;

    const row = {
      tenant_id: tenantId,
      name: input.name,
      enabled: input.enabled,
      trigger_event: input.triggerEvent,
      template_id: input.templateId || null,
      require_signed_contract: input.requireSignedContract,
      require_deposit: input.requireDeposit,
      minimum_deposit_amount: input.minimumDepositAmount ?? null,
      minimum_deposit_percent: input.minimumDepositPercent ?? null,
      create_calendar_events: input.createCalendarEvents,
      create_approval_checkpoints: input.createApprovalCheckpoints,
      create_invoice_checkpoints: input.createInvoiceCheckpoints,
      create_document_requirements: input.createDocumentRequirements,
      config: input.config,
      version: (existing?.version || 0) + 1,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
      ...(existing ? {} : { created_by: user.id }),
    };

    const query = existing
      ? admin.from('project_automation_policies').update(row).eq('id', existing.id).eq('tenant_id', tenantId)
      : admin.from('project_automation_policies').insert(row);
    const { data, error } = await query.select('*').single();
    if (error) throw error;

    return NextResponse.json({ policy: data });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
