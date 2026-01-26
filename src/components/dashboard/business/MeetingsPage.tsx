import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { dailyService, VideoCall } from '../../../services/dailyService';
import { Settings, Video, Link as LinkIcon, Calendar, Clock, User as UserIcon, Copy, ExternalLink } from 'lucide-react';
import { BookingSettings } from './BookingSettings';
import { format, isFuture, isPast } from 'date-fns';
import { Button, Card, Badge } from '@/components/ui/UIComponents';

interface MeetingsPageProps {
    user: User;
}

const MeetingsPage: React.FC<MeetingsPageProps> = ({ user }) => {
    const { currentTenant, refreshTenants } = useTenant();
    const [meetings, setMeetings] = useState<VideoCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

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

    const upcomingMeetings = meetings.filter(m => m.status === 'scheduled' || m.status === 'active');
    const pastMeetings = meetings.filter(m => m.status === 'ended' || m.status === 'cancelled');

    const displayMeetings = filter === 'upcoming' ? upcomingMeetings : pastMeetings;

    const copyBookingLink = () => {
        if (currentTenant?.settings.booking?.slug) {
            const url = `${window.location.origin}/book/${currentTenant.settings.booking.slug}`;
            navigator.clipboard.writeText(url);
            alert('Booking link copied!');
        }
    };

    return (
        <div className="space-y-8">
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl font-bold">Meetings & Calls</h1>
                    <p className="text-slate-400">Manage your video calls and booking availability.</p>
                </div>
                <div className="flex gap-3">
                    {currentTenant?.settings.booking?.enabled && (
                        <Button variant="outline" onClick={copyBookingLink} className="gap-2">
                            <Copy className="w-4 h-4" />
                            Copy Booking Link
                        </Button>
                    )}
                    <Button onClick={() => setShowSettings(true)} className="gap-2">
                        <Settings className="w-4 h-4" />
                        Configuration
                    </Button>
                </div>
            </div>

            {/* Stats / Quick Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="flex items-center gap-4">
                    <div className="p-3 bg-teal-500/10 rounded-xl text-teal-400">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{upcomingMeetings.length}</div>
                        <div className="text-sm text-slate-400">Upcoming Meetings</div>
                    </div>
                </Card>
                <Card className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{Math.round(pastMeetings.reduce((acc, m) => acc + (m.duration_seconds || 0), 0) / 60)}</div>
                        <div className="text-sm text-slate-400">Total Minutes (All Time)</div>
                    </div>
                </Card>
                <Card className="flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                        <Video className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold">{meetings.length}</div>
                        <div className="text-sm text-slate-400">Total Calls</div>
                    </div>
                </Card>
            </div>

            {/* Meeting List */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
                <div className="flex border-b border-slate-800">
                    <button
                        onClick={() => setFilter('upcoming')}
                        className={`px-6 py-3 text-sm font-medium transition-colors ${filter === 'upcoming' ? 'text-teal-400 border-b-2 border-teal-500' : 'text-slate-400 hover:text-white'}`}
                    >
                        Upcoming
                    </button>
                    <button
                        onClick={() => setFilter('past')}
                        className={`px-6 py-3 text-sm font-medium transition-colors ${filter === 'past' ? 'text-teal-400 border-b-2 border-teal-500' : 'text-slate-400 hover:text-white'}`}
                    >
                        Past / History
                    </button>
                </div>

                <div className="divide-y divide-slate-800">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading meetings...</div>
                    ) : displayMeetings.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                                <Calendar className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-1">No {filter} meetings</h3>
                            <p className="text-slate-400">
                                {filter === 'upcoming'
                                    ? "You don't have any scheduled calls."
                                    : "You haven't completed any calls yet."}
                            </p>
                        </div>
                    ) : (
                        displayMeetings.map((meeting) => (
                            <div key={meeting.id} className="p-4 hover:bg-slate-800/30 transition-colors flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div className="flex items-start gap-4">
                                    <div className="flex flex-col items-center justify-center w-14 h-14 bg-slate-800 rounded-xl border border-slate-700">
                                        <span className="text-xs uppercase font-bold text-slate-400">
                                            {format(new Date(meeting.created_at), 'MMM')}
                                        </span>
                                        <span className="text-xl font-bold text-white">
                                            {format(new Date(meeting.created_at), 'd')}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white flex items-center gap-2">
                                            {meeting.title}
                                            <Badge variant={meeting.status === 'active' ? 'success' : meeting.status === 'cancelled' ? 'error' : 'neutral'}>
                                                {meeting.status}
                                            </Badge>
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {format(new Date(meeting.created_at), 'h:mm a')}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <UserIcon className="w-3 h-3" />
                                                {meeting.participants.length} Participants
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {meeting.status === 'scheduled' || meeting.status === 'active' ? (
                                        <a
                                            href={`/call/${meeting.id}`}
                                            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                                        >
                                            <Video className="w-4 h-4" /> Join Meeting
                                        </a>
                                    ) : (
                                        <span className="text-sm text-slate-500 italic">Ended</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
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
