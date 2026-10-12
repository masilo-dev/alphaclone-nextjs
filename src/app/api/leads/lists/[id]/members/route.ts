import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const addSchema = z.object({
  workspaceId: z.string().uuid(),
  candidateIds: z.array(z.string().uuid()).max(500).optional(),
  contactIds: z.array(z.string().uuid()).max(500).optional(),
}).refine(
  (data) => (data.candidateIds && data.candidateIds.length > 0) || (data.contactIds && data.contactIds.length > 0),
  { message: 'Either candidateIds or contactIds must be provided' }
);

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

    const rows: Array<Record<string, unknown>> = [];

    for (const candidateId of input.candidateIds || []) {
      rows.push({
        workspace_id: input.workspaceId,
        created_by: user.id,
        list_id: listId,
        candidate_id: candidateId,
        added_by: user.id,
      });
    }

    for (const contactId of input.contactIds || []) {
      rows.push({
        workspace_id: input.workspaceId,
        created_by: user.id,
        list_id: listId,
        contact_id: contactId,
        added_by: user.id,
      });
    }

    const candidateIds = input.candidateIds || [];
    const contactIds = input.contactIds || [];

    const [{ data: existingCandidates }, { data: existingContacts }] = await Promise.all([
      candidateIds.length > 0
        ? admin.from('lead_list_members').select('candidate_id').eq('list_id', listId).in('candidate_id', candidateIds)
        : Promise.resolve({ data: [] }),
      contactIds.length > 0
        ? admin.from('lead_list_members').select('contact_id').eq('list_id', listId).in('contact_id', contactIds)
        : Promise.resolve({ data: [] }),
    ]);

    const existingCandidateSet = new Set((existingCandidates || []).map((r: { candidate_id: string | null }) => r.candidate_id).filter(Boolean));
    const existingContactSet = new Set((existingContacts || []).map((r: { contact_id: string | null }) => r.contact_id).filter(Boolean));

    const newRows = rows.filter((row) => {
      if (row.candidate_id && existingCandidateSet.has(row.candidate_id as string)) return false;
      if (row.contact_id && existingContactSet.has(row.contact_id as string)) return false;
      return true;
    });

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
