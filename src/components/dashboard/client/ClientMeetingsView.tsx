import React, { useState, useEffect, useCallback } from 'react';
import { dailyService, VideoCall } from '../../../services/dailyService';
import { supabase } from '../../../lib/supabase';
import { User, Video, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/UIComponents';
import { format, isFuture } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { resolveMeetingJoinUrl } from '@/services/instantMeetingService';

interface ClientMeetingsViewProps {
    onJoinRoom?: (url: string) => void;
}

export const ClientMeetingsView: React.FC<ClientMeetingsViewProps> = ({ onJoinRoom }) => {
    const { user } = useAuth();
    const router = useRouter();
    const [meetings, setMeetings] = useState<VideoCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(() => Date.now());

    const loadMeetings = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        // 1. Fetch manual video calls from Daily service
        const { calls: dailyCalls, error: dailyError } = await dailyService.getUserVideoCall(user.id);

        // 2. Fetch synced bookings from our database
        // We match by the user's email since Calendly bookings use email
        const { data: bookingData, error: bookingError } = await supabase
            .from('bookings')
            .select('*')
            .eq('client_email', user.email)
            .eq('status', 'confirmed');

        if (!dailyError && dailyCalls) {
            // Map bookings to a format similar to VideoCall if needed, or just combine
            const mappedBookings: VideoCall[] = (bookingData || []).map((b: any) => ({
                id: b.id,
                title: `Booking: ${b.client_name}`,
                status: b.status,
                scheduled_at: b.start_time,
                created_at: b.created_at,
                // For joined meetings, we might need a meeting link if it's a video call
                // Calendly payloads often have a location or join URL
                room_url: b.metadata?.full_payload?.location?.join_url || b.metadata?.full_payload?.scheduled_event?.location?.join_url
            }));

            setMeetings([...dailyCalls, ...mappedBookings]);
        }
        setLoading(false);
    }, [user]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (user) {
            loadMeetings();
        }
    }, [user, loadMeetings]);

    const upcomingMeetings = meetings.filter(m =>
        (m.status === 'scheduled' || m.status === 'active' || (m.status as any) === 'confirmed') &&
        // Show active meetings or future ones.
        (m.status === 'active' || isFuture(new Date(m.scheduled_at || m.created_at)))
    );

    const joinMeeting = (meeting: VideoCall) => {
        const destination = (meeting as any).room_url || resolveMeetingJoinUrl(meeting);
        if (destination?.startsWith('http')) {
            if (onJoinRoom && !destination.includes('teams.microsoft.com')) onJoinRoom(destination);
            else window.open(destination, '_blank', 'noopener,noreferrer');
            return;
        }
        router.push(destination || `/meet/${meeting.id}`);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-[var(--ws-text-primary)]">My Meetings</h2>
                    <p className="text-[var(--ws-text-muted)]">Scheduled video calls with your provider</p>
                </div>
            </div>

            {loading ? (
                <div className="p-12 text-center text-[var(--ws-text-muted)]">Loading meetings...</div>
            ) : upcomingMeetings.length === 0 ? (
                <div className="bg-[var(--ws-panel)]/50 border border-[var(--ws-border)] rounded-xl p-12 text-center">
                    <div className="w-16 h-16 bg-[var(--ws-surface-secondary)] rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--ws-text-muted)]">
                        <Calendar className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-medium text-[var(--ws-text-primary)] mb-2">No upcoming meetings</h3>
                    <p className="text-[var(--ws-text-muted)] max-w-sm mx-auto">
                        You don't have any video calls scheduled. Contact your service provider if you need to schedule one.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {upcomingMeetings.map(meeting => {
                        // Safety check for scheduled_at
                        const dateToFormat = meeting.scheduled_at ? new Date(meeting.scheduled_at) : new Date(meeting.created_at);

                        return (
                            <div key={meeting.id} className="bg-[var(--ws-panel)]/50 border border-[var(--ws-border)] rounded-xl p-6 hover:bg-[var(--ws-surface-secondary)]/30 transition-colors">
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex flex-col items-center justify-center w-16 h-16 bg-[var(--ws-surface-secondary)] rounded-xl border border-[var(--ws-border)] shrink-0">
                                            <div className="type-caption uppercase font-bold text-[var(--ws-text-muted)]">
                                                {format(dateToFormat, 'MMM')}
                                            </div>
                                            <div className="text-2xl font-bold text-[var(--ws-text-primary)]">
                                                {format(dateToFormat, 'd')}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-[var(--ws-text-primary)] mb-1">{meeting.title}</h3>
                                            <div className="flex flex-wrap gap-4 type-ui text-[var(--ws-text-muted)]">
                                                <span className="flex items-center gap-1.5">
                                                    <Clock className="w-4 h-4" />
                                                    {format(dateToFormat, 'h:mm a')}
                                                </span>
                                                {meeting.host_id !== user?.id && (
                                                    <span className="flex items-center gap-1.5">
                                                        <User className="w-4 h-4" />
                                                        Hosted by Provider
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {meeting.status === 'active' ? (
                                            <Button
                                                onClick={() => joinMeeting(meeting)}
                                                className="bg-green-600 hover:bg-green-700 text-[var(--ws-text-primary)] gap-2 shadow-lg shadow-green-900/20"
                                            >
                                                <Video className="w-4 h-4 animate-pulse" />
                                                Join Now
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={() => joinMeeting(meeting)}
                                                variant="secondary"
                                                className="gap-2"
                                                // Allow joining 10 mins early
                                                disabled={dateToFormat.getTime() - currentTime > 10 * 60 * 1000}
                                            >
                                                <Video className="w-4 h-4" />
                                                {dateToFormat.getTime() - currentTime > 10 * 60 * 1000 ? 'Join (Too Early)' : 'Join Link'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
