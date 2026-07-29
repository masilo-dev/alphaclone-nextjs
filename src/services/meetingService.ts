import { supabase } from '../lib/supabase';
import { emailTemplates, MeetingConfirmationData } from './emailTemplates';
import { linkValidator } from '../utils/linkValidator';


export interface Meeting {
    id: string;
    title: string;
    host_id: string;
    attendee_id?: string;
    scheduled_at: string;
    priority: 'low' | 'medium' | 'high';
    status: 'scheduled' | 'completed' | 'cancelled';
    attendee?: { name: string; email: string };
    host?: { name: string; email: string };
}

export interface CreateMeetingData {
    hostId: string;
    hostName: string;
    hostEmail: string;
    attendeeEmail: string;
    attendeeName: string;
    title: string;
    description?: string;
    startTime: string;
    duration: number;
    dailyRoomUrl: string;
}

export const meetingService = {
    async getMeetings(userId: string, isAdmin: boolean) {
        let query = supabase
            .from('meetings')
            .select(`
        *,
        attendee:attendee_id(name, email),
        host:host_id(name, email)
      `)
            .order('scheduled_at', { ascending: true });

        if (!isAdmin) {
            query = query.or(`host_id.eq.${userId},attendee_id.eq.${userId}`);
        }

        const { data, error } = await query;
        return { meetings: data as Meeting[] | null, error };
    },

    async createMeeting(meeting: Omit<Meeting, 'id' | 'created_at' | 'attendee' | 'host'>) {
        const { data, error } = await supabase
            .from('meetings')
            .insert(meeting)
            .select()
            .single();
        return { meeting: data, error };
    },

    async updateStatus(id: string, status: 'completed' | 'cancelled') {
        const { error } = await supabase
            .from('meetings')
            .update({ status })
            .eq('id', id);
        return { error };
    },

    /**
     * Create meeting with video call and send confirmations
     */
    async createMeetingWithConfirmation(data: CreateMeetingData) {
        try {
            // 1. Create video call record
            const { data: call, error: callError } = await supabase
                .from('video_calls')
                .insert({
                    host_id: data.hostId,
                    daily_room_url: data.dailyRoomUrl,
                    scheduled_at: data.startTime,
                    duration_minutes: data.duration,
                    title: data.title,
                    description: data.description,
                    status: 'scheduled'
                })
                .select()
                .single();

            if (callError) throw callError;

            // 2. Generate system meeting link
            const joinLink = linkValidator.generateMeetingLink(call.id);

            // 3. Validate link (should always pass for system-generated)
            const validation = linkValidator.validateLink(joinLink);
            if (!validation.isValid) {
                throw new Error('Failed to generate valid meeting link');
            }

            // 4. Prepare confirmation email data
            const emailData: MeetingConfirmationData = {
                recipientName: data.attendeeName,
                recipientEmail: data.attendeeEmail,
                meetingTitle: data.title,
                meetingDate: new Date(data.startTime).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                meetingTime: new Date(data.startTime).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                duration: data.duration,
                joinLink,
                hostName: data.hostName,
                hostEmail: data.hostEmail,
                description: data.description
            };

            // 5. Generate email HTML
            const emailHtml = emailTemplates.meetingConfirmation(emailData);

            // 6. Generate calendar invite
            const calendarInvite = emailTemplates.generateCalendarInvite(emailData);

            // Send via AlphaClone's internal email API to Attendee
            try {
                if (typeof window === 'undefined') {
                    const { data: tenantUserData } = await supabase
                        .from('tenant_users')
                        .select('tenant_id')
                        .eq('user_id', data.hostId)
                        .limit(1)
                        .single();
                    const tenantId = tenantUserData?.tenant_id;
                    if (tenantId) {
                        const { sendEmailServer } = await import('@/lib/email/sendEmailServer');
                        await sendEmailServer({
                            tenantId,
                            to: data.attendeeEmail,
                            subject: `Meeting Confirmed: ${data.title}`,
                            html: emailHtml,
                            attachments: [{ filename: 'invite.ics', content: calendarInvite }],
                            userId: data.hostId,
                        });
                    } else {
                        console.error('No tenant_id found for host', data.hostId);
                    }
                } else {
                    await fetch('/api/email/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: data.attendeeEmail,
                            subject: `Meeting Confirmed: ${data.title}`,
                            html: emailHtml,
                            attachments: [{ filename: 'invite.ics', content: calendarInvite }],
                        }),
                    });
                }
            } catch (emailErr) {
                console.error('Meeting confirmation email for attendee failed (non-blocking):', emailErr);
            }

            // Send to Host
            try {
                if (typeof window === 'undefined') {
                    const { data: tenantUserData } = await supabase
                        .from('tenant_users')
                        .select('tenant_id')
                        .eq('user_id', data.hostId)
                        .limit(1)
                        .single();
                    const tenantId = tenantUserData?.tenant_id;
                    if (tenantId) {
                        const { sendEmailServer } = await import('@/lib/email/sendEmailServer');
                        await sendEmailServer({
                            tenantId,
                            to: data.hostEmail,
                            subject: `Meeting Scheduled: ${data.title}`,
                            html: emailHtml,
                            attachments: [{ filename: 'invite.ics', content: calendarInvite }],
                            userId: data.hostId,
                        });
                    } else {
                        console.error('No tenant_id found for host', data.hostId);
                    }
                } else {
                    await fetch('/api/email/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: data.hostEmail,
                            subject: `Meeting Scheduled: ${data.title}`,
                            html: emailHtml,
                            attachments: [{ filename: 'invite.ics', content: calendarInvite }],
                        }),
                    });
                }
            } catch (emailErr) {
                console.error('Meeting confirmation email for host failed (non-blocking):', emailErr);
            }

            return { success: true, call, joinLink, emailData };

        } catch (error) {
            console.error('Error creating meeting:', error);
            return { success: false, error };
        }
    },

    /**
     * Get user's video calls
     */
    async getUserMeetings(userId: string) {
        try {
            const { data, error } = await supabase
                .from('video_calls')
                .select('*')
                .eq('host_id', userId)
                .order('scheduled_at', { ascending: true });

            if (error) throw error;

            return { meetings: data || [], error: null };
        } catch (error) {
            console.error('Error fetching meetings:', error);
            return { meetings: [], error };
        }
    }
};
