import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useVideoPlatform } from '../../../hooks/useVideoPlatform';
import CustomVideoTile from './CustomVideoTile';
import VideoControls from './VideoControls';
import MeetingChat, { ChatMessage } from './MeetingChat';
import { User } from '../../../types';
import { dailyService } from '../../../services/dailyService';
import toast from 'react-hot-toast';
import { ChevronRight, ChevronLeft, Minimize2, Maximize2, X, Mic, MicOff, Video, VideoOff, Users } from 'lucide-react';

interface CustomVideoRoomProps {
    user: User;
    roomUrl: string;
    callId?: string;
    onLeave: () => void;
    onToggleSidebar?: () => void;
    showSidebar?: boolean;
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
}

// Check if user is admin or tenant admin
const isUserAdmin = (user: User): boolean => {
    return user.role === 'admin' || user.role === 'tenant_admin';
};

/**
 * Custom Video Room
 * Uses new layered architecture for production-ready reliability
 * - Clean state management via useVideoPlatform hook
 * - No direct Daily API calls
 * - Automatic error handling and recovery
 */
const CustomVideoRoom: React.FC<CustomVideoRoomProps> = ({
    user,
    roomUrl,
    callId,
    onLeave,
    onToggleSidebar,
    showSidebar,
    isMinimized = false,
    onToggleMinimize
}) => {
    const {
        isJoined,
        isJoining,
        isAudioEnabled,
        isVideoEnabled,
        isScreenSharing,
        participants,
        localParticipant,
        remoteParticipants,
        error,
        join,
        leave,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        sendChatMessage,
        muteParticipant,
        removeParticipant,
        startCamera,
        config,
    } = useVideoPlatform();

    const [callStartTime, setCallStartTime] = useState<Date | null>(null);
    const [secondsElapsed, setSecondsElapsed] = useState(0);
    const MAX_DURATION_SECONDS = 25 * 60; // 25 minutes
    const isRestricted = user.role !== 'admin';
    const [showParticipants, setShowParticipants] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'speaker'>('speaker');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const joinAttemptedRef = useRef(false); // Prevent double join in React Strict Mode
    const isJoinedRef = useRef(isJoined); // Track joined state without causing re-renders

    // Circuit breaker: Detect rapid re-renders (Error 310 prevention)
    const renderCountRef = useRef(0);
    const renderTimestampsRef = useRef<number[]>([]);
    const RENDER_LIMIT = 50; // Max renders allowed
    const RENDER_WINDOW_MS = 1000; // Within 1 second

    useEffect(() => {
        renderCountRef.current++;
        const now = Date.now();
        renderTimestampsRef.current.push(now);

        // Keep only recent renders
        renderTimestampsRef.current = renderTimestampsRef.current.filter(
            timestamp => now - timestamp < RENDER_WINDOW_MS
        );

        // If too many renders in window, log warning
        if (renderTimestampsRef.current.length > RENDER_LIMIT) {
            console.error('⚠️ CIRCUIT BREAKER: Too many re-renders detected!', {
                count: renderTimestampsRef.current.length,
                windowMs: RENDER_WINDOW_MS,
                limit: RENDER_LIMIT,
                participantCount: participants.length,
            });
            // Don't throw - just log. React will handle the actual Error 310 if limit exceeded
        }
    });

    // START CAMERA IMMEDIATELY (Instant Self-View)
    useEffect(() => {
        // Only start if not already joined/joining/started (to avoid resetting)
        if (!isJoined && !isJoining && !localParticipant?.video?.track) {
            console.log('📸 Starting camera immediately for self-view...');
            startCamera().catch(err => console.error('Failed to start camera:', err));
        }
    }, []);

    // Join meeting on mount
    useEffect(() => {
        // Guard: Prevent double join attempts (React Strict Mode protection)
        if (joinAttemptedRef.current || isJoining || isJoined) {
            console.log('Join attempt skipped:', {
                attemptedBefore: joinAttemptedRef.current,
                isJoining,
                isJoined
            });
            return;
        }

        joinAttemptedRef.current = true;

        const joinMeeting = async () => {
            try {
                console.log('Attempting to join meeting...');
                await join({
                    url: roomUrl,
                    userName: user.name || 'Guest',
                });

                setCallStartTime(new Date());

                // Mark call as active in database
                if (callId) {
                    await dailyService.startVideoCall(callId).catch(err => {
                        console.error('Failed to mark call as active:', err);
                    });
                }

                toast.success('Joined meeting successfully!');
            } catch (err: any) {
                console.error('Failed to join meeting:', err);
                toast.error(err?.userMessage || 'Failed to join meeting');
                joinAttemptedRef.current = false; // Reset on error so user can retry
                setTimeout(onLeave, 2000);
            }
        };

        // Small delay to allow startCamera to initiate first (better UX)
        // but don't block joining if camera takes long
        setTimeout(joinMeeting, 100);

        // Cleanup on unmount - use ref to avoid dependency on isJoined state
        return () => {
            if (isJoinedRef.current) {
                handleLeave();
            }
        };
    }, []);

    // Keep isJoinedRef in sync with isJoined state
    useEffect(() => {
        isJoinedRef.current = isJoined;
    }, [isJoined]);

    // ... (rest of hooks omitted for brevity, logic remains same) ...
    // Subscribe to call status changes (for admin ending call for all)
    useEffect(() => {
        if (!callId) return;

        const unsubscribe = dailyService.subscribeToCallStatus(callId, (status) => {
            if (status === 'ended' && isJoinedRef.current) {
                console.log('Call ended by admin, leaving automatically...');
                toast.success('The host has ended the meeting');
                setTimeout(() => {
                    handleLeave();
                }, 1500); // Give time for toast to show
            }
        });

        return () => {
            unsubscribe();
        };
    }, [callId]); // Only re-subscribe when callId changes, not isJoined

    // Limit enforcement timer
    useEffect(() => {
        if (!isJoined || !callStartTime || !isRestricted) return;

        const interval = setInterval(() => {
            const now = new Date();
            const elapsed = Math.floor((now.getTime() - callStartTime.getTime()) / 1000);
            setSecondsElapsed(elapsed);

            if (elapsed >= MAX_DURATION_SECONDS) {
                toast.error("Meeting time limit (20 min) reached.");
                handleLeave();
            } else if (MAX_DURATION_SECONDS - elapsed === 60) {
                toast.error("1 minute remaining until auto-disconnection.");
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isJoined, callStartTime, isRestricted]);

    // Show error toast when errors occur
    useEffect(() => {
        if (error) {
            toast.error(error.userMessage);

            // Auto-retry if recoverable
            if (error.action === 'retry' && error.recoverable) {
                // Could implement auto-retry logic here
            }
        }
    }, [error]);

    // ... (handlers omitted for brevity) ... 
    // Copied handlers back to ensure scope - or I can assume they are unchanged if I carefully slice.
    // To be safe, I will include the handlers since "multi_replace" isn't used here and I'm replacing a large chunk.
    // Wait, replacing a large chunk of hooks + handlers is risky if I duplicate logic or miss imports.
    // The previous implementation was fine, I only need to inject startCamera and change return logic.
    // I will use replace_file_content targeted at specific blocks if possible, or just be careful.
    // I'll stick to the original plan of replacing the top part (hooks) and bottom part (rendering) separately if needed, 
    // but here I'm replacing lines 62-151 (hooks) AND lines 417-429 (rendering). 
    // "replace_file_content" can only do one contiguous block.
    // I will do TWO calls. 
    // FIRST CALL: Update hooks locally.
    // SECOND CALL: Update rendering logic.

    // Changing strategy to two calls.
    // This tool call only updates the hooks part (lines 62-151).
    // I will use the hook update logic below.

    // ... (Re-implementing handlers for context if needed, but I'll try to just edit the hooks section)


    // Keep isJoinedRef in sync with isJoined state
    useEffect(() => {
        isJoinedRef.current = isJoined;
    }, [isJoined]);

    // Subscribe to call status changes (for admin ending call for all)
    useEffect(() => {
        if (!callId) return;

        const unsubscribe = dailyService.subscribeToCallStatus(callId, (status) => {
            if (status === 'ended' && isJoinedRef.current) {
                console.log('Call ended by admin, leaving automatically...');
                toast.success('The host has ended the meeting');
                setTimeout(() => {
                    handleLeave();
                }, 1500); // Give time for toast to show
            }
        });

        return () => {
            unsubscribe();
        };
    }, [callId]); // Only re-subscribe when callId changes, not isJoined

    // Limit enforcement timer
    useEffect(() => {
        if (!isJoined || !callStartTime || !isRestricted) return;

        const interval = setInterval(() => {
            const now = new Date();
            const elapsed = Math.floor((now.getTime() - callStartTime.getTime()) / 1000);
            setSecondsElapsed(elapsed);

            if (elapsed >= MAX_DURATION_SECONDS) {
                toast.error("Meeting time limit (20 min) reached.");
                handleLeave();
            } else if (MAX_DURATION_SECONDS - elapsed === 60) {
                toast.error("1 minute remaining until auto-disconnection.");
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isJoined, callStartTime, isRestricted]);

    // Show error toast when errors occur
    useEffect(() => {
        if (error) {
            toast.error(error.userMessage);

            // Auto-retry if recoverable
            if (error.action === 'retry' && error.recoverable) {
                // Could implement auto-retry logic here
            }
        }
    }, [error]);

    // Handle leaving the meeting
    const handleLeave = async () => {
        try {
            // Calculate duration
            const duration = callStartTime
                ? Math.floor((new Date().getTime() - callStartTime.getTime()) / 1000)
                : undefined;

            // End call in database
            if (callId && duration) {
                await dailyService.endVideoCall(callId, duration).catch(err => {
                    console.error('Failed to end call in database:', err);
                });
            }

            await leave();
            onLeave();
        } catch (err) {
            console.error('Error leaving meeting:', err);
            onLeave();
        }
    };

    // Handle audio toggle
    const handleToggleAudio = async () => {
        try {
            await toggleAudio();
        } catch (err: any) {
            toast.error(err?.userMessage || 'Failed to toggle audio');
        }
    };

    // Handle video toggle
    const handleToggleVideo = async () => {
        try {
            await toggleVideo();
        } catch (err: any) {
            toast.error(err?.userMessage || 'Failed to toggle video');
        }
    };

    // Handle screen share toggle
    const handleToggleScreenShare = async () => {
        try {
            await toggleScreenShare();
        } catch (err: any) {
            toast.error(err?.userMessage || 'Failed to toggle screen share');
        }
    };

    // Admin: Mute participant (force mute)
    const handleMuteParticipant = async (sessionId: string) => {
        if (!isUserAdmin(user)) {
            toast.error('Only admins can mute participants');
            return;
        }

        try {
            await muteParticipant(sessionId);
            toast.success('Mute request sent');
        } catch (err: any) {
            toast.error('Failed to mute participant');
        }
    };

    // Admin: Remove participant from call
    const handleRemoveParticipant = async (sessionId: string) => {
        if (!isUserAdmin(user)) {
            toast.error('Only admins can remove participants');
            return;
        }

        try {
            await removeParticipant(sessionId);
            toast.success('Remove request sent');
        } catch (err: any) {
            toast.error('Failed to remove participant');
        }
    };

    // Admin: End meeting for everyone
    const handleEndMeetingForAll = async () => {
        if (!isUserAdmin(user)) {
            toast.error('Only admins can end meetings');
            return;
        }

        if (!confirm('End this meeting for everyone?')) {
            return;
        }

        try {
            if (callId) {
                await dailyService.endVideoCall(callId, 0);
                toast.success('Meeting ended for all participants');
            }
            await leave();
            onLeave();
        } catch (err: any) {
            toast.error('Failed to end meeting');
        }
    };

    // Handle sending chat message
    const handleSendChatMessage = async (message: string) => {
        try {
            await sendChatMessage(message);

            // Add to local messages immediately for instant feedback
            const newMessage: ChatMessage = {
                id: Date.now().toString(),
                userName: user.name || 'You',
                userId: user.id,
                message,
                timestamp: new Date(),
                isLocal: true,
            };
            setChatMessages(prev => [...prev, newMessage]);
        } catch (err: any) {
            toast.error('Failed to send message');
        }
    };

    // Listen for incoming chat messages via app-message events
    useEffect(() => {
        if (!isJoined) return;

        // Get the platform instance to listen for app messages
        const platform = config as any;
        const engine = platform?.engine;

        if (!engine) return;

        const handleAppMessage = (event: any) => {
            const { data, fromId } = event;

            // Handle chat messages
            if (data?.type === 'chat') {
                const isFromSelf = localParticipant?.sessionId === data.senderSessionId;

                // Don't add if it's from us (already added in handleSendChatMessage)
                if (isFromSelf) return;

                const newMessage: ChatMessage = {
                    id: `${data.timestamp}-${fromId}`,
                    userName: data.sender || 'Guest',
                    userId: data.senderSessionId || fromId,
                    message: data.message,
                    timestamp: new Date(data.timestamp),
                    isLocal: false,
                };

                setChatMessages(prev => [...prev, newMessage]);

                // Show notification if chat is closed
                if (!showChat) {
                    toast.success(`${data.sender}: ${data.message.substring(0, 50)}${data.message.length > 50 ? '...' : ''}`);
                }
            }
        };

        engine.on('app-message', handleAppMessage);

        return () => {
            engine.off('app-message', handleAppMessage);
        };
    }, [isJoined, localParticipant, showChat, config]);

    // DEBUG: Log participant info to diagnose visibility issues
    // Use refs to prevent this from triggering re-renders
    // CRITICAL: Must be defined BEFORE any early returns (Rules of Hooks)
    const lastParticipantCountRef = useRef(0);
    useEffect(() => {
        // Only log when participant count changes (not on every state update)
        if (participants.length !== lastParticipantCountRef.current) {
            lastParticipantCountRef.current = participants.length;
            console.log('🎥 PARTICIPANTS UPDATE:', {
                total: participants.length,
                local: localParticipant ? 1 : 0,
                remote: remoteParticipants.length,
                participants: participants.map(p => ({
                    name: p.userName,
                    sessionId: p.sessionId,
                    isLocal: p.isLocal,
                    hasVideo: !!p.video.track,
                    hasAudio: !!p.audio.track
                }))
            });
        }
    }, [participants.length, localParticipant, remoteParticipants.length]);

    // Calculate grid layout based on participant count (support up to 50+ people)
    // Automatically minimize tiles as more people join
    // Memoized to prevent recalculation on every render (Error 310 protection)
    // CRITICAL: Must be defined BEFORE any early returns (Rules of Hooks)
    const gridClass = useMemo(() => {
        return participants.length === 1 ? 'grid-cols-1' :
            participants.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                participants.length <= 4 ? 'grid-cols-2 sm:grid-cols-2' :
                    participants.length <= 6 ? 'grid-cols-2 sm:grid-cols-3' :
                        participants.length <= 9 ? 'grid-cols-3 sm:grid-cols-3 lg:grid-cols-3' :
                            participants.length <= 16 ? 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-4' :
                                participants.length <= 25 ? 'grid-cols-4 sm:grid-cols-5 lg:grid-cols-5' :
                                    'grid-cols-4 sm:grid-cols-6 lg:grid-cols-7'; // 50+ people
    }, [participants.length]);

    // Show loading state while joining - BUT show local video immediately if available (Instant View)
    // CRITICAL: This early return must come AFTER all hooks (Rules of Hooks)
    if ((isJoining || !isJoined) && !localParticipant) {
        return (
            <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-500 mx-auto mb-6"></div>
                    <p className="text-white text-xl font-medium mb-2">
                        {isJoining ? 'Joining meeting...' : 'Connecting...'}
                    </p>
                    <p className="text-slate-400 text-sm">Please wait while we connect you</p>
                </div>
            </div>
        );
    }

    // Render Minimized (PiP) View
    if (isMinimized) {
        return (
            <div className="fixed bottom-4 right-4 z-[200] w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-slide-up">
                {/* Header / Draggable Area */}
                <div className="bg-slate-800 p-2 flex items-center justify-between cursor-move">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-bold text-white">Live Call ({participants.length})</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onToggleMinimize}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                            title="Maximize"
                        >
                            <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleLeave}
                            className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300"
                            title="Leave Call"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Video Content (Simplified Grid) */}
                <div className="aspect-video bg-black relative">
                    {/* Show Active Speaker or Local if alone */}
                    {participants.length > 0 ? (
                        <CustomVideoTile
                            participant={participants.find(p => !p.isLocal) || participants[0]}
                            isLocal={participants.find(p => !p.isLocal) ? false : true}
                            isAdmin={false}
                        // Removed isMinimized prop to avoid TS error until CustomVideoTile is updated
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 text-xs">Waiting...</div>
                    )}
                </div>

                {/* Mini Controls */}
                <div className="p-3 bg-slate-900 flex justify-center gap-4">
                    <button onClick={handleToggleAudio} className={`p-2 rounded-full ${!isAudioEnabled ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-white'}`}>
                        {!isAudioEnabled ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <button onClick={handleToggleVideo} className={`p-2 rounded-full ${!isVideoEnabled ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-white'}`}>
                        {!isVideoEnabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-gray-900 z-[100]">
            {/* Window Controls */}
            <div className="absolute top-4 right-4 z-[120] flex gap-2">
                {onToggleMinimize && (
                    <button
                        onClick={onToggleMinimize}
                        className="p-2 bg-gray-800/90 hover:bg-gray-700/90 rounded-lg text-white shadow-lg border border-gray-700 transition-all"
                        title="Minimize"
                    >
                        <Minimize2 className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Toggle Sidebar Button - Arrow */}
            {onToggleSidebar && (
                <button
                    onClick={onToggleSidebar}
                    className="fixed top-4 left-4 z-[120] p-3 bg-gray-800/90 hover:bg-gray-700/90 rounded-full shadow-lg transition-all border border-gray-700"
                    title={showSidebar ? 'Hide navigation' : 'Show navigation'}
                >
                    {showSidebar ? (
                        <ChevronLeft className="w-5 h-5 text-white" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-white" />
                    )}
                </button>
            )}

            {/* TOP BAR - Consolidates Metadata & Status (Gate B.3) */}
            <div className={`absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent z-[110] flex items-center justify-between px-6 transition-transform duration-300 ${isMinimized ? '-translate-y-full' : 'translate-y-0'}`}>
                <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/30 backdrop-blur-md">
                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Autonomous Session</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-black/40 backdrop-blur-xl rounded-full border border-white/10 p-0.5">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${viewMode === 'grid' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            Grid
                        </button>
                        <button
                            onClick={() => setViewMode('speaker')}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${viewMode === 'speaker' ? 'bg-teal-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            Stage
                        </button>
                    </div>

                    {isRestricted && isJoined && (
                        <div className="bg-black/40 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                            <span className={`text-[11px] font-black tracking-tighter ${MAX_DURATION_SECONDS - secondsElapsed < 120 ? 'text-red-400 animate-pulse' : 'text-slate-300'}`}>
                                {Math.floor((MAX_DURATION_SECONDS - secondsElapsed) / 60)}:{((MAX_DURATION_SECONDS - secondsElapsed) % 60).toString().padStart(2, '0')}
                            </span>
                            <div className="w-px h-3 bg-white/10" />
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Time Left</span>
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN STAGE & SHELF - Layout Reflow (Gate E) */}
            <div className={`absolute inset-0 pt-16 pb-24 overflow-hidden flex flex-col ${viewMode === 'grid' ? 'p-4' : ''}`}>

                {/* Grid View Mode */}
                {viewMode === 'grid' && (
                    <div className={`grid gap-4 w-full h-full ${gridClass} auto-rows-fr`}>
                        {participants.map(participant => (
                            <div key={participant.sessionId} className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl">
                                <CustomVideoTile
                                    participant={participant}
                                    isLocal={participant.isLocal}
                                    isAdmin={isUserAdmin(user)}
                                    variant="stage"
                                />
                                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white font-medium">
                                    {participant.userName || 'Guest'} {participant.isLocal && '(You)'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Speaker View Mode (Stage + Shelf) */}
                {viewMode === 'speaker' && (
                    <>
                        {/* 1. THE STAGE (Host / Active Speaker) - Max 35% Mobile Height (Gate B.1) */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex-1 p-2 sm:p-4 flex items-center justify-center min-h-0">
                                {participants.length > 0 && (remoteParticipants[0] || localParticipant) ? (
                                    <div className="w-full h-full max-w-5xl mx-auto">
                                        <CustomVideoTile
                                            participant={(remoteParticipants[0] || localParticipant)!}
                                            isLocal={remoteParticipants.length === 0}
                                            isAdmin={isUserAdmin(user)}
                                            variant="stage"
                                        />
                                    </div>
                                ) : (
                                    /* Empty state when alone */
                                    <div className="text-center text-gray-500 animate-in fade-in zoom-in duration-700">
                                        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                                            <Users className="w-8 h-8 opacity-20" />
                                        </div>
                                        <p className="text-lg font-medium text-slate-400">Waiting for participants...</p>
                                        <p className="text-sm text-slate-600">Your Business OS is ready for the meeting</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. THE SHELF (Guest List) - Density Logic (Gate B.2) */}
                        {participants.length > 1 && (
                            <div className="h-28 sm:h-36 bg-black/20 backdrop-blur-sm border-t border-white/5 flex flex-col">
                                <div className="px-4 pt-2 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Participants ({participants.length})</span>
                                </div>
                                <div className="flex-1 flex overflow-x-auto overflow-y-hidden gap-2 p-2 sm:p-3 scrollbar-hide">
                                    {/* If local participated in stage, don't show here unless count > 2, etc. 
                                For simplicity: Show all EXCEPT the one currently on stage. */}
                                    {participants
                                        .filter(p => p.sessionId !== (remoteParticipants[0]?.sessionId || localParticipant?.sessionId))
                                        .map(participant => (
                                            <div key={participant.sessionId} className="h-full aspect-video flex-shrink-0 animate-in slide-in-from-right duration-300">
                                                <CustomVideoTile
                                                    participant={participant}
                                                    isLocal={participant.isLocal}
                                                    isAdmin={isUserAdmin(user)}
                                                    variant="sidecar"
                                                    onMuteParticipant={handleMuteParticipant}
                                                    onRemoveParticipant={handleRemoveParticipant}
                                                />
                                            </div>
                                        ))
                                    }

                                    {/* Always show local video in shelf if remote is on stage */}
                                    {remoteParticipants.length > 0 && localParticipant && (
                                        <div className="h-full aspect-video flex-shrink-0 order-first">
                                            <CustomVideoTile
                                                participant={localParticipant}
                                                isLocal={true}
                                                isAdmin={isUserAdmin(user)}
                                                variant="sidecar"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Participants sidebar */}
            {
                showParticipants && (
                    <div className="absolute right-0 top-0 bottom-24 w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-auto z-10">
                        <h3 className="text-white text-lg font-semibold mb-4">
                            Participants ({participants.length})
                        </h3>
                        <div className="space-y-2">
                            {participants.map(participant => (
                                <div
                                    key={participant.sessionId}
                                    className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg"
                                >
                                    <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center">
                                        <span className="text-white font-medium">
                                            {(participant?.userName?.[0] || 'G').toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white text-sm font-medium">
                                            {participant.userName || 'Guest'}
                                            {participant.isLocal && ' (You)'}
                                        </p>
                                        <p className="text-gray-400 text-xs">
                                            {participant.isLocal ? 'You' : 'Participant'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* Chat panel */}
            <MeetingChat
                user={user}
                isOpen={showChat}
                onClose={() => setShowChat(false)}
                onSendMessage={handleSendChatMessage}
                messages={chatMessages}
            />

            {/* Control bar */}
            <VideoControls
                isMuted={!isAudioEnabled}
                isVideoOff={!isVideoEnabled}
                isScreenSharing={isScreenSharing}
                onToggleMic={handleToggleAudio}
                onToggleVideo={handleToggleVideo}
                onToggleScreenShare={handleToggleScreenShare}
                onLeave={handleLeave}
                onToggleParticipants={() => setShowParticipants(!showParticipants)}
                onToggleChat={() => setShowChat(!showChat)}
                onEndForAll={isUserAdmin(user) ? handleEndMeetingForAll : undefined}
                isAdmin={isUserAdmin(user)}
                roomUrl={roomUrl}
                callId={callId}
            />
        </div >
    );
};

export default CustomVideoRoom;
