import { supabase } from '@/lib/supabase';
import { ENV } from '@/config/env';

export interface GoogleCalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: {
        dateTime?: string;
        date?: string;
    };
    end: {
        dateTime?: string;
        date?: string;
    };
    htmlLink?: string;
}

export const googleCalendarService = {
    async getTokens(userId: string) {
        const { data, error } = await supabase
            .from('google_calendar_tokens')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !data) return null;

        // Check if token is expired (giving 5 min buffer)
        const expiresAt = new Date(data.expires_at);
        if (Date.now() + 5 * 60 * 1000 > expiresAt.getTime()) {
            return await this.refreshTokens(userId, data.refresh_token);
        }

        return data;
    },

    async refreshTokens(userId: string, refreshToken: string) {
        if (!refreshToken) return null;

        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: ENV.GOOGLE_CLIENT_ID!,
                    client_secret: ENV.GOOGLE_CLIENT_SECRET!,
                    refresh_token: refreshToken,
                    grant_type: 'refresh_token',
                }),
            });

            const tokens = await response.json();
            if (tokens.error) throw new Error(tokens.error);

            const { access_token, expires_in } = tokens;
            const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

            const { data, error } = await supabase
                .from('google_calendar_tokens')
                .update({
                    access_token,
                    expires_at: expiresAt,
                })
                .eq('user_id', userId)
                .select('*')
                .single();

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Failed to refresh Google Calendar tokens:', err);
            return null;
        }
    },

    async listEvents(userId: string) {
        const tokens = await this.getTokens(userId);
        if (!tokens) return [];

        try {
            const response = await fetch(
                'https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' +
                new Date().toISOString(),
                {
                    headers: {
                        Authorization: `Bearer ${tokens.access_token}`,
                    },
                }
            );

            const data = await response.json();
            return (data.items || []) as GoogleCalendarEvent[];
        } catch (err) {
            console.error('Error fetching Google Calendar events:', err);
            return [];
        }
    },

    async createEvent(userId: string, event: Partial<GoogleCalendarEvent>) {
        const tokens = await this.getTokens(userId);
        if (!tokens) throw new Error('Not connected to Google Calendar');

        const response = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to create event');
        }

        return await response.json();
    },

    async deleteEvent(userId: string, eventId: string) {
        const tokens = await this.getTokens(userId);
        if (!tokens) throw new Error('Not connected to Google Calendar');

        const response = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
            {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${tokens.access_token}`,
                },
            }
        );

        if (!response.ok && response.status !== 204) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to delete event');
        }
    }
};

export default googleCalendarService;
