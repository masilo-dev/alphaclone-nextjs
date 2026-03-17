import React, { useEffect, useState } from 'react';
import { Card, Button } from '../ui/UIComponents';
import { dailyService, VideoCall } from '../../services/dailyService';
import { User } from '../../types';
import { Video, Calendar, Clock, CheckCircle, X, AlertCircle, Users, Copy, Check, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    user: User;
    onJoin: (roomUrl: string, callId?: string) => void;
}

const MeetingsListWidget: React.FC<Props> = ({ user, onJoin }) => {
    const [meetings, setMeetings] = useState<VideoCall[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const loadMeetings = async () => {
        setLoading(true);
        const { calls, error } = await dailyService.getUserVideoCall(user.id);
        if (error) {
            toast.error(`Failed to load meetings: ${error}`);
        } else if (calls) {
            setMeetings(calls);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadMeetings();
    }, [user.id]);

    const handleCancelMeeting = async (meeting: VideoCall) => {
        setCancellingId(meeting.id);
        try {
            // Check if user can cancel
            const { canCancel, reason, error } = await dailyService.canCancelMeeting(meeting.id, user.id);

            if (error) {
                toast.error(`Failed to check cancellation policy: ${error}`);
                return;
            }

            if (!canCancel) {
                toast.error(reason || 'You cannot cancel this meeting at this time');
                return;
            }

            // Confirm cancellation
            if (!confirm(`Are you sure you want to cancel "${meeting.title}"?`)) {
                return;
            }

            // Cancel the meeting
            const { success, error: cancelError } = await dailyService.cancelVideoCall(
                meeting.id,
                user.id,
                'Cancelled by user'
            );

            if (cancelError) {
                toast.error(`Failed to cancel: ${cancelError}`);
            } else if (success) {
                toast.success('Meeting cancelled successfully');
                loadMeetings(); // Refresh the list
            }
        } catch (err) {
            console.error('Failed to cancel meeting:', err);
            toast.error('Failed to cancel meeting');
        } finally {
            setCancellingId(null);
        }
    };

    const getTimeUntilMeeting = (call: VideoCall): { hours: number; canCancel: boolean; message: string } => {
        if (!call.calendar_event_id) {
            return { hours: 999, canCancel: true, message: 'Can cancel anytime' };
        }

        // This is a simplified calculation. In production, you'd fetch the calendar event's start_time
        // For now, we'll use created_at as a proxy
        const hoursUntil = 999; // Placeholder
        const canCancel = hoursUntil >= call.cancellation_policy_hours || user.role === 'admin';
        const message = user.role === 'admin'
            ? 'Admin can cancel anytime'
            : canCancel
                ? `Can cancel until ${call.cancellation_policy_hours}h before`
                : `Cannot cancel (less than ${call.cancellation_policy_hours}h remaining)`;

        return { hours: hoursUntil, canCancel, message };
    };

    const handleJoinMeeting = (meeting: VideoCall) => {
        // Navigate to our secure, branded wrapper page
        // window.location.href = `/meet/${meeting.id}`; // Force reload to ensure clean state
        // OR use onJoin callback if it handles router push
        // Let's assume onJoin does something else or allows custom nav. 
        // Actually, to enforce "masking", we should probably navigate right here or ask parent to nav to /meet/[id]
        // But the previous code used onJoin(url, id).
        // If we want to mask, we must NOT use the raw URL in the browser bar.
        // So we should navigate to `/meet/${meeting.id}`.
        window.location.href = `/meet/${meeting.id}`;
    };

    const handleCopyLink = async (meeting: VideoCall) => {
        if (!meeting.id) {
            toast.error('Meeting link not available');
            return;
        }

        try {
            // Generate shareable link using the INTERNAL ID (UUID), never the Daily room name
            const shareLink = `${window.location.origin}/meet/${meeting.id}`;
            await navigator.clipboard.writeText(shareLink);
            setCopiedId(meeting.id);
            toast.success('Secure meeting link copied!');
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    // Filter meetings
    const active = meetings.filter(m => m.status === 'active');
    const past = meetings.filter(m => ['ended', 'cancelled'].includes(m.status));

    return (
        <div className="space-y-6">
            {/* Active Meetings */}
            {active.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Video className="w-5 h-5 text-red-500 animate-pulse" />
                        Active Now
                    </h3>
                    <div className="grid gap-4">
                        {active.map(m => (
                            <Card key={m.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-l-4 border-l-red-500 bg-red-500/5 p-3 sm:p-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h4 className="font-bold text-white text-base sm:text-lg truncate">{m.title}</h4>
                                        <span className="px-2 py-0.5 rounded text-[10px] sm:text-xs bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse uppercase tracking-wider">
                                            LIVE
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-400 flex-wrap">
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            <span className="whitespace-nowrap">{m.participants.length} participant{m.participants.length !== 1 ? 's' : ''}</span>
                                        </span>
                                        {m.started_at && (
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                <span className="whitespace-nowrap">Started {new Date(m.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Button size="sm" onClick={() => handleJoinMeeting(m)} className="bg-red-600 hover:bg-red-500 text-xs sm:text-sm px-3 py-2 h-auto w-full md:w-auto">
                                    <Video className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                                    <span className="whitespace-nowrap">Join Now</span>
                                </Button>
                            </Card>
                        ))}
                    </div>
                </div>
            )}


            {/* Past Meetings */}
            {past.length > 0 && (
                <div className="pt-8 border-t border-slate-800">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Past Meetings</h4>
                    <div className="space-y-2 opacity-60">
                        {past.slice(0, 5).map(m => (
                            <Card key={m.id} className="flex items-center justify-between p-3 bg-slate-900/30">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${m.status === 'ended' ? 'bg-green-500' : 'bg-red-500'
                                        }`}></div>
                                    <div>
                                        <p className="text-sm text-slate-300">{m.title}</p>
                                        <p className="text-xs text-slate-500">
                                            {m.ended_at && new Date(m.ended_at).toLocaleString()}
                                            {m.duration_seconds && ` • ${Math.round(m.duration_seconds / 60)} minutes`}
                                        </p>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs ${m.status === 'ended'
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                    {m.status}
                                </span>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MeetingsListWidget;
