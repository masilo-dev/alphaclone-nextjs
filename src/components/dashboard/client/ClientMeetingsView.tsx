import React, { useState, useEffect } from 'react';
import { dailyService, VideoCall } from '../../../services/dailyService';
import { User, Video, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/UIComponents';
import { format, isFuture } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export const ClientMeetingsView: React.FC = () => {
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
        // "getUserVideoCall" fetches calls where user is host OR participant
        const { calls, error } = await dailyService.getUserVideoCall(user.id);
        if (!error && calls) {
            setMeetings(calls);
        }
        setLoading(false);
    };

    const upcomingMeetings = meetings.filter(m =>
        (m.status === 'scheduled' || m.status === 'active') &&
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
                                                // Using router.push logic or anchor tag for now
                                                onClick={() => router.push(`/call/${meeting.id}`)}
                                                className="bg-green-600 hover:bg-green-700 text-white gap-2 shadow-lg shadow-green-900/20"
                                            >
                                                <Video className="w-4 h-4 animate-pulse" />
                                                Join Now
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={() => router.push(`/call/${meeting.id}`)}
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
