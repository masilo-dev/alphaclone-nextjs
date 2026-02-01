import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { dailyService, VideoCall } from '../../../services/dailyService';
import { Settings, Video, Calendar, Clock, User as UserIcon, Link, Copy } from 'lucide-react';
import { BookingSettings } from './BookingSettings';
import SimpleVideoMeeting from '../SimpleVideoMeeting';
import { format, isFuture } from 'date-fns';
import { safeFormat } from '../../../utils/dateUtils';
import { Button, Card, Badge } from '@/components/ui/UIComponents';

interface MeetingsPageProps {
    user: User;
    onJoinRoom?: (url: string) => void;
}

const MeetingsPage: React.FC<MeetingsPageProps> = ({ user, onJoinRoom }) => {
    const { currentTenant, refreshTenants } = useTenant();
    const [meetings, setMeetings] = useState<VideoCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        if (currentTenant) {
            loadMeetings();
        }
    }, [currentTenant]);

    const loadMeetings = async () => {
        if (!user.id) return;
        setLoading(true);
        // Fetch all video calls for user
        const { calls, error } = await dailyService.getUserVideoCall(user.id);
        if (!error && calls) {
            setMeetings(calls);
        }
        setLoading(false);
    };

    const upcomingMeetings = meetings.filter(m =>
        (m.status === 'scheduled' || m.status === 'active') &&
        (m.status === 'active' || isFuture(new Date(m.scheduled_at || m.created_at)))
    ).sort((a, b) => new Date(a.scheduled_at || a.created_at).getTime() - new Date(b.scheduled_at || b.created_at).getTime());

    // Get the very next meeting
    const nextMeeting = upcomingMeetings[0];

    const copyBookingLink = () => {
        if (currentTenant?.settings.booking?.slug) {
            const url = `${window.location.origin}/book/${currentTenant.settings.booking.slug}`;
            navigator.clipboard.writeText(url);
            import('react-hot-toast').then(({ toast }) => toast.success('Booking link copied!'));
        }
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Video Meetings</h1>
                    <p className="text-slate-400">Stable video meetings & bookings management</p>
                </div>
                <div className="flex gap-2">
                    {currentTenant?.settings.booking?.enabled && (
                        <Button variant="outline" onClick={copyBookingLink} className="gap-2 border-slate-700 hover:bg-slate-800">
                            <Link className="w-4 h-4" />
                            Booking Link
                        </Button>
                    )}
                    <Button onClick={() => setShowSettings(true)} variant="outline" className="gap-2 border-slate-700 hover:bg-slate-800">
                        <Settings className="w-4 h-4" />
                        Settings
                    </Button>
                </div>
            </div>

            {/* Next Meeting Hero (if within 24 hours) */}
            {nextMeeting && (
                <div className="bg-gradient-to-r from-teal-900/50 to-blue-900/50 border border-teal-500/30 rounded-2xl p-6 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative z-10 flex flex-col md:flex-row gap-6 justify-between items-center">
                        <div className="flex items-start gap-5">
                            <div className="w-16 h-16 bg-teal-500/20 rounded-2xl flex items-center justify-center border border-teal-500/30">
                                <Video className="w-8 h-8 text-teal-400 animate-pulse" />
                            </div>
                            <div>
                                <Badge variant="success" className="mb-2">Up Next</Badge>
                                <h3 className="text-xl font-bold text-white">{nextMeeting.title}</h3>
                                <div className="flex items-center gap-4 text-slate-300 mt-2">
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-teal-400" />
                                        {safeFormat(nextMeeting.scheduled_at || nextMeeting.created_at, 'h:mm a')}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-teal-400" />
                                        {safeFormat(nextMeeting.scheduled_at || nextMeeting.created_at, 'MMM d, yyyy')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={() => {
                                const externalUrl = nextMeeting.daily_room_url || nextMeeting.metadata?.calendly_event?.location?.location;
                                if (externalUrl && !externalUrl.includes(window.location.hostname)) {
                                    window.open(externalUrl, '_blank');
                                } else {
                                    onJoinRoom?.(`/meet/${nextMeeting.id}`);
                                }
                            }}
                            className="w-full md:w-auto px-8 py-4 text-lg bg-teal-500 hover:bg-teal-400 text-white shadow-lg shadow-teal-900/40 rounded-2xl transition-all hover:scale-105"
                        >
                            {nextMeeting.daily_room_url && !nextMeeting.daily_room_url.includes(window.location.hostname) ? 'Open Meeting Link' : 'Join Meeting Now'}
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Col: Instant Meeting */}
                <div className="space-y-6">
                    <div>
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <Video className="w-5 h-5 text-teal-400" />
                            Instant Meeting
                        </h2>
                        {/* Re-using the admin component for consistency */}
                        <SimpleVideoMeeting user={user} onJoinRoom={onJoinRoom || (() => { })} />
                    </div>
                </div>

                {/* Right Col: Upcoming List */}
                <div className="space-y-6">
                    <div>
                        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-400" />
                            Upcoming Bookings
                        </h2>

                        <div className="space-y-3">
                            {loading ? (
                                <div className="p-8 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800">
                                    Loading...
                                </div>
                            ) : upcomingMeetings.length === 0 ? (
                                <div className="p-8 text-center bg-slate-900/30 rounded-xl border border-slate-800 border-dashed">
                                    <p className="text-slate-400">No upcoming bookings scheduled.</p>
                                </div>
                            ) : (
                                upcomingMeetings.map(meeting => (
                                    <div key={meeting.id} className="bg-slate-900/40 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all hover:bg-slate-900/60 group">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-4">
                                                <div className="flex flex-col items-center justify-center w-12 h-12 bg-slate-800 rounded-lg text-slate-400 group-hover:text-white transition-colors">
                                                    <span className="text-xs font-bold uppercase">{safeFormat(meeting.scheduled_at || meeting.created_at, 'MMM')}</span>
                                                    <span className="text-lg font-bold">{safeFormat(meeting.scheduled_at || meeting.created_at, 'd')}</span>
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white">{meeting.title}</div>
                                                    <div className="text-sm text-slate-400 flex items-center gap-2">
                                                        <Clock className="w-3 h-3" />
                                                        {safeFormat(meeting.scheduled_at || meeting.created_at, 'h:mm a')}
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => {
                                                    const externalUrl = meeting.daily_room_url || meeting.metadata?.calendly_event?.location?.location;
                                                    if (externalUrl && !externalUrl.includes(window.location.hostname)) {
                                                        window.open(externalUrl, '_blank');
                                                    } else {
                                                        onJoinRoom?.(`/meet/${meeting.id}`);
                                                    }
                                                }}
                                                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                            >
                                                {meeting.daily_room_url && !meeting.daily_room_url.includes(window.location.hostname) ? 'Open Link' : 'Join'}
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            {showSettings && currentTenant && (
                <BookingSettings
                    tenant={currentTenant}
                    onUpdate={refreshTenants}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
};

export default MeetingsPage;
