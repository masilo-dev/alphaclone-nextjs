import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { requireAuthenticatedUser } from '@/lib/apiAuth';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export async function GET(req: NextRequest, context: { params: Promise<{ identifier: string }> }) {
  try {
    const identifier = decodeURIComponent((await context.params).identifier || '').trim();
    if (!identifier || identifier.length > 160) return NextResponse.json({ error: 'Invalid meeting link' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    let call: any = null;
    let resolvedByAccessToken = false;
    if (isUuid(identifier)) {
      const result = await admin.from('video_calls').select('id, tenant_id, host_id, title, status, is_public, is_permanent, daily_room_url, metadata').eq('id', identifier).maybeSingle();
      if (result.error) throw result.error;
      call = result.data;
    } else {
      const { data: meetingLink, error: linkError } = await admin.from('meeting_links').select('meeting_id, expires_at').eq('link_token', identifier).maybeSingle();
      if (linkError) throw linkError;
      if (meetingLink && new Date(meetingLink.expires_at).getTime() > Date.now()) {
        const result = await admin.from('video_calls').select('id, tenant_id, host_id, title, status, is_public, is_permanent, daily_room_url, metadata').eq('id', meetingLink.meeting_id).maybeSingle();
        if (result.error) throw result.error;
        call = result.data;
        resolvedByAccessToken = Boolean(call);
      }
      const { data: tenant, error: tenantError } = call ? { data: null, error: null } : await admin.from('tenants').select('id').eq('slug', identifier).is('deletion_pending_at', null).maybeSingle();
      if (tenantError) throw tenantError;
      if (tenant) {
        const result = await admin.from('video_calls').select('id, tenant_id, host_id, title, status, is_public, is_permanent, daily_room_url, metadata').eq('tenant_id', tenant.id).eq('is_permanent', true).neq('status', 'cancelled').order('created_at', { ascending: true }).limit(1).maybeSingle();
        if (result.error) throw result.error;
        call = result.data;
      }
    }
    if (!call) return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    if (call.status === 'ended' || call.status === 'cancelled') return NextResponse.json({ error: 'This meeting has ended' }, { status: 410 });
    const metadata = call.metadata && typeof call.metadata === 'object' ? call.metadata : {};
    const provider = metadata.video_provider === 'teams' ? 'teams' : metadata.video_provider === 'jitsi' ? 'jitsi' : metadata.provider === 'daily' ? 'daily' : 'livekit';
    const startedAt = Number(metadata.meeting_started_at || 0);
    const pinExpired = Boolean(startedAt && Date.now() - startedAt > 35 * 60 * 1000);
    let canBypassPin = false;
    let isAuthenticated = false;
    try {
      const auth = await requireAuthenticatedUser(req);
      isAuthenticated = true;
      if (auth.user.id === call.host_id) canBypassPin = true;
      else if (call.tenant_id) {
        const { data: membership } = await auth.supabase.from('tenant_users').select('user_id').eq('tenant_id', call.tenant_id).eq('user_id', auth.user.id).maybeSingle();
        canBypassPin = Boolean(membership);
      }
    } catch { /* public resolution intentionally supports unauthenticated guests */ }
    if (!call.is_public && !resolvedByAccessToken && !canBypassPin) {
      return NextResponse.json(
        { error: isAuthenticated ? 'You do not have access to this meeting' : 'Sign in to access this meeting' },
        { status: isAuthenticated ? 403 : 401 },
      );
    }
    return NextResponse.json({ meeting: { callId: call.id, title: call.title, status: call.status, isPublic: Boolean(call.is_public), isPermanent: Boolean(call.is_permanent), provider, joinUrl: provider === 'livekit' ? null : call.daily_room_url || null, requiresPin: Boolean(metadata.meeting_pin) && !canBypassPin && !resolvedByAccessToken, pinExpired: pinExpired && !canBypassPin && !resolvedByAccessToken, resolvedByAccessToken } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return clientErrorResponse(error, { request: req, scope: 'meetings/resolve.GET' });
  }
}
