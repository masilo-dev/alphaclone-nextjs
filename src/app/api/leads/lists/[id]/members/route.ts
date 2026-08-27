import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const addSchema = z.object({
  workspaceId: z.string().uuid(),
  candidateIds: z.array(z.string().uuid()).min(1).max(500),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: listId } = await context.params;
    const input = addSchema.parse(await req.json());
    const { user, admin } = await requireTenantAccess(input.workspaceId, req);

    const { data: list, error: listError } = await admin
      .from('lead_lists')
      .select('id, workspace_id')
      .eq('id', listId)
      .eq('workspace_id', input.workspaceId)
      .maybeSingle();

    if (listError) throw listError;
    if (!list) return NextResponse.json({ error: 'List not found' }, { status: 404 });

    const rows = input.candidateIds.map((candidateId) => ({
      workspace_id: input.workspaceId,
      created_by: user.id,
      list_id: listId,
      candidate_id: candidateId,
      added_by: user.id,
    }));

    const { data: existing, error: existingError } = await admin
      .from('lead_list_members')
      .select('candidate_id')
      .eq('list_id', listId)
      .in('candidate_id', input.candidateIds);

    if (existingError) throw existingError;

    const existingIds = new Set((existing || []).map((row: { candidate_id: string | null }) => row.candidate_id).filter(Boolean));
    const newRows = rows.filter((row) => !existingIds.has(row.candidate_id));

    if (newRows.length > 0) {
      const { error: insertError } = await admin.from('lead_list_members').insert(newRows);
      if (insertError) throw insertError;
    }

    const { count } = await admin
      .from('lead_list_members')
      .select('id', { count: 'exact', head: true })
      .eq('list_id', listId);

    await admin
      .from('lead_lists')
      .update({ lead_count: count || 0, updated_at: new Date().toISOString() })
      .eq('id', listId);

    return NextResponse.json({ added: newRows.length, leadCount: count || 0 });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to add leads to list', req);
  }
}
