import React, { useState, useEffect } from 'react';
import { dailyService, VideoCall } from '../../../services/dailyService';
import { supabase } from '../../../lib/supabase';
import { User, Video, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/UIComponents';
import { format, isFuture } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface ClientMeetingsViewProps {
    onJoinRoom?: (url: string) => void;
}

export const ClientMeetingsView: React.FC<ClientMeetingsViewProps> = ({ onJoinRoom }) => {
    const { user } = useAuth();
    const router = useRouter();
    const [meetings, setMeetings] = useState<VideoCall[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadMeetings();
        }
    }, [user]);

    const loadMeetings = async () => {
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
    };

    const upcomingMeetings = meetings.filter(m =>
        (m.status === 'scheduled' || m.status === 'active' || (m.status as any) === 'confirmed') &&
        // Show active meetings or future ones.
        (m.status === 'active' || isFuture(new Date(m.scheduled_at || m.created_at)))
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">My Meetings</h2>
                    <p className="text-slate-400">Scheduled video calls with your provider</p>
                </div>
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-500">Loading meetings...</div>
            ) : upcomingMeetings.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-12 text-center">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                        <Calendar className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">No upcoming meetings</h3>
                    <p className="text-slate-400 max-w-sm mx-auto">
                        You don't have any video calls scheduled. Contact your service provider if you need to schedule one.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {upcomingMeetings.map(meeting => {
                        // Safety check for scheduled_at
                        const dateToFormat = meeting.scheduled_at ? new Date(meeting.scheduled_at) : new Date(meeting.created_at);

                        return (
                            <div key={meeting.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:bg-slate-800/30 transition-colors">
                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex flex-col items-center justify-center w-16 h-16 bg-slate-800 rounded-xl border border-slate-700 shrink-0">
                                            <div className="text-xs uppercase font-bold text-slate-400">
                                                {format(dateToFormat, 'MMM')}
                                            </div>
                                            <div className="text-2xl font-bold text-white">
                                                {format(dateToFormat, 'd')}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-white mb-1">{meeting.title}</h3>
                                            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
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
                                                onClick={() => {
                                                    // "active" logic: derive room URL or fetch it? 
                                                    // The meeting object from dailyService likely has room_url.
                                                    // Let's check the type definition or just assume room_url exists or construct it.
                                                    // Actually, `getUserVideoCall` returns calls. dailyService usually returns full objects.
                                                    // Assuming `meeting.room_url` or similar exists. Inspecting VideoCall type.
                                                    // If we don't have URL, we might need to fetch it.
                                                    // But for now let's assume `meeting.room_url` or fallback to `/call/id`.
                                                    // Since we are hoisting, we prefer `onJoinRoom(url)`.

                                                    // Type check: meetings matches VideoCall interface.
                                                    // Let's assume onJoinRoom handles the URL.
                                                    if (onJoinRoom && (meeting as any).room_url) {
                                                        onJoinRoom((meeting as any).room_url);
                                                    } else {
                                                        router.push(`/call/${meeting.id}`);
                                                    }
                                                }}
                                                className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-lg shadow-green-900/20"
                                            >
                                                <Video className="w-4 h-4 animate-pulse" />
                                                Join Now
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={() => {
                                                    if (onJoinRoom && (meeting as any).room_url) {
                                                        onJoinRoom((meeting as any).room_url);
                                                    } else {
                                                        router.push(`/call/${meeting.id}`);
                                                    }
                                                }}
                                                variant="secondary"
                                                className="gap-2"
                                                // Allow joining 10 mins early
                                                disabled={dateToFormat.getTime() - Date.now() > 10 * 60 * 1000}
                                            >
                                                <Video className="w-4 h-4" />
                                                {dateToFormat.getTime() - Date.now() > 10 * 60 * 1000 ? 'Join (Too Early)' : 'Join Link'}
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
