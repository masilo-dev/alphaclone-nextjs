import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireTenantAccess, routeErrorResponse } from "@/lib/apiAuth";
import {
  normalizeProjectStage,
  normalizeProjectStatus,
  toCanonicalProjectStage,
} from "@/lib/projects/projectEnums";
import { appendWorkspaceActivity } from "@/services/finance/workspaceActivityService";
import { notifyProjectClientDetails } from '@/lib/projects/projectClientNotification';

const optionalDate = z.union([z.string(), z.null()]).optional().transform((val) => (val && val.trim().length > 0 ? val.trim() : null));
const optionalUuid = z.union([z.string(), z.null()]).optional().transform((val) => (val && z.string().uuid().safeParse(val.trim()).success ? val.trim() : undefined));
const optionalNullableUuid = z.union([z.string(), z.null()]).optional().transform((val) => (val && z.string().uuid().safeParse(val.trim()).success ? val.trim() : null));
const optionalUrl = z.union([z.string(), z.null()]).optional().transform((val) => (val && z.string().url().safeParse(val.trim()).success ? val.trim() : null));
const optionalNumber = z.union([z.number(), z.string().transform((v) => parseFloat(v)), z.null()]).optional().transform((val) => (typeof val === 'number' && !isNaN(val) ? val : null));

const schema = z.object({
  isTestData:z.boolean().optional(),historicalImport:z.boolean().optional(),projectType:z.string().optional(),progressMethod:z.enum(['task_based','weighted_tasks','milestones','manual']).optional(),
  name: z.string().trim().min(1).max(200), ownerId: optionalUuid, ownerName: z.string().trim().max(300).optional(),
  category: z.string().trim().max(120).default("General"), status: z.string().trim().min(1).max(80).default("Pending"),
  currentStage: z.string().trim().min(1).max(120).default("Initiation"), progress: z.union([z.number(), z.string().transform((v) => parseFloat(v))]).default(0),
  dueDate: optionalDate, startDate: optionalDate,
  team: z.union([z.array(z.string()), z.null()]).optional().default([]).transform((arr) => (arr || []).filter((id) => Boolean(id) && z.string().uuid().safeParse(id.trim()).success)),
  image: optionalUrl, description: z.string().max(10_000).nullable().optional(), contractStatus: z.string().max(80).default("None"),
  contractText: z.string().max(100_000).nullable().optional(), externalUrl: optionalUrl, isPublic: z.boolean().default(false), showInPortfolio: z.boolean().default(false),
  clientId: optionalNullableUuid, location: z.string().max(500).nullable().optional(), budget: optionalNumber, risk: z.string().max(40).nullable().optional(), health: z.string().max(40).nullable().optional(),
  resources: z.union([z.array(z.string()), z.null()]).optional().default([]).transform((arr) => (arr || []).map((s) => String(s).trim()).filter(Boolean)),
  budgetTotal: optionalNumber, budgetUsed: z.union([z.number(), z.string().transform((v) => parseFloat(v))]).default(0), velocityScore: optionalNumber, healthScore: optionalNumber,
  portalEnabled: z.boolean().default(false), estimatedCompletionDate: optionalDate, autoInvoiceEnabled: z.boolean().default(false), templateId: optionalUuid,
});

const cleanDate = (value: string | null | undefined) => value ? value.slice(0, 10) : null;

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid project details", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const input = parsed.data;
    const status = normalizeProjectStatus(input.status) || "Pending";
    const currentStage = toCanonicalProjectStage(input.currentStage);
    const ownerId = input.ownerId || user.id;
    const admin = createSupabaseAdminClient();
    const headerKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key');

    const { executeProjectCreateCommand } = await import('@/lib/execution/commands/projectCreateCommand');
    const execution = await executeProjectCreateCommand({
      tenantId, userId: user.id, executionSource: 'ui', idempotencyKey: headerKey || undefined,
      input: {name: input.name, clientId: input.clientId, status, currentStage,
        category: input.category, description: input.description, dueDate: cleanDate(input.dueDate),
        ownerId, ownerName: input.ownerName || user.email || 'Workspace member', templateId: input.templateId,isTestData:input.isTestData,historicalImport:input.historicalImport,projectType:input.projectType,progressMethod:input.progressMethod,
        extras: {start_date: cleanDate(input.startDate), team: input.team, resources: input.resources,
          image: input.image, external_url: input.externalUrl, budget: input.budget, budget_total: input.budgetTotal,
          estimated_completion_date: cleanDate(input.estimatedCompletionDate), portal_enabled: input.portalEnabled,is_public:input.isPublic,show_in_portfolio:input.showInPortfolio},
      },
    });
    if (!execution.ok || !execution.result) return NextResponse.json({error: execution.error?.message || 'Project creation failed',code:execution.failure_code}, {status:execution.failure_code==='APPROVAL_REQUIRED'?202:422});
    return NextResponse.json({...execution.result,execution_id:execution.execution_id,idempotency_key:execution.idempotency_key}, {status:execution.result.created?201:200});
  } catch (error) {
    return routeErrorResponse(error, 'Project could not be created', req);
  }
}
