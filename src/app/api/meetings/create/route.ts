import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { start } from 'workflow/api';
import { videoRoomOrchestrationWorkflow } from '@/workflows/video-room-orchestration';
import { PLAN_PRICING, type SubscriptionPlan } from '@/services/tenancy/types';
import { isLaunchFreeWindow } from '@/lib/launchWindow';
import {
    createAdminSupabaseClientOrThrow,
    requireTenantAccess,
    routeErrorResponse,
} from '@/lib/apiAuth';

const schema = z.object({
    tenantId: z.string().uuid(),
    title: z.string().trim().min(1).max(160),
    hostId: z.string().uuid().optional(),
    maxParticipants: z.number().int().min(2).max(50).default(10),
    durationMinutes: z.number().int().min(5).max(1440).default(40),
    participants: z.array(z.string().uuid()).max(50).default([]),
    scheduledAt: z.string().datetime().optional(),
    recordingEnabled: z.boolean().default(false),
    screenShareEnabled: z.boolean().default(true),
    chatEnabled: z.boolean().default(true),
    isPublic: z.boolean().default(false),
    cancellationPolicyHours: z.number().int().min(0).max(168).default(3),
    allowClientCancellation: z.boolean().default(true),
    provider: z.enum(['livekit', 'teams']).default('livekit'),
    providerMeetingId: z.string().trim().max(500).optional(),
    joinUrl: z.string().url().max(2000).optional(),
}).superRefine((value, ctx) => {
    if (value.provider !== 'teams') return;
    if (!value.joinUrl) {
        ctx.addIssue({ code: 'custom', path: ['joinUrl'], message: 'A Teams join URL is required' });
        return;
    }
    const host = new URL(value.joinUrl).hostname.toLowerCase();
    if (host !== 'teams.microsoft.com' && !host.endsWith('.teams.microsoft.com')) {
        ctx.addIssue({ code: 'custom', path: ['joinUrl'], message: 'Invalid Microsoft Teams join URL' });
    }
});

/**
 * POST /api/meetings/create
 * 
 * App Router implementation of meeting creation
 */
export async function POST(req: NextRequest) {
    try {
        const parsed = schema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) return NextResponse.json({ error: 'Invalid meeting details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
        const {
            tenantId,
            title,
            hostId: requestedHostId,
            maxParticipants,
            durationMinutes,
            participants,
            scheduledAt,
            recordingEnabled,
            screenShareEnabled,
            chatEnabled,
            isPublic,
            cancellationPolicyHours,
            allowClientCancellation,
            provider,
            providerMeetingId,
            joinUrl,
        } = parsed.data;
        const access = await requireTenantAccess(tenantId, req);
        const { user } = access;

        const hostId = requestedHostId || user.id;

        // Validation
        if (!title || !hostId) {
            return NextResponse.json({ error: 'Title and hostId are required' }, { status: 400 });
        }

        if (hostId !== user.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const supabase = createAdminSupabaseClientOrThrow();

        const uniqueParticipants = [...new Set(participants.filter((participant) => participant !== user.id))];
        if (uniqueParticipants.length) {
            const { data: participantMembers, error: participantError } = await supabase.from('tenant_users').select('user_id').eq('tenant_id', tenantId).in('user_id', uniqueParticipants);
            if (participantError) throw participantError;
            if ((participantMembers || []).length !== uniqueParticipants.length) return NextResponse.json({ error: 'Every meeting participant must belong to this workspace' }, { status: 400 });
        }

        const { data: tenant, error: tenantError } = await supabase.from('tenants').select('subscription_plan').eq('id', tenantId).maybeSingle();
        if (tenantError) throw tenantError;
        const plan = (tenant?.subscription_plan && tenant.subscription_plan in PLAN_PRICING ? tenant.subscription_plan : 'free') as SubscriptionPlan;
        const planLimits = PLAN_PRICING[plan].features;
        const limitsWaived = isLaunchFreeWindow() || access.membership.role === 'super_admin';
        if (!limitsWaived && planLimits.maxVideoMeetingsPerMonth !== -1) {
            const monthStart = new Date();
            monthStart.setUTCDate(1);
            monthStart.setUTCHours(0, 0, 0, 0);
            const { count, error: countError } = await supabase.from('video_calls').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', monthStart.toISOString());
            if (countError) throw countError;
            if ((count || 0) >= planLimits.maxVideoMeetingsPerMonth) return NextResponse.json({ error: 'Monthly meeting limit reached for this workspace plan', code: 'MEETING_LIMIT_REACHED' }, { status: 429 });
        }
        const planDuration = limitsWaived || planLimits.maxVideoMinutesPerMeeting === -1
            ? 1440
            : planLimits.maxVideoMinutesPerMeeting;
        const actualDuration = Math.min(durationMinutes, planDuration);

        const roomName = `alphaclone-${crypto.randomUUID()}`;

        // Step 2: Create video_call in database
        const callPayload: Record<string, unknown> = {
            room_id: roomName,
            daily_room_url: provider === 'teams' ? joinUrl : null,
            daily_room_name: null,
            tenant_id: tenantId,
            host_id: hostId,
            title: title,
            status: 'scheduled',
            scheduled_at: scheduledAt || new Date().toISOString(),
            participants: uniqueParticipants,
            max_participants: maxParticipants,
            recording_enabled: recordingEnabled,
            screen_share_enabled: screenShareEnabled,
            chat_enabled: chatEnabled,
            duration_limit_minutes: actualDuration,
            cancellation_policy_hours: cancellationPolicyHours,
            allow_client_cancellation: allowClientCancellation,
            is_public: isPublic,
            metadata: {
                provider: provider === 'teams' ? 'external' : 'livekit',
                video_provider: provider,
                provider_room_name: provider === 'livekit' ? roomName : undefined,
                teams_meeting_id: provider === 'teams' ? providerMeetingId || null : undefined,
                teams_join_url: provider === 'teams' ? joinUrl : undefined,
            },
        };

        let { data: videoCall, error: videoCallError } = await supabase
            .from('video_calls')
            .insert(callPayload)
            .select()
            .single();

        if (videoCallError && (videoCallError.code === 'PGRST204' || /scheduled_at|schema cache/i.test(videoCallError.message))) {
            delete callPayload.scheduled_at;
            const fallback = await supabase
                .from('video_calls')
                .insert(callPayload)
                .select()
                .single();
            videoCall = fallback.data;
            videoCallError = fallback.error;
        }

        if (videoCallError || !videoCall) {
            console.error('[meetings/create] video_calls insert:', videoCallError);
            return NextResponse.json({ error: 'Failed to create video call', code: 'VIDEO_CALL_DB_ERROR' }, { status: 500 });
        }

        // Step 3: Generate secure token for meeting link
        const linkToken = crypto.randomBytes(32).toString('base64url');
        const meetingStartMs = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();
        const expiresAt = new Date(meetingStartMs + actualDuration * 60 * 1000).toISOString();

        // Step 4: Create meeting link
        const { data: meetingLink, error: linkError } = await supabase
            .from('meeting_links')
            .insert({
                meeting_id: videoCall.id,
                link_token: linkToken,
                expires_at: expiresAt,
                // Invitation links remain valid for reconnects and invited guests until expiry.
                max_uses: 100,
                use_count: 0,
                used: false,
                created_by: hostId
            })
            .select()
            .single();

        if (linkError || !meetingLink) {
            console.error('[meetings/create] meeting_links insert:', linkError);
            await supabase.from('video_calls').delete().eq('id', videoCall.id).eq('tenant_id', tenantId);
            return NextResponse.json({ error: 'Failed to create meeting link', code: 'MEETING_LINK_DB_ERROR' }, { status: 500 });
        }

        const invitationPath = `/meet/${linkToken}`;
        const { data: linkedVideoCall, error: invitationError } = await supabase
            .from('video_calls')
            .update({ metadata: { ...(videoCall.metadata || {}), invitation_path: invitationPath } })
            .eq('id', videoCall.id)
            .eq('tenant_id', tenantId)
            .select('*')
            .single();
        if (invitationError || !linkedVideoCall) {
            await supabase.from('meeting_links').delete().eq('id', meetingLink.id);
            await supabase.from('video_calls').delete().eq('id', videoCall.id).eq('tenant_id', tenantId);
            throw invitationError || new Error('Meeting invitation could not be linked');
        }

        let calendarEvent = null;
        if (scheduledAt) {
            const startTime = new Date(scheduledAt);
            const endTime = new Date(startTime.getTime() + actualDuration * 60 * 1000);
            const { data: event, error: eventError } = await supabase.from('calendar_events').insert({
                tenant_id: tenantId,
                user_id: user.id,
                title,
                description: `Video meeting: ${title}`,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                type: 'meeting',
                video_room_id: videoCall.room_id,
                attendees: [user.id, ...uniqueParticipants],
            }).select('*').single();
            if (eventError) {
                await supabase.from('meeting_links').delete().eq('id', meetingLink.id);
                await supabase.from('video_calls').delete().eq('id', videoCall.id).eq('tenant_id', tenantId);
                throw eventError;
            }
            calendarEvent = event;
            const { error: linkCalendarError } = await supabase.from('video_calls').update({ calendar_event_id: event.id }).eq('id', videoCall.id).eq('tenant_id', tenantId);
            if (linkCalendarError) throw linkCalendarError;
        }

        // Step 5: Return AlphaClone URL (not Daily.co URL)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
        const meetingUrl = `${baseUrl}/meet/${linkToken}`;

        let runId: string | null = null;
        try {
            const started = await start(videoRoomOrchestrationWorkflow, [{ meetingId: videoCall.id, tenantId }]);
            runId = started.runId;
        } catch (workflowError) {
            console.error('[meetings/create] deadline workflow could not start:', workflowError);
            await supabase.from('business_automation_events').insert({
                tenant_id: tenantId,
                event_type: 'meeting_deadline_workflow_start_failed',
                payload: { meetingId: videoCall.id, error: workflowError instanceof Error ? workflowError.message : 'Unknown workflow error' },
            });
        }

        return NextResponse.json({
            meetingId: videoCall.id,
            meetingUrl: meetingUrl,
            token: linkToken,
            expiresAt: expiresAt,
            durationMinutes: actualDuration,
            title: title,
            hostId: hostId,
            call: { ...linkedVideoCall, calendar_event_id: calendarEvent?.id || null },
            calendarEvent,
            runId
        });

    } catch (error) {
        return routeErrorResponse(error, 'Failed to create meeting.', req);
    }
}
