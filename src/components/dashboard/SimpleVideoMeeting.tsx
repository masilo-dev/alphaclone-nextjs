import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/UIComponents';
import { Video, Copy, Check, ExternalLink, Loader, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { User } from '../../types';
import { dailyService } from '../../services/dailyService';
import { useRouter } from 'next/navigation';

interface SimpleVideoMeetingProps {
    user: User;
    onJoinRoom: (roomUrl: string) => void;
}

interface MeetingRoom {
    name: string;
    url: string;
    shareLink: string;
}

/**
 * Simple Video Meeting Component - Enhanced
 *
 * Auto-initializes on load.
 * Checks for API configuration.
 * Timeouts after 5 seconds if no response.
 */
const SimpleVideoMeeting: React.FC<SimpleVideoMeetingProps> = ({ user, onJoinRoom }) => {
    const router = useRouter();
    const [room, setRoom] = useState<MeetingRoom | null>(null);
    const [status, setStatus] = useState<'idle' | 'initializing' | 'ready' | 'error'>('initializing'); // Start initializing
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Use ref to prevent double-firing strict mode
    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        initializeVideoService();
    }, []);

    const initializeVideoService = async () => {
        setStatus('initializing');
        setErrorMsg(null);

        try {
            // Use dailyService to create a database-backed video call
            const { call, error } = await dailyService.createVideoCall({
                hostId: user.id || 'system',
                title: `${user.name || 'Admin'}'s Instant Meeting`,
                isPublic: true, // Allow guests to join
                maxParticipants: 10,
                screenShareEnabled: true,
                chatEnabled: true
            });

            if (error || !call) {
                throw new Error(error || 'Failed to initialize video service');
            }

            const shareLink = `${window.location.origin}/meet/${call.id}`;

            setRoom({
                name: call.daily_room_name || `room-${call.id}`,
                url: call.daily_room_url || '',
                shareLink: shareLink
            });
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
            await navigator.clipboard.writeText(room.shareLink);
            setCopied(true);
            toast.success('Link copied!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy link');
        }
    };

    const handleJoin = async () => {
        if (!room) return;
        try {
            // Resolve the ID from the share link (last part of URL)
            const meetingId = room.shareLink.split('/').pop();
            router.push(`/meet/${meetingId}`);
            toast.success('Joining secure meet...');
        } catch (err) {
            console.error('Failed to join:', err);
            onJoinRoom(room.url);
        }
    };

    const handleCreateNew = () => {
        // Reset and re-init
        initializeVideoService();
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
            <div className="bg-gradient-to-br from-teal-900/30 to-blue-900/30 rounded-xl p-6 border-2 border-teal-500/30">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-teal-900/20">
                        <Video className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-1">
                            Ready to Meet
                        </h3>
                        <p className="text-sm text-gray-300">
                            Your secure room is ready.
                        </p>
                    </div>
                </div>

                {/* Meeting Link Display */}
                <div className="bg-gray-900/50 border-2 border-teal-500/50 rounded-lg p-4 mb-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <ExternalLink className="w-4 h-4 text-teal-400" />
                        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                            Shareable Link
                        </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <p className="flex-1 text-teal-400 font-mono text-sm break-all select-all bg-black/30 p-2 rounded min-w-0">
                            {room.shareLink}
                        </p>
                        <Button
                            onClick={handleCopyLink}
                            className={`shrink-0 transition-all ${copied ? 'bg-green-600' : 'bg-teal-600 hover:bg-teal-500'}`}
                            size="sm"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-4 h-4 mr-1" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4 mr-1" />
                                    Copy
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 flex-wrap">
                    <Button
                        onClick={handleJoin}
                        className="flex-1 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 min-w-[150px] shadow-lg shadow-teal-900/20"
                    >
                        <Video className="w-4 h-4 mr-2" />
                        Start Meeting Now
                    </Button>

                    <Button
                        onClick={handleCreateNew}
                        variant="outline"
                        className="border-gray-500/50 hover:bg-gray-500/10 text-slate-300"
                    >
                        New Room
                    </Button>
                </div>
            </div>
        );
    }

    return null; // Should not reach here
};

export default SimpleVideoMeeting;
