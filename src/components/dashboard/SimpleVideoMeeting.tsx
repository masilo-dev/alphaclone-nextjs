
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/UIComponents';
import { Video, Copy, ExternalLink, RefreshCw, AlertTriangle, Check, Zap, Lock, Clock, Users, Download, Play, ChevronDown, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { User } from '../../types';
import { dailyService, VideoCall } from '../../services/dailyService';
import { useRouter } from 'next/navigation';
import { useTenant } from '../../contexts/TenantContext'; // Added useTenant
import { supabase } from '@/lib/supabase'; // Added supabase for direct query

interface SimpleVideoMeetingProps {
    user: User;
    onJoinRoom: (callId: string) => void;
}

interface MeetingRoom {
    id: string;
    name: string;
    url: string;
    shareLink: string;
    pin?: string;
}

/**
 * Simple Video Meeting Component - Enhanced
 *
 * Checks for a permanent room and auto-initializes if missing.
 */
const SimpleVideoMeeting: React.FC<SimpleVideoMeetingProps> = ({ user, onJoinRoom }) => {
    const router = useRouter();
    const { currentTenant } = useTenant();
    const [room, setRoom] = useState<MeetingRoom | null>(null);
    const [status, setStatus] = useState<'idle' | 'initializing' | 'ready' | 'error'>('initializing');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [pastMeetings, setPastMeetings] = useState<VideoCall[]>([]);
    const [showPastMeetings, setShowPastMeetings] = useState(false);

    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current || !currentTenant) return;
        initRef.current = true;

        initializeVideoService();
        loadPastMeetings();
    }, [currentTenant]); // Re-run if tenant changes, but initRef prevents loops

    const loadPastMeetings = async () => {
        if (!currentTenant) return;
        
        try {
            const { data, error } = await supabase
                .from('video_calls')
                .select('*')
                .eq('tenant_id', currentTenant.id)
                .in('status', ['ended', 'cancelled'])
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;
            setPastMeetings(data || []);
        } catch (err) {
            console.error('Failed to load past meetings:', err);
        }
    };

    const initializeVideoService = async () => {
        if (!currentTenant) return;

        setStatus('initializing');
        setErrorMsg(null);

        try {
            // 1. Check if a permanent room exists for this tenant
            const { data: permanentRooms, error: lookupError } = await supabase
                .from('video_calls')
                .select('*')
                .eq('tenant_id', currentTenant.id)
                .eq('is_permanent', true)
                .eq('status', 'active');

            let permanentCall = permanentRooms && permanentRooms.length > 0 ? permanentRooms[0] : null;

            // 2. If it doesn't exist, create it
            if (!permanentCall) {
                const { call, error } = await dailyService.createVideoCall({
                    hostId: user.id || 'system',
                    title: `${currentTenant.name} 's Permanent Meeting Room`,
                    isPublic: true,
                    maxParticipants: 10,
                    screenShareEnabled: true,
                    chatEnabled: true,
                    tenantId: currentTenant.id
                });

                if (error || !call) {
                    throw new Error(error || 'Failed to create room');
                }

                // Generate a random 6-digit PIN
                const meetingPin = Math.floor(100000 + Math.random() * 900000).toString();

                // Mark it as permanent and store the PIN in metadata
                const { error: updateError, data: updatedCall } = await supabase
                    .from('video_calls')
                    .update({
                        is_permanent: true,
                        metadata: { meeting_pin: meetingPin }
                    })
                    .eq('id', call.id)
                    .select()
                    .single();

                if (updateError) {
                    console.error('Failed to mark room as permanent/set PIN:', updateError);
                } else {
                    permanentCall = updatedCall;
                }
            } else if (!permanentCall.metadata?.meeting_pin) {
                // Retroactively add a PIN if one doesn't exist for an older layout
                const meetingPin = Math.floor(100000 + Math.random() * 900000).toString();
                const { data: updatedCall } = await supabase
                    .from('video_calls')
                    .update({
                        metadata: { ...permanentCall.metadata, meeting_pin: meetingPin }
                    })
                    .eq('id', permanentCall.id)
                    .select()
                    .single();

                if (updatedCall) permanentCall = updatedCall;
            }

            // Always use the branded link for the shareable link to ensure consistency
            const shareLink = dailyService.getWrappedMeetingUrl(permanentCall.id);

            setRoom({
                id: permanentCall.id,
                name: permanentCall.daily_room_name || `room-${permanentCall.id}`,
                url: permanentCall.daily_room_url || '',
                shareLink: shareLink,
                pin: permanentCall.metadata?.meeting_pin // Attach pin to room state
            } as any); // Cast as any to add pin temporarily if not strictly typed
            setStatus('ready');

        } catch (err: any) {
            console.error('Video Initialization Error:', err);
            setStatus('error');
            setErrorMsg(err.message || 'Video service not configured or unavailable.');
        }
    };

    const handleCopyLink = async () => {
        if (!room) return;
        try {
            const formattedInvite = `--- Secure Video Meeting Invite ---\n\nJoin Link: ${room.shareLink}\nMeeting Code: ${room.pin || 'None'}\n\nPlease click the link and enter the Meeting Code when prompted.`;
            await navigator.clipboard.writeText(formattedInvite);
            setCopied(true);
            toast.success('Invitation copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    const handleCopyPin = async () => {
        if (!room || !room.pin) return;
        try {
            await navigator.clipboard.writeText(room.pin);
            toast.success('Meeting Code copied!');
        } catch (err) {
            toast.error('Failed to copy code');
        }
    };

    const handleRegeneratePin = async () => {
        if (!room || !currentTenant) return;

        setIsRegenerating(true);
        try {
            const newPin = Math.floor(100000 + Math.random() * 900000).toString();

            // For regenerating, we just want to update the PIN
            // We do NOT want to change the pin_generated_at timestamp, as that is only for 
            // when the meeting starts to track the 35 min expiration limit

            // First get current metadata
            const { data: currentRoom } = await supabase
                .from('video_calls')
                .select('metadata')
                .eq('id', room.id)
                .single();

            const currentMetadata = currentRoom?.metadata || {};

            const { error: updateError } = await supabase
                .from('video_calls')
                .update({
                    metadata: { ...currentMetadata, meeting_pin: newPin }
                })
                .eq('id', room.id);

            if (updateError) throw updateError;

            setRoom({ ...room, pin: newPin });
            toast.success('New meeting code generated!');
        } catch (err) {
            console.error('Failed to regenerate pin:', err);
            toast.error('Failed to generate new code');
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleJoin = async () => {
        if (!room) return;
        try {
            // Open in our own secure independent route for multitasking
            const meetingUrl = `${window.location.origin}/meet/${room.id}`;
            window.open(meetingUrl, '_blank', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
            toast.success('Opening secure meeting page...');
        } catch (err) {
            console.error('Join error:', err);
            toast.error('Failed to open meeting room');
        }
    };


    const handleCreateNew = () => {
        toast.success('This is your personal permanent room. No need to create a new one.');
    };

    // --- RENDER STATES ---

    if (status === 'initializing') {
        return (
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-8 border-2 border-slate-700/50 flex flex-col items-center justify-center text-center h-[300px]">
                <div className="relative">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <Video className="w-8 h-8 text-teal-500 animate-pulse" />
                    </div>
                    <div className="absolute inset-0 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Initializing Video Service</h3>
                <p className="text-sm text-slate-400">Connecting to secure video infrastructure...</p>
            </div>
        );
    }

    if (status === 'error') {
        const isTeaser = errorMsg === 'LIMIT_EXCEEDED_TEASER';

        if (isTeaser) {
            return (
                <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 rounded-xl p-8 border-2 border-amber-500/30 flex flex-col items-center justify-center text-center h-[auto] min-h-[300px]">
                    <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6">
                        <Zap className="w-8 h-8 text-amber-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">AlphaClone Capacity Notice</h3>
                    <p className="text-amber-200/90 max-w-sm mx-auto mb-8 text-lg leading-relaxed">
                        Due to extremely high volume right now, free previews are limited.
                        <span className="block mt-2 font-medium text-white italic">Subscribe to unlock unlimited HD meetings & priority access.</span>
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
                        <Button
                            onClick={() => router.push('/dashboard/settings')}
                            className="flex-1 bg-gradient-to-r from-teal-500 to-blue-500 hover:from-teal-400 hover:to-blue-400 text-white font-bold py-3 shadow-lg shadow-teal-500/20"
                        >
                            UPGRADE NOW
                        </Button>
                    </div>
                </div>
            );
        }

        return (
            <div className="bg-red-900/10 rounded-xl p-8 border-2 border-red-500/30 flex flex-col items-center justify-center text-center h-[300px]">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Service Unavailable</h3>
                <p className="text-sm text-red-300 max-w-xs mx-auto mb-6">
                    {errorMsg || 'The video service is currently not configured or reachable.'}
                </p>
                <Button onClick={initializeVideoService} variant="outline" className="gap-2 border-red-500/30 hover:bg-red-500/10 text-red-400">
                    <RefreshCw className="w-4 h-4" />
                    Retry Connection
                </Button>
            </div>
        );
    }

    // READY STATE
    if (room) {
        return (
            <div className="bg-gradient-to-br from-teal-900/30 to-blue-900/30 rounded-xl p-4 border border-teal-500/30">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-500 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-teal-900/20">
                        <Video className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-bold text-white leading-tight">
                            Instant Meeting
                        </h3>
                        <p className="text-xs text-gray-400">
                            Your secure room is ready.
                        </p>
                    </div>
                </div>

                {/* Meeting Details Card */}
                <div className="bg-gray-900/50 border border-teal-500/20 rounded-lg p-3 mb-4 backdrop-blur-sm space-y-3">
                    {/* Link Section */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                Invite Link
                            </span>
                            {copied && (
                                <span className="text-[10px] text-teal-400 flex items-center animate-fade-in">
                                    <Check className="w-3 h-3 mr-1" /> Copied
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-black/30 rounded px-3 py-2 border border-white/5 min-w-0">
                                <p className="text-teal-400 font-mono text-xs truncate">
                                    {room.shareLink}
                                </p>
                            </div>
                            <Button
                                onClick={handleCopyLink}
                                className="shrink-0 h-[34px] w-[34px] p-0 bg-teal-600/20 hover:bg-teal-600/40 text-teal-400 border border-teal-500/30"
                                title="Copy Link"
                            >
                                <Copy className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* PIN Section */}
                    {room.pin && (
                        <div className="pt-2 border-t border-white/5">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1">
                                Access Code
                            </span>
                            <div className="flex gap-2 items-center">
                                <div className="flex-1 bg-black/30 rounded px-3 py-2 border border-white/5">
                                    <p className="text-amber-400 font-mono text-sm font-bold tracking-widest truncate">
                                        {String(room.pin).match(/.{1,3}/g)?.join(' ')}
                                    </p>
                                </div>
                                <Button
                                    onClick={handleCopyPin}
                                    className="shrink-0 h-[34px] w-[34px] p-0 bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border border-amber-500/30"
                                    title="Copy Code"
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                    onClick={handleRegeneratePin}
                                    className="shrink-0 h-[34px] w-[34px] p-0 bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 border border-white/10"
                                    title="Regenerate Code"
                                    disabled={isRegenerating}
                                >
                                    <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        onClick={handleJoin}
                        className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white shadow-lg shadow-teal-900/20 text-xs font-bold"
                    >
                        Start Meeting
                    </Button>

                    <Button
                        onClick={handleCreateNew}
                        variant="outline"
                        className="border-white/10 hover:bg-white/5 text-slate-300 text-xs"
                    >
                        New Room
                    </Button>
                </div>

            {/* Past Meetings Section */}
            {pastMeetings.length > 0 && (
                <div className="mt-6">
                    <button
                        onClick={() => setShowPastMeetings(!showPastMeetings)}
                        className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors mb-4"
                    >
                        <Clock className="w-4 h-4" />
                        Past Meetings ({pastMeetings.length})
                    </button>
                    
                    {showPastMeetings && (
                        <div className="space-y-3">
                            {pastMeetings.map((meeting) => (
                                <div key={meeting.id} className="bg-slate-900/50 border border-white/5 rounded-lg p-4 hover:bg-slate-900/70 transition-colors">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-white truncate">{meeting.title}</h4>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(meeting.created_at).toLocaleDateString()}
                                                </span>
                                                {meeting.duration_seconds && (
                                                    <span className="flex items-center gap-1">
                                                        {Math.floor(meeting.duration_seconds / 60)} min
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3 h-3" />
                                                    {meeting.participants?.length || 0}
                                                </span>
                                            </div>
                                            {meeting.status === 'ended' && meeting.recording_url && (
                                                <div className="mt-3 flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase rounded-full">
                                                        Recording Available
                                                    </span>
                                                    <a
                                                        href={meeting.recording_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-teal-400 hover:text-teal-300 text-xs font-medium flex items-center gap-1"
                                                    >
                                                        <Play className="w-3 h-3" />
                                                        Watch
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                            meeting.status === 'ended' ? 'bg-green-500/10 text-green-400' :
                                            meeting.status === 'cancelled' ? 'bg-red-500/10 text-red-400' :
                                            'bg-slate-500/10 text-slate-400'
                                        }`}>
                                            {meeting.status}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
        );
    }

    return null; // Should not reach here
};

export default SimpleVideoMeeting;
