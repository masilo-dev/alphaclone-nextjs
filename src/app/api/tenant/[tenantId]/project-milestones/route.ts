import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { assertPermission } from '@/lib/mcp/connector/permissions';
import { mutateProjectMilestone } from '@/lib/projects/milestoneMutationServer';

const schema = z.object({
  id: z.string().uuid().optional(), projectId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200).optional(), description: z.string().max(10000).nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
  dueDate: z.union([z.string().date(), z.string().datetime({ offset: true }), z.literal(''), z.null()]).optional(),
  orderIndex: z.number().int().min(0).optional(),
});
type Context = { params: Promise<{ tenantId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    const projectId = request.nextUrl.searchParams.get('projectId');
    if (!z.string().uuid().safeParse(projectId).success) return NextResponse.json({ error: 'Valid projectId required' }, { status: 400 });
    const { admin } = await requireTenantAccess(tenantId, request);
    const project = await admin.from('projects').select('id').eq('id', projectId!).eq('tenant_id', tenantId).maybeSingle();
    if (project.error) throw project.error;
    if (!project.data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data, error } = await admin.from('project_milestones').select('*').eq('project_id', projectId!).or(`tenant_id.eq.${tenantId},tenant_id.is.null`).is('deleted_at', null).order('order_index').order('created_at');
    if (error) throw error;
    return NextResponse.json({ milestones: data || [] });
  } catch (error) { return routeErrorResponse(error, 'Milestones could not be loaded', request); }
}
async function write(request: NextRequest, context: Context, action: 'created' | 'updated' | 'deleted') {
  try {
    const { tenantId } = await context.params;
    const { admin, user } = await requireTenantAccess(tenantId, request);
    await assertPermission(tenantId, user.id, 'crm:write');
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success || (action === 'created' ? !parsed.data.projectId || !parsed.data.name : !parsed.data.id)) return NextResponse.json({ error: 'Valid milestone fields required' }, { status: 400 });
    const result = await mutateProjectMilestone({ admin, tenantId, userId: user.id, action, input: parsed.data });
    return NextResponse.json(result);
  } catch (error) { return routeErrorResponse(error, 'Milestone could not be saved', request); }
}
export const POST = (request: NextRequest, context: Context) => write(request, context, 'created');
export const PATCH = (request: NextRequest, context: Context) => write(request, context, 'updated');
export const DELETE = (request: NextRequest, context: Context) => write(request, context, 'deleted');
