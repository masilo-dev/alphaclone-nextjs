'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
    roomUrl?: string;
    callId: string;
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
    roomUrl: providedRoomUrl,
    callId,
    onLeave
}) => {
    const [resolvedRoomUrl, setResolvedRoomUrl] = useState<string | null>(providedRoomUrl || null);
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
    const isRestricted = !isUserAdmin(user);
    const [showParticipants, setShowParticipants] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [viewMode, setViewMode] = useState<'grid' | 'speaker'>('speaker');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isMobile, setIsMobile] = useState(false);

    const joinAttemptedRef = useRef(false);
    const isJoinedRef = useRef(isJoined);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Circuit breaker: Detect rapid re-renders
    const renderTimestampsRef = useRef<number[]>([]);
    const RENDER_LIMIT = 50;
    const RENDER_WINDOW_MS = 1000;

    useEffect(() => {
        const now = Date.now();
        renderTimestampsRef.current.push(now);
        renderTimestampsRef.current = renderTimestampsRef.current.filter(
            timestamp => now - timestamp < RENDER_WINDOW_MS
        );

        if (renderTimestampsRef.current.length > RENDER_LIMIT) {
            console.error('⚠️ CIRCUIT BREAKER: Too many re-renders detected!');
        }
    });

    // START CAMERA IMMEDIATELY (Instant Self-View)
    useEffect(() => {
        if (!isJoined && !isJoining && !localParticipant?.video?.track) {
            startCamera().catch(err => console.error('Failed to start camera:', err));
        }
    }, []);

    // Handle leaving the meeting
    const handleLeave = useCallback(async () => {
        try {
            const duration = callStartTime
                ? Math.floor((new Date().getTime() - callStartTime.getTime()) / 1000)
                : undefined;

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
    }, [callStartTime, callId, leave, onLeave]);

    // Resolve Room URL if not provided
    useEffect(() => {
        if (resolvedRoomUrl) return;

        const resolveUrl = async () => {
            try {
                const { call, error } = await dailyService.getVideoCall(callId);
                if (error || !call?.daily_room_url) {
                    throw new Error(error || 'Failed to resolve meeting URL');
                }
                setResolvedRoomUrl(call.daily_room_url);
            } catch (err) {
                console.error('Error resolving video URL:', err);
                toast.error('Failed to connect to the secure meeting channel');
                setTimeout(onLeave, 2000);
            }
        };

        resolveUrl();
    }, [callId, resolvedRoomUrl, onLeave]);

    // Join meeting on mount or when URL is resolved
    useEffect(() => {
        if (joinAttemptedRef.current || isJoining || isJoined || !resolvedRoomUrl) return;
        joinAttemptedRef.current = true;

        const joinMeeting = async () => {
            try {
                await join({
                    url: resolvedRoomUrl,
                    userName: user.name || 'Guest',
                });

                setCallStartTime(new Date());

                if (callId) {
                    await dailyService.startVideoCall(callId).catch(err => {
                        console.error('Failed to mark call as active:', err);
                    });
                }

                toast.success('Joined meeting successfully!');
            } catch (err: any) {
                console.error('Failed to join meeting:', err);
                toast.error(err?.userMessage || 'Failed to join meeting');
                joinAttemptedRef.current = false;
                setTimeout(onLeave, 2000);
            }
        };

        setTimeout(joinMeeting, 100);

        return () => {
            if (isJoinedRef.current) {
                handleLeave();
            }
        };
    }, [resolvedRoomUrl, user.name, callId, onLeave, join, isJoining, isJoined, handleLeave]);

    useEffect(() => {
        isJoinedRef.current = isJoined;
    }, [isJoined]);

    // Subscribe to call status changes
    useEffect(() => {
        if (!callId) return;

        const unsubscribe = dailyService.subscribeToCallStatus(callId, (status) => {
            if (status === 'ended' && isJoinedRef.current) {
                toast.success('The host has ended the meeting');
                setTimeout(handleLeave, 1500);
            }
        });

        return () => unsubscribe();
    }, [callId, handleLeave]);

    // Duration timer
    useEffect(() => {
        if (!isJoined || !callStartTime) return;

        const interval = setInterval(() => {
            const now = new Date();
            const elapsed = Math.floor((now.getTime() - callStartTime.getTime()) / 1000);
            setSecondsElapsed(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, [isJoined, callStartTime]);

    // Reset unread chat count when opened
    useEffect(() => {
        if (showChat) setUnreadChatCount(0);
    }, [showChat]);

    // Error handling
    useEffect(() => {
        if (error) {
            toast.error(error.userMessage);
        }
    }, [error]);

    const handleToggleAudio = useCallback(async () => {
        try { await toggleAudio(); } catch (err: any) { toast.error('Failed to toggle audio'); }
    }, [toggleAudio]);

    const handleToggleVideo = useCallback(async () => {
        try { await toggleVideo(); } catch (err: any) { toast.error('Failed to toggle video'); }
    }, [toggleVideo]);

    const handleToggleScreenShare = useCallback(async () => {
        try { await toggleScreenShare(); } catch (err: any) { toast.error('Failed to toggle screen share'); }
    }, [toggleScreenShare]);

    const handleMuteParticipant = useCallback(async (sessionId: string) => {
        if (!isUserAdmin(user)) return;
        try { await muteParticipant(sessionId); toast.success('Muted'); } catch (err) { toast.error('Error'); }
    }, [user, muteParticipant]);

    const handleRemoveParticipant = useCallback(async (sessionId: string) => {
        if (!isUserAdmin(user)) return;
        try { await removeParticipant(sessionId); toast.success('Removed'); } catch (err) { toast.error('Error'); }
    }, [user, removeParticipant]);

    const handleEndMeetingForAll = useCallback(async () => {
        if (!isUserAdmin(user)) return;
        if (!confirm('End meeting for all?')) return;
        try {
            if (callId) await dailyService.endVideoCall(callId, 0);
            await leave();
            onLeave();
        } catch (err) { toast.error('Error'); }
    }, [user, callId, leave, onLeave]);

    const handleSendChatMessage = useCallback(async (message: string) => {
        try {
            await sendChatMessage(message);
            const newMessage: ChatMessage = {
                id: Date.now().toString(),
                userName: user.name || 'You',
                userId: user.id || 'me',
                message,
                timestamp: new Date(),
                isLocal: true,
            };
            setChatMessages(prev => [...prev, newMessage]);
        } catch (err) { toast.error('Failed to send'); }
    }, [sendChatMessage, user.name, user.id]);

    useEffect(() => {
        if (!isJoined) return;
        const platform = config as any;
        const engine = platform?.engine;
        if (!engine) return;

        const handleAppMessage = (event: any) => {
            const { data, fromId } = event;
            if (data?.type === 'chat') {
                if (localParticipant?.sessionId === data.senderSessionId) return;
                const newMessage: ChatMessage = {
                    id: `${data.timestamp}-${fromId}`,
                    userName: data.sender || 'Guest',
                    userId: data.senderSessionId || fromId,
                    message: data.message,
                    timestamp: new Date(data.timestamp),
                    isLocal: false,
                };
                setChatMessages(prev => [...prev, newMessage]);
                if (!showChat) {
                    setUnreadChatCount(prev => prev + 1);
                    toast(`New message from ${data.sender}`, { icon: '💬' });
                }
            }
        };

        engine.on('app-message', handleAppMessage);
        return () => engine.off('app-message', handleAppMessage);
    }, [isJoined, localParticipant, showChat, config]);

    const gridClass = useMemo(() => {
        const count = participants.length;
        if (count === 1) return 'grid-cols-1';
        if (count === 2) return isMobile ? 'grid-cols-1' : 'grid-cols-2';
        if (count <= 4) return 'grid-cols-2';
        if (count <= 6) return isMobile ? 'grid-cols-2' : 'grid-cols-3';
        return isMobile ? 'grid-cols-2' : 'grid-cols-3 lg:grid-cols-4';
    }, [participants.length, isMobile]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if ((isJoining || !isJoined) && !localParticipant) {
        return (
            <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-50 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent opacity-50" />
                <div className="relative text-center">
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <div className="absolute inset-0 rounded-full border-4 border-teal-500/20" />
                        <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
                    </div>
                    <h2 className="text-white text-2xl font-bold tracking-tight mb-2">Connecting to meeting...</h2>
                    <p className="text-slate-400 font-medium">Securing your encrypted channel</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-950 z-[100] text-white flex flex-col overflow-hidden select-none">
            {/* Immersive Header */}
            <header className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/60 to-transparent z-[110] px-6 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">REC • {formatTime(secondsElapsed)}</span>
                    </div>
                    {/* Signal Indicator visual */}
                    <div className="flex items-end gap-0.5 h-3">
                        <div className="w-0.5 h-full bg-teal-500 rounded-full" />
                        <div className="w-0.5 h-4/5 bg-teal-500 rounded-full" />
                        <div className="w-0.5 h-3/5 bg-teal-500 rounded-full" />
                    </div>
                </div>

                <div className="flex items-center gap-2 pointer-events-auto">
                    <div className="flex bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/10 p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            Grid
                        </button>
                        <button
                            onClick={() => setViewMode('speaker')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'speaker' ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            Speaker
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Stage */}
            <main className={`flex-1 relative mt-16 mb-24 overflow-hidden ${viewMode === 'grid' ? 'p-4 sm:p-6' : ''}`}>
                {viewMode === 'grid' ? (
                    <div className={`grid gap-3 sm:gap-6 w-full h-full ${gridClass}`}>
                        {participants.map(p => (
                            <div key={p.sessionId} className="relative rounded-3xl overflow-hidden bg-slate-900 ring-1 ring-white/5 shadow-2xl transition-transform duration-500">
                                <CustomVideoTile participant={p} isLocal={p.isLocal} isAdmin={isUserAdmin(user)} variant="stage" />
                                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                                    {!p.audio.enabled && <MicOff className="w-3.5 h-3.5 text-red-500" />}
                                    <span className="text-xs font-semibold">{p.isLocal ? "You" : p.userName}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col gap-4">
                        {/* Speaker View - Big area */}
                        <div className="flex-1 flex items-center justify-center p-2 min-h-0">
                            {participants.length > 0 ? (
                                <div className="w-full h-full max-w-6xl rounded-3xl overflow-hidden ring-1 ring-white/5 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                                    <CustomVideoTile
                                        participant={remoteParticipants[0] || localParticipant!}
                                        isLocal={remoteParticipants.length === 0}
                                        isAdmin={isUserAdmin(user)}
                                        variant="stage"
                                    />
                                </div>
                            ) : (
                                <div className="animate-pulse flex flex-col items-center">
                                    <div className="w-16 h-16 bg-slate-800 rounded-full mb-4" />
                                    <div className="w-48 h-4 bg-slate-800 rounded-full" />
                                </div>
                            )}
                        </div>

                        {/* Filmstrip - other participants */}
                        {participants.length > 1 && (
                            <div className="h-32 sm:h-44 flex gap-4 p-4 overflow-x-auto scrollbar-hide">
                                {participants
                                    .filter(p => p.sessionId !== (remoteParticipants[0]?.sessionId || localParticipant?.sessionId))
                                    .map(p => (
                                        <div key={p.sessionId} className="h-full aspect-video flex-shrink-0 rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-xl group cursor-pointer active:scale-95 transition-transform">
                                            <CustomVideoTile
                                                participant={p}
                                                isLocal={p.isLocal}
                                                isAdmin={isUserAdmin(user)}
                                                variant="sidecar"
                                                onMuteParticipant={handleMuteParticipant}
                                                onRemoveParticipant={handleRemoveParticipant}
                                            />
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Controls */}
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
                roomUrl={resolvedRoomUrl || ''}
                callId={callId}
                unreadMessageCount={unreadChatCount}
            />

            {/* Overlay Panels */}
            <MeetingChat
                user={user}
                isOpen={showChat}
                onClose={() => setShowChat(false)}
                onSendMessage={handleSendChatMessage}
                messages={chatMessages}
            />
        </div>
    );
};

export default CustomVideoRoom;
