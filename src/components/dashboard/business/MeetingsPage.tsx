import React, { useState, useEffect, useCallback } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { Settings, Video, Link, Plus, Clock, Calendar } from 'lucide-react';
import { CalendlySettingsModal } from './CalendlySettingsModal';
import { BookingSettings } from './BookingSettings';
import { PLATFORM_CALENDLY_URL } from '@/constants';
import { Button, Badge } from '@/components/ui/UIComponents';
import { supabase } from '../../../lib/supabase';
import { dailyService } from '../../../services/dailyService';
import toast from 'react-hot-toast';

interface MeetingsPageProps {
    user: User;
    onJoinRoom?: (callId: string) => void;
}

interface MeetingRow {
    id: string;
    title: string;
    status: string;
    created_at: string;
    host_id: string;
}

const MeetingsPage: React.FC<MeetingsPageProps> = ({ user, onJoinRoom }) => {
    const { currentTenant } = useTenant();
    const [showCalendlySettings, setShowCalendlySettings] = useState(false);
    const [showNativeBookingSettings, setShowNativeBookingSettings] = useState(false);
    const [meetings, setMeetings] = useState<MeetingRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);

    const loadMeetings = useCallback(async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        const { data } = await supabase
            .from('video_calls')
            .select('id, title, status, created_at, host_id')
            .eq('tenant_id', currentTenant.id)
            .in('status', ['scheduled', 'active'])
            .order('created_at', { ascending: false })
            .limit(25);
        setMeetings((data as MeetingRow[]) || []);
        setLoading(false);
    }, [currentTenant?.id]);

    useEffect(() => { loadMeetings(); }, [loadMeetings]);

    const startInstantMeeting = async () => {
        setStarting(true);
        const toastId = toast.loading('Creating meeting room…');
        try {
            const { call, error } = await dailyService.createVideoCall({
                hostId: user.id,
                title: `Meeting · ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
                isPublic: false,
            });
            if (error || !call) {
                if (error === 'LIMIT_EXCEEDED_TEASER') {
                    toast.error('You\u2019ve used your free meetings. Upgrade to host more.', { id: toastId });
                } else {
                    toast.error(error || 'Could not create meeting', { id: toastId });
                }
                return;
            }
            toast.success('Joining meeting…', { id: toastId });
            await loadMeetings();
            onJoinRoom?.(call.id);
        } finally {
            setStarting(false);
        }
    };

    const copyBookingLink = () => {
        if (currentTenant?.settings.booking?.enabled && currentTenant?.settings.booking?.slug) {
            const url = `${window.location.origin}/book/${currentTenant.settings.booking.slug}`;
            navigator.clipboard.writeText(url);
            toast.success('Native booking link copied');
            return;
        }
        const calendlyUrl = (currentTenant?.settings as any)?.calendly?.eventUrl || PLATFORM_CALENDLY_URL;
        navigator.clipboard.writeText(calendlyUrl);
        toast.success('Booking link copied');
    };

    const hasBooking = true;

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Meetings</h1>
                    <p className="text-slate-400">Host secure AlphaClone video rooms and manage your booking links.</p>
                </div>
                <div className="flex gap-2">
                    {hasBooking && (
                        <Button variant="outline" onClick={copyBookingLink} className="gap-2 border-slate-700 hover:bg-slate-800">
                            <Link className="w-4 h-4" />
                            Booking Link
                        </Button>
                    )}
                    <Button onClick={() => setShowNativeBookingSettings(true)} variant="outline" className="gap-2 border-slate-700 hover:bg-slate-800">
                        <Settings className="w-4 h-4" />
                        Native Booking
                    </Button>
                    <Button onClick={() => setShowCalendlySettings(true)} variant="outline" className="gap-2 border-slate-700 hover:bg-slate-800">
                        <Calendar className="w-4 h-4" />
                        Calendly
                    </Button>
                    <Button onClick={startInstantMeeting} disabled={starting} className="gap-2">
                        <Plus className="w-4 h-4" />
                        {starting ? 'Starting…' : 'New Meeting'}
                    </Button>
                </div>
            </div>

            {/* Active / upcoming meetings */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-white mb-4">Your Rooms</h2>
                {loading ? (
                    <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-800/40 rounded-xl animate-pulse" />)}</div>
                ) : meetings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                            <Video className="w-7 h-7 text-teal-400" />
                        </div>
                        <p className="text-slate-400 max-w-md">No active meetings. Start an instant video room or share your booking link with clients.</p>
                        <Button onClick={startInstantMeeting} disabled={starting} className="gap-2">
                            <Plus className="w-4 h-4" /> Start a meeting
                        </Button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800">
                        {meetings.map(m => (
                            <div key={m.id} className="flex items-center justify-between py-3 gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                                        <Video className="w-5 h-5 text-teal-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{m.title || 'Untitled meeting'}</p>
                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant={m.status === 'active' ? 'success' : 'neutral'}>{m.status}</Badge>
                                    <Button onClick={() => onJoinRoom?.(m.id)} className="gap-1.5">
                                        <Video className="w-4 h-4" /> Join
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showCalendlySettings && (
                <CalendlySettingsModal onClose={() => setShowCalendlySettings(false)} />
            )}
            {showNativeBookingSettings && currentTenant && (
                <BookingSettings
                    tenant={currentTenant}
                    onUpdate={() => toast.success('Booking page updated')}
                    onClose={() => setShowNativeBookingSettings(false)}
                />
            )}
        </div>
    );
};

export default MeetingsPage;
