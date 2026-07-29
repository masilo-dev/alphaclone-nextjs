'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useVideoPlatform } from '../../../hooks/useVideoPlatform';
import CustomVideoTile from './CustomVideoTile';
import VideoControls from './VideoControls';
import { DeviceSettingsModal } from './DeviceSettingsModal';
import toast from 'react-hot-toast';
import { MicOff, Maximize2, PhoneOff, Wifi, WifiOff, RefreshCw } from 'lucide-react';
<<<<<<< HEAD
=======
import { supabase } from '../../../lib/supabase';
>>>>>>> origin/main
import { User } from '../../../types';
import { dailyService } from '../../../services/dailyService';
import LiveKitStage from './LiveKitStage';

interface CustomVideoRoomProps {
    user: User;
    roomUrl?: string;
    callId: string;
    onLeave: () => void;
    onToggleSidebar?: () => void;
    showSidebar?: boolean;
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
    meetingAccessPin?: string;
    guestName?: string;
    meetingAccessToken?: string;
}

// Check if user is admin or tenant admin
const isUserAdmin = (user: User): boolean => {
    return ['admin', 'tenant_admin', 'owner', 'super_admin'].includes(user.role);
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
    onLeave,
    isMinimized = false,
    onToggleMinimize,
<<<<<<< HEAD
    meetingAccessPin,
    guestName,
    meetingAccessToken,
=======
>>>>>>> origin/main
}) => {
    const [resolvedRoomUrl, setResolvedRoomUrl] = useState<string | null>(providedRoomUrl || null);
    const [liveKitSession, setLiveKitSession] = useState<{ url: string; token: string; roomName: string } | null>(null);
    const [liveKitError, setLiveKitError] = useState<string | null>(null);
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
        platformState,
        networkQuality,
        join,
        leave,
        reconnect,
        startCamera,
        setAudioDevice,
        setVideoDevice,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        muteParticipant,
        removeParticipant,
        isRecording,
        startRecording,
        stopRecording,
        setRoomLocked,
    } = useVideoPlatform();

    const [callStartTime, setCallStartTime] = useState<Date | null>(null);
    const [secondsElapsed, setSecondsElapsed] = useState(0);
    const [hasMeetingStarted, setHasMeetingStarted] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'speaker'>('speaker');
    const [isMobile, setIsMobile] = useState(false);
    const [preJoinAccepted, setPreJoinAccepted] = useState(false);
    const [isCheckingDevices, setIsCheckingDevices] = useState(false);
    const [preJoinError, setPreJoinError] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [showDeviceSettings, setShowDeviceSettings] = useState(false);

    const joinAttemptedRef = useRef(false);
    const isJoinedRef = useRef(isJoined);
    const finalizedRef = useRef(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Circuit breaker: Detect rapid re-renders
    const renderTimestampsRef = useRef<number[]>([]);
    const circuitBreakerWarnedRef = useRef(false);
    const RENDER_LIMIT = 50;
    const RENDER_WINDOW_MS = 1000;

    useEffect(() => {
        const now = Date.now();
        renderTimestampsRef.current.push(now);
        renderTimestampsRef.current = renderTimestampsRef.current.filter(
            timestamp => now - timestamp < RENDER_WINDOW_MS
        );

        if (
            process.env.NODE_ENV !== 'production' &&
            renderTimestampsRef.current.length > RENDER_LIMIT &&
            !circuitBreakerWarnedRef.current
        ) {
            circuitBreakerWarnedRef.current = true;
            console.error('CIRCUIT_BREAKER: too many re-renders detected');
        }
    });

    const finalizeMeetingDb = useCallback(async () => {
        if (finalizedRef.current) return;
        finalizedRef.current = true;
        try {
            const duration = callStartTime
                ? Math.floor((new Date().getTime() - callStartTime.getTime()) / 1000)
                : undefined;

            if (callId && duration && isUserAdmin(user)) {
                await dailyService.endVideoCall(callId, duration).catch(err => {
                    console.error('Failed to end call in database:', err);
                });
            }
            import('@/services/activityService').then(({ activityService }) => {
                activityService.logActivity(user.id, 'VIDEO_MEETING_ENDED', {
                    callId,
                    durationSeconds: duration || 0,
                    participantCount: participants.length,
                }).catch(() => undefined);
            }).catch(() => undefined);
            if (duration && duration > 0) {
                const minutes = Math.max(1, Math.round(duration / 60));
                toast.success(`Meeting completed. Duration: ${minutes} min.`);
            }
            onLeave();
        } catch (err) {
            console.error('Error finalizing meeting:', err);
            onLeave();
        }
    }, [callStartTime, callId, onLeave, user, participants.length]);

    const handleLeave = useCallback(async () => {
        try {
            await leave();
            await finalizeMeetingDb();
        } catch (err) {
            console.error('Error leaving meeting:', err);
            await finalizeMeetingDb();
        }
    }, [leave, finalizeMeetingDb]);

    const handlePreflightCheck = useCallback(async () => {
        setIsCheckingDevices(true);
        setPreJoinError(null);
        try {
            await startCamera();
        } catch (err) {
            setPreJoinError('Camera or microphone access is blocked. Please allow permissions and retry.');
        } finally {
            setIsCheckingDevices(false);
        }
    }, [startCamera]);

    useEffect(() => {
        if (!preJoinAccepted || liveKitSession || liveKitError || !callId) return;

        let cancelled = false;
        const connectLiveKit = async () => {
            try {
                const response = await fetch('/api/livekit/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
<<<<<<< HEAD
                    body: JSON.stringify({ callId, meetingAccessPin, meetingAccessToken, guestName }),
=======
                    body: JSON.stringify({ callId }),
>>>>>>> origin/main
                });

                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(payload?.error || 'Failed to create secure meeting token');
                }

                if (cancelled) return;
                setLiveKitSession({
                    url: payload.url,
                    token: payload.token,
                    roomName: payload.roomName,
                });
                setCallStartTime(new Date());

<<<<<<< HEAD
=======
                if (callId && isUserAdmin(user)) {
                    await dailyService.startVideoCall(callId).catch(err => {
                        console.error('Failed to mark call as active:', err);
                    });
                }

>>>>>>> origin/main
                import('@/services/activityService').then(({ activityService }) => {
                    activityService.logActivity(user.id, 'VIDEO_MEETING_JOINED', {
                        callId,
                        transport: 'secure_realtime',
                    }).catch(() => undefined);
                }).catch(() => undefined);
            } catch (err) {
                if (!cancelled) {
                    const message = err instanceof Error ? err.message : 'Failed to connect to secure meeting';
                    setLiveKitError(message);
                    toast.error(message);
                }
            }
        };

        void connectLiveKit();
        return () => {
            cancelled = true;
        };
<<<<<<< HEAD
    }, [preJoinAccepted, liveKitSession, liveKitError, callId, user, meetingAccessPin, meetingAccessToken, guestName]);
=======
    }, [preJoinAccepted, liveKitSession, liveKitError, callId, user]);
>>>>>>> origin/main

    // Legacy room-url join remains disabled; secure meetings are brokered by /api/livekit/token.
    useEffect(() => {
        if (liveKitSession || preJoinAccepted) return;
        if (!preJoinAccepted || joinAttemptedRef.current || isJoining || isJoined || !resolvedRoomUrl) return;
        joinAttemptedRef.current = true;

        const joinMeeting = async () => {
            try {
<<<<<<< HEAD
                let token: string | undefined;
                if (callId) {
                    const { token: fetched } = await dailyService.getMeetingToken(
                        callId,
                        guestName || user.name || 'Guest',
                        meetingAccessPin,
                        meetingAccessToken,
=======
                const roomName = resolvedRoomUrl.split('/').filter(Boolean).pop();
                let token: string | undefined;
                if (roomName) {
                    const { token: fetched } = await dailyService.getMeetingToken(
                        roomName,
                        user.name || 'Guest',
                        isUserAdmin(user)
>>>>>>> origin/main
                    );
                    if (fetched) token = fetched;
                }

                await join({
                    url: resolvedRoomUrl,
                    userName: user.name || 'Guest',
                    token,
                });

                setCallStartTime(new Date());

                toast.success('Joined meeting successfully!');
                import('@/services/activityService').then(({ activityService }) => {
                    activityService.logActivity(user.id, 'VIDEO_MEETING_JOINED', {
                        callId,
                    }).catch(() => undefined);
                }).catch(() => undefined);
            } catch (err: any) {
                console.error('Failed to join meeting:', err);
                toast.error(err?.userMessage || 'Failed to join meeting');
                joinAttemptedRef.current = false;
                setTimeout(onLeave, 2000);
            }
        };

        setTimeout(joinMeeting, 100);
    }, [resolvedRoomUrl, user.name, callId, onLeave, join, isJoining, isJoined, user, preJoinAccepted]);

    // Meeting Start Logic (2 people trigger)
    useEffect(() => {
        if (!isJoined || !callId || hasMeetingStarted) return;

        // Let the server determine whether this participant is the host. This also
        // supports member-role hosts without trusting client-side role labels.
        if (participants.length >= 2) {
            const startActiveMeeting = async () => {
                setHasMeetingStarted(true);
                try {
                    const result = await dailyService.startVideoCall(callId);
                    if (result.error) throw new Error(result.error);
                } catch (err) {
                    console.error('Failed to set meeting_started_at:', err);
                }
            };

            startActiveMeeting();
        }
    }, [isJoined, callId, participants, hasMeetingStarted, user]);

    const handleLeaveRef = useRef(handleLeave);
    useEffect(() => {
        handleLeaveRef.current = handleLeave;
    }, [handleLeave]);

    const finalizeMeetingDbRef = useRef(finalizeMeetingDb);
    useEffect(() => {
        finalizeMeetingDbRef.current = finalizeMeetingDb;
    }, [finalizeMeetingDb]);

    useEffect(() => {
        return () => {
            void (async () => {
                if (finalizedRef.current) return;
                if (isJoinedRef.current) {
                    await handleLeaveRef.current();
                }
            })();
        };
    }, []);

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

    useEffect(() => {
        if (!callStartTime) return;

        const interval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
            setSecondsElapsed(elapsed);
        }, 1000);

        return () => clearInterval(interval);
    }, [callStartTime]);

    // Error handling
    useEffect(() => {
        if (error) {
            toast.error(error.userMessage);
        }
    }, [error]);

    const handleToggleAudio = useCallback(async () => {
        if (!isJoined) return;
        try { await toggleAudio(); } catch (err: any) { toast.error('Failed to toggle audio'); }
    }, [toggleAudio, isJoined]);

    const handleToggleVideo = useCallback(async () => {
        if (!isJoined) return;
        try { await toggleVideo(); } catch (err: any) { toast.error('Failed to toggle video'); }
    }, [toggleVideo, isJoined]);

    const handleToggleScreenShare = useCallback(async () => {
        if (!isJoined) return;
        try { await toggleScreenShare(); } catch (err: any) { toast.error('Failed to toggle screen share'); }
    }, [toggleScreenShare, isJoined]);

    const handleMuteParticipant = useCallback(async (sessionId: string) => {
        if (!isUserAdmin(user)) return;
        try { await muteParticipant(sessionId); toast.success('Muted'); } catch (err) { toast.error('Error'); }
    }, [user, muteParticipant]);

    const handleRemoveParticipant = useCallback(async (sessionId: string) => {
        if (!isUserAdmin(user)) return;
        try { await removeParticipant(sessionId); toast.success('Removed'); } catch (err) { toast.error('Error'); }
    }, [user, removeParticipant]);

    const handleToggleRecord = useCallback(async () => {
        if (!isUserAdmin(user)) return;
        try {
            if (isRecording) {
                await stopRecording();
                toast.success('Recording stopped');
            } else {
                await startRecording();
                toast.success('Recording started');
            }
        } catch (err: any) {
            toast.error('Failed to toggle recording');
        }
    }, [user, isRecording, startRecording, stopRecording]);

    const handleToggleLock = useCallback(async () => {
        if (!isUserAdmin(user)) return;
        try {
            await setRoomLocked(!isLocked);
            setIsLocked(!isLocked);
            toast.success(isLocked ? 'Room unlocked' : 'Room locked. Guests must knock.');
        } catch (err: any) {
            toast.error('Failed to toggle lock');
        }
    }, [user, isLocked, setRoomLocked]);

    const handleEndMeetingForAll = useCallback(async () => {
        if (!isUserAdmin(user)) return;
        if (!confirm('End meeting for all?')) return;
        try {
            if (callId) {
                const result = await dailyService.endVideoCall(callId, 0, true);
                if (result.error) throw new Error(result.error);
            }
            finalizedRef.current = true;
            await leave();
            onLeave();
        } catch (err) { toast.error('Error ending meeting'); }
    }, [user, callId, leave, onLeave]);

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

<<<<<<< HEAD
    const handleLiveKitLeave = useCallback(() => {
        void finalizeMeetingDb();
    }, [finalizeMeetingDb]);

    const handleLiveKitFatalError = useCallback((message: string) => {
        setLiveKitError(message);
        toast.error('Secure video connection failed. Please retry.');
    }, []);

=======
>>>>>>> origin/main
    if (liveKitSession) {
        return (
            <LiveKitStage
                url={liveKitSession.url}
                token={liveKitSession.token}
                displayName={user.name || 'Guest'}
<<<<<<< HEAD
                callId={callId}
=======
>>>>>>> origin/main
                secondsElapsed={secondsElapsed}
                formatElapsed={formatTime}
                requestHardStop={false}
                onHardStopConsumed={() => undefined}
<<<<<<< HEAD
                onLeave={handleLiveKitLeave}
                onFatalError={handleLiveKitFatalError}
=======
                onLeave={() => void finalizeMeetingDb()}
                onFatalError={(message) => {
                    setLiveKitError(message);
                    toast.error('Secure video connection failed. Please retry.');
                }}
>>>>>>> origin/main
            />
        );
    }

    if (!isJoined) {
        if (!preJoinAccepted) {
            return (
                <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50 overflow-hidden p-4">
                    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl">
                        <h2 className="text-white text-2xl font-bold mb-2">Ready to join meeting</h2>
                        <p className="text-slate-400 text-sm mb-5">
<<<<<<< HEAD
                            Complete a quick device check, then join the full-screen meeting room. You can share your screen once connected.
=======
                            Complete a quick device check, then join. You can minimize and continue working in the dashboard.
>>>>>>> origin/main
                        </p>
                        {preJoinError && (
                            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                                {preJoinError}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => void handlePreflightCheck()}
                                disabled={isCheckingDevices}
                                className="px-4 py-2 rounded-xl border border-teal-500/30 text-teal-300 hover:bg-teal-500/10 transition-colors text-sm font-semibold disabled:opacity-60"
                            >
                                {isCheckingDevices ? 'Checking devices...' : 'Check camera and mic'}
                            </button>
                            <button
                                onClick={() => setPreJoinAccepted(true)}
                                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition-colors text-sm font-semibold"
                            >
                                Join now
                            </button>
                            <button
                                onClick={() => void handleLeave()}
                                className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors text-sm font-semibold"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
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

    if (isMinimized) {
        const primaryParticipant = remoteParticipants[0] || localParticipant || participants[0];
        return (
            <div className="fixed bottom-24 right-4 z-[120] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl overflow-hidden backdrop-blur-md">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-white/10">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Meeting in background
<<<<<<< HEAD
=======
                    </div>
                    <div className="flex items-center gap-1">
                        {onToggleMinimize && (
                            <button
                                onClick={onToggleMinimize}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                                title="Restore meeting"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button
                            onClick={() => void handleLeave()}
                            className="p-1.5 rounded-lg text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-colors"
                            title="Leave meeting"
                        >
                            <PhoneOff className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                <div className="h-[200px] bg-slate-900">
                    {primaryParticipant ? (
                        <CustomVideoTile
                            participant={primaryParticipant}
                            isLocal={primaryParticipant.isLocal}
                            isAdmin={isUserAdmin(user)}
                            variant="stage"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-sm text-slate-400">
                            Waiting for participants...
                        </div>
                    )}
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
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-white/90">
                            REC • {formatTime(secondsElapsed)}
                        </span>
>>>>>>> origin/main
                    </div>
                    <div className="flex items-center gap-1">
                        {onToggleMinimize && (
                            <button
                                onClick={onToggleMinimize}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                                title="Restore meeting"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button
                            onClick={() => void handleLeave()}
                            className="p-1.5 rounded-lg text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-colors"
                            title="Leave meeting"
                        >
                            <PhoneOff className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                <div className="h-[200px] bg-slate-900">
                    {primaryParticipant ? (
                        <CustomVideoTile
                            participant={primaryParticipant}
                            isLocal={primaryParticipant.isLocal}
                            isAdmin={isUserAdmin(user)}
                            variant="stage"
                        />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center text-sm text-slate-400">
                            Waiting for participants...
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-950 z-[1100] text-white flex flex-col overflow-hidden select-none pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            {/* Immersive Header */}
            <header className="absolute top-[env(safe-area-inset-top)] left-0 right-0 h-14 sm:h-16 bg-gradient-to-b from-black/70 to-transparent z-[110] px-3 sm:px-6 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-4 pointer-events-auto">
                    <div className="flex items-center gap-2 bg-slate-900/60 backdrop-blur-md border border-white/10 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-2xl">
                        <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse" />
                        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-white/90">
                            {formatTime(secondsElapsed)}
                        </span>
                    </div>
                    {!isMobile && (
                    <div className="flex items-end gap-0.5 h-3">
                        <div className="w-0.5 h-full bg-teal-500 rounded-full" />
                        <div className="w-0.5 h-4/5 bg-teal-500 rounded-full" />
                        <div className="w-0.5 h-3/5 bg-teal-500 rounded-full" />
                    </div>
                    )}
                </div>

<<<<<<< HEAD
                <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
                    <div className={`px-2 sm:px-3 py-1 rounded-xl border text-[10px] sm:text-xs font-bold uppercase tracking-wide ${
=======
                <div className="flex items-center gap-2 pointer-events-auto">
                    <div className={`px-3 py-1 rounded-xl border text-xs font-bold uppercase tracking-widest ${
>>>>>>> origin/main
                        networkQuality === 'good'
                            ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'
                            : networkQuality === 'poor'
                                ? 'bg-amber-500/10 border-amber-400/30 text-amber-300'
                                : 'bg-slate-500/10 border-white/10 text-slate-300'
                    }`}>
<<<<<<< HEAD
                        {networkQuality === 'good' ? <Wifi className="inline w-3 h-3" /> : <WifiOff className="inline w-3 h-3" />}
                        {!isMobile && (
                          <span className="ml-1">{networkQuality === 'good' ? 'Good' : networkQuality === 'poor' ? 'Poor' : '…'}</span>
                        )}
                    </div>
                    {(platformState === 'error' || networkQuality === 'poor') && !isMobile && (
=======
                        {networkQuality === 'good' ? <Wifi className="inline w-3 h-3 mr-1" /> : <WifiOff className="inline w-3 h-3 mr-1" />}
                        {networkQuality === 'good' ? 'Connection Good' : networkQuality === 'poor' ? 'Connection Poor' : 'Checking Network'}
                    </div>
                    {(platformState === 'error' || networkQuality === 'poor') && (
>>>>>>> origin/main
                        <button
                            onClick={() => void reconnect()}
                            className="px-3 py-1 rounded-xl border border-white/10 text-xs text-slate-200 hover:bg-white/10 transition-colors"
                            title="Reconnect"
                        >
                            <RefreshCw className="inline w-3 h-3 mr-1" />
                            Reconnect
                        </button>
                    )}
<<<<<<< HEAD
                    <div className={`flex bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/10 p-0.5 sm:p-1 ${isMobile ? 'hidden' : ''}`}>
=======
                    <div className="flex bg-slate-900/40 backdrop-blur-xl rounded-2xl border border-white/10 p-1">
>>>>>>> origin/main
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
            <main className={`flex-1 relative mt-12 sm:mt-14 mb-[calc(5.5rem+env(safe-area-inset-bottom))] overflow-hidden ${viewMode === 'grid' ? 'p-2 sm:p-6' : ''}`}>
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
                isRecording={isRecording}
                isLocked={isLocked}
                onToggleMic={handleToggleAudio}
                onToggleVideo={handleToggleVideo}
                onToggleScreenShare={handleToggleScreenShare}
                onToggleRecord={handleToggleRecord}
                onToggleLock={handleToggleLock}
                onLeave={handleLeave}
                onToggleParticipants={() => setShowParticipants(!showParticipants)}
                onToggleSettings={() => setShowDeviceSettings(true)}
                onEndForAll={isUserAdmin(user) ? handleEndMeetingForAll : undefined}
                isAdmin={isUserAdmin(user)}
                roomUrl={resolvedRoomUrl || ''}
                callId={callId}
            />

            <DeviceSettingsModal
                isOpen={showDeviceSettings}
                onClose={() => setShowDeviceSettings(false)}
                setAudioDevice={setAudioDevice}
                setVideoDevice={setVideoDevice}
            />
        </div>
    );
};

export default CustomVideoRoom;
