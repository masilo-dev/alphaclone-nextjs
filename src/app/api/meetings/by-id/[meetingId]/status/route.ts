import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> },
) {
  try {
    const { meetingId } = await params;
    const admin = createSupabaseAdminClient();
    const { data: meeting, error } = await admin
      .from('video_calls')
      .select('id, tenant_id, title, status, ended_reason, started_at, ended_at, auto_end_scheduled_at')
      .eq('id', meetingId)
      .maybeSingle();

    if (error) throw error;
    if (!meeting?.tenant_id) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    await requireTenantAccess(meeting.tenant_id, req);

    const autoEndAt = meeting.auto_end_scheduled_at || null;
    const timeRemaining = autoEndAt
      ? Math.max(0, Math.floor((new Date(autoEndAt).getTime() - Date.now()) / 1000))
      : null;

    return NextResponse.json({
      meetingId: meeting.id,
      title: meeting.title,
      status: meeting.status,
      timeExceeded: timeRemaining === 0 && Boolean(autoEndAt),
      timeRemaining,
      autoEndAt,
      endReason: meeting.ended_reason,
      startedAt: meeting.started_at,
      endedAt: meeting.ended_at,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Meeting status could not be loaded', req);
  }
}
