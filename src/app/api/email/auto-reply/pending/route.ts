import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from('zoho_auto_responder_logs')
      .select('id, message_id, sender, sender_email, subject, draft_reply, triage_status, created_at')
      .eq('user_id', user.id)
      .in('triage_status', ['draft_ready', 'scheduled'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({
      drafts: (data || []).map((row: Record<string, unknown>) => ({
        id: row.id,
        messageId: row.message_id,
        from: row.sender,
        fromEmail: row.sender_email,
        subject: row.subject,
        body: row.draft_reply,
        status: row.triage_status,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load AI draft replies', req);
  }
}
