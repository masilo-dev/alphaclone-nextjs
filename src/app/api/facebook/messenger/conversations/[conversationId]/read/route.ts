import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function PATCH(req: NextRequest, context: { params: Promise<{ conversationId: string }> }) {
  try {
    const { conversationId } = await context.params;
    const admin = createSupabaseAdminClient();
    const { data: conversation, error: lookupError } = await admin.from('messenger_conversations').select('id, tenant_id, is_read').eq('id', conversationId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    await requireTenantAccess(conversation.tenant_id, req);
    if (!conversation.is_read) {
      const { error } = await admin.from('messenger_conversations').update({ is_read: true }).eq('id', conversation.id).eq('tenant_id', conversation.tenant_id);
      if (error) throw error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Conversation could not be marked as read', req);
  }
}
