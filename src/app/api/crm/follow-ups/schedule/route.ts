import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  entityType: z.enum(['contact', 'company', 'opportunity', 'deal', 'lead']),
  entityId: z.string().uuid(),
  followUpAt: z.string().min(1),
  note: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 });
    }

    const { tenantId, entityType, entityId, followUpAt, note } = parsed.data;
    const { user } = await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();

    if (entityType === 'contact') {
      await admin
        .from('contacts')
        .update({ next_followup_at: followUpAt, updated_at: new Date().toISOString() })
        .eq('id', entityId)
        .eq('tenant_id', tenantId);
    } else if (entityType === 'company') {
      await admin
        .from('companies')
        .update({ next_followup_at: followUpAt, updated_at: new Date().toISOString() })
        .eq('id', entityId)
        .eq('tenant_id', tenantId);
    } else if (entityType === 'opportunity') {
      await admin
        .from('opportunities')
        .update({ next_followup_at: followUpAt, updated_at: new Date().toISOString() })
        .eq('id', entityId)
        .eq('tenant_id', tenantId);
    } else if (entityType === 'deal') {
      await admin
        .from('deals')
        .update({
          next_step: note || 'Follow-up scheduled',
          metadata: { next_followup_at: followUpAt },
          updated_at: new Date().toISOString(),
        })
        .eq('id', entityId)
        .eq('tenant_id', tenantId);
    } else if (entityType === 'lead') {
      await admin
        .from('leads')
        .update({
          notes: note ? `${note}\n\nFollow-up: ${followUpAt}` : undefined,
          metadata: { next_followup_at: followUpAt },
          updated_at: new Date().toISOString(),
        })
        .eq('id', entityId)
        .eq('tenant_id', tenantId);
    }

    await admin.from('activities').insert({
      tenant_id: tenantId,
      type: 'task',
      subject: 'Follow-up scheduled',
      description: note || `Scheduled for ${followUpAt}`,
      contact_id: entityType === 'contact' ? entityId : null,
      company_id: entityType === 'company' ? entityId : null,
      opportunity_id: entityType === 'opportunity' ? entityId : null,
      created_by: user.id,
      status: 'pending',
      priority: 'normal',
      is_automated: false,
      source: 'follow_up_queue',
      scheduled_at: followUpAt,
      due_date: followUpAt.split('T')[0],
      metadata: { entity_type: entityType, entity_id: entityId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to schedule follow-up', req);
  }
}
