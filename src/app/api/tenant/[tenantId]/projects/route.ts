import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const optionalDate = z.union([z.string().date(), z.string().datetime(), z.literal(''), z.null()]).optional();
const schema = z.object({
  name: z.string().trim().min(1).max(200),
  ownerId: z.string().uuid().optional(),
  ownerName: z.string().trim().max(300).optional(),
  category: z.string().trim().max(120).default('General'),
  status: z.string().trim().min(1).max(80).default('Pending'),
  currentStage: z.string().trim().min(1).max(120).default('Discovery'),
  progress: z.number().min(0).max(100).default(0),
  dueDate: optionalDate,
  startDate: optionalDate,
  team: z.array(z.string().uuid()).max(100).default([]),
  image: z.string().url().max(2000).nullable().optional(),
  description: z.string().max(10_000).nullable().optional(),
  contractStatus: z.string().max(80).default('None'),
  contractText: z.string().max(100_000).nullable().optional(),
  externalUrl: z.string().url().max(2000).nullable().optional(),
  isPublic: z.boolean().default(false),
  showInPortfolio: z.boolean().default(false),
  clientId: z.string().uuid().nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  budget: z.number().min(0).max(1_000_000_000).nullable().optional(),
  risk: z.string().max(40).nullable().optional(),
  health: z.string().max(40).nullable().optional(),
  resources: z.array(z.string().max(300)).max(200).default([]),
  budgetTotal: z.number().min(0).max(1_000_000_000).nullable().optional(),
  budgetUsed: z.number().min(0).max(1_000_000_000).default(0),
  velocityScore: z.number().min(0).max(100).nullable().optional(),
  healthScore: z.number().min(0).max(100).nullable().optional(),
  portalEnabled: z.boolean().default(false),
  estimatedCompletionDate: optionalDate,
  autoInvoiceEnabled: z.boolean().default(false),
  templateId: z.string().uuid().optional(),
});

const cleanDate = (value: string | null | undefined) => value ? value.slice(0, 10) : null;

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid project details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const input = parsed.data;
    const ownerId = input.ownerId || user.id;
    const admin = createSupabaseAdminClient();
    const memberIds = [...new Set([ownerId, ...input.team])];
    const { data: members, error: memberError } = await admin.from('tenant_users').select('user_id').eq('tenant_id', tenantId).in('user_id', memberIds);
    if (memberError) throw memberError;
    if ((members || []).length !== memberIds.length) return NextResponse.json({ error: 'Project owner and team must belong to this workspace' }, { status: 400 });
    const { data: ownerProfile } = await admin.from('profiles').select('full_name, name, email').eq('id', ownerId).maybeSingle();

    let phases: any[] = [];
    if (input.templateId) {
      const { data: template, error: templateError } = await admin.from('project_templates').select('id').eq('id', input.templateId).eq('tenant_id', tenantId).maybeSingle();
      if (templateError) throw templateError;
      if (!template) return NextResponse.json({ error: 'Project template not found' }, { status: 404 });
      const { data, error } = await admin.from('project_template_phases').select('*').eq('template_id', input.templateId).order('order_index');
      if (error) throw error;
      phases = data || [];
    }

    const portalToken = input.portalEnabled ? crypto.randomUUID().replace(/-/g, '') : null;
    const { data: project, error } = await admin.from('projects').insert({
      tenant_id: tenantId,
      owner_id: ownerId,
      owner_name: input.ownerName || ownerProfile?.full_name || ownerProfile?.name || ownerProfile?.email || user.email || 'Workspace member',
      name: input.name,
      category: input.category,
      status: input.status,
      current_stage: input.currentStage,
      progress: input.progress,
      due_date: cleanDate(input.dueDate),
      start_date: cleanDate(input.startDate),
      team: input.team,
      image: input.image || null,
      description: input.description || null,
      contract_status: input.contractStatus,
      contract_text: input.contractText || null,
      external_url: input.externalUrl || null,
      is_public: input.isPublic,
      show_in_portfolio: input.showInPortfolio,
      client_id: input.clientId || null,
      location: input.location || null,
      budget: input.budget ?? null,
      risk: input.risk || null,
      health: input.health || null,
      resources: input.resources,
      budget_total: input.budgetTotal ?? null,
      budget_used: input.budgetUsed,
      velocity_score: input.velocityScore ?? null,
      health_score: input.healthScore ?? null,
      portal_token: portalToken,
      portal_enabled: input.portalEnabled,
      estimated_completion_date: cleanDate(input.estimatedCompletionDate),
      auto_invoice_enabled: input.autoInvoiceEnabled,
    }).select('*').single();
    if (error) throw error;

    if (phases.length) {
      const start = new Date(input.startDate || project.created_at);
      const { error: phaseError } = await admin.from('project_milestones').insert(phases.map((phase) => ({
        project_id: project.id,
        name: phase.name,
        description: phase.description,
        status: 'pending',
        order_index: phase.order_index,
        due_date: new Date(start.getTime() + Number(phase.relative_days_from_start || 0) * 86_400_000).toISOString(),
      })));
      if (phaseError) {
        await admin.from('projects').delete().eq('id', project.id).eq('tenant_id', tenantId);
        throw phaseError;
      }
    }

    const { error: eventError } = await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'project_created', payload: { projectId: project.id, actorUserId: user.id, templateId: input.templateId || null } });
    if (eventError) console.error('[projects] project_created event could not be recorded', eventError);
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Project could not be created', req); }
}
