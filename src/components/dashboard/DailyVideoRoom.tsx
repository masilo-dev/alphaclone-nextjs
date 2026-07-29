import React, { useEffect, useRef, useState } from 'react';
import Daily, { DailyCall } from '@daily-co/daily-js';
import { dailyService } from '../../services/dailyService';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { AdminControls } from '../meeting/AdminControls';
import { HostControls } from '../meeting/HostControls';

interface DailyVideoRoomProps {
    user: User;
    roomUrl: string;
    callId?: string;
    onLeave: () => void;
    meetingAccessPin?: string;
    meetingAccessToken?: string;
    guestName?: string;
}

/**
 * Daily Prebuilt Video Room
 * Admin and host controls when applicable.
 */
const DailyVideoRoom: React.FC<DailyVideoRoomProps> = ({
    user,
    roomUrl,
    callId,
    onLeave,
    meetingAccessPin,
    meetingAccessToken,
    guestName,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const callObjectRef = useRef<DailyCall | null>(null);
    const callStartTimeRef = useRef<Date | null>(null);
    const onLeaveRef = useRef(onLeave);
    const handleCallEndRef = useRef<() => Promise<void>>(async () => undefined);
    const [isJoining, setIsJoining] = useState(true);
    const [participantCount, setParticipantCount] = useState(1);

    useEffect(() => {
        onLeaveRef.current = onLeave;
    }, [onLeave]);

    useEffect(() => {
        handleCallEndRef.current = async () => {
            const started = callStartTimeRef.current;
            const duration = started
                ? Math.floor((new Date().getTime() - started.getTime()) / 1000)
                : undefined;

            if (callId && duration) {
                await dailyService.endVideoCall(callId, duration).catch(err => {
                    console.error('Failed to end call in database:', err);
                });
            }

            onLeaveRef.current();
        };
    }, [callId]);

    useEffect(() => {
        let mounted = true;

        const initializeCall = async () => {
            if (!containerRef.current) return;

            try {
                // 1. Get Meeting Token if possible (for admin privileges)
                let token: string | undefined = undefined;
                // Extract room name from URL if not passed explicitly
                if (callId) {
                    const { token: fetchedToken } = await dailyService.getMeetingToken(callId, guestName || user.name || 'Guest', meetingAccessPin, meetingAccessToken);
                    if (fetchedToken) token = fetchedToken;
                }

                // 2. Create Daily call object with Branding
                const callObject = Daily.createFrame(containerRef.current, {
                    showLeaveButton: true,
                    showFullscreenButton: true,
                    iframeStyle: {
                        position: 'absolute',
                        top: '0',
                        left: '0',
                        width: '100%',
                        height: '100%',
                        border: '0',
                    },
                    theme: {
                        colors: {
                            accent: '#14b8a6', // Teal-500
                            accentText: '#ffffff',
                            background: '#020617', // Slate-950
                            backgroundAccent: '#0f172a', // Slate-900
                            baseText: '#f8fafc', // Slate-50
                            border: '#1e293b', // Slate-800
                            mainAreaBg: '#020617',
                            mainAreaBgAccent: '#0f172a',
                        }
                    }
                });

                callObjectRef.current = callObject;

                // Set up event listeners BEFORE joining
                callObject
                    .on('joined-meeting', (e) => {
                        // Force Grid View immediately
                        callObject.setActiveSpeakerMode(false);

                        if (mounted) {
                            setIsJoining(false);
                            callStartTimeRef.current = new Date();

                            if (callId) {
                                dailyService.startVideoCall(callId).catch(console.error);
                            }
                            // Update count
                            const participants = callObject.participants();
                            setParticipantCount(Object.keys(participants).length);
                            toast.success('Connected Securely.');
                        }
                    })
                    .on('participant-joined', () => {
                        if (mounted && callObject) {
                            setParticipantCount(Object.keys(callObject.participants()).length);
                        }
                    })
                    .on('participant-left', () => {
                        if (mounted && callObject) {
                            setParticipantCount(Object.keys(callObject.participants()).length);
                        }
                    })
                    .on('left-meeting', async () => {
                        if (mounted) {
                            await handleCallEndRef.current();
                        }
                    })
                    .on('error', (error) => {
                        console.error('Daily error:', error);
                        toast.error(`Connection Error: ${error?.errorMsg || 'Unknown error'}`);
                        if (mounted) {
                            setIsJoining(false);
                        }
                    });

                // 3. Join with Token
                // 3. Join with Token
                // Force video/audio ON
                await callObject.join({
                    url: roomUrl,
                    token,
                    userName: user.name,
                    startVideoOff: false,
                    startAudioOff: false
                });

                // (Error handled by try/catch)
            } catch (err) {
                console.error('Failed to initialize call:', err);
                toast.error('Failed to initialize video uplink');
                if (mounted) {
                    setIsJoining(false);
                    setTimeout(() => onLeaveRef.current(), 2000);
                }
            }
        };

        initializeCall();

        // Cleanup
        return () => {
            mounted = false;
            if (callObjectRef.current) {
                dailyService.leaveRoom(callObjectRef.current).catch(console.error);
                callObjectRef.current = null;
            }
        };
    }, [roomUrl, user.name, user.role, callId]);

    return (
        <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col">
            {/* Loading overlay */}
            {isJoining && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-500 mx-auto mb-6"></div>
                        <p className="text-white text-xl font-medium mb-2">Joining meeting...</p>
                        <p className="text-slate-400 text-sm">Please wait while we connect you</p>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Video Container */}
                <div className="flex-1 relative">
                    <div ref={containerRef} className="w-full h-full" />

                    {/* Waiting State Overlay */}
                    {!isJoining && participantCount === 1 && (
                        <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur px-4 py-2 rounded-lg border border-teal-500/30 flex items-center gap-2 animate-pulse">
                            <div className="w-2 h-2 bg-teal-500 rounded-full" />
                            <span className="text-sm font-medium text-teal-100">Waiting for others to join...</span>
                        </div>
                    )}

                </div>
            </div>

            {/* Admin/Host Controls */}
            {user.role === 'admin' && (
                <AdminControls
                    callObject={callObjectRef.current}
                    isAdmin={true}
                    onEndMeeting={() => void handleCallEndRef.current()}
<<<<<<< HEAD
                    callId={callId}
=======
>>>>>>> origin/main
                />
            )}

            {user.role === 'tenant_admin' && (
                <HostControls
                    callObject={callObjectRef.current}
                    isHost={true}
                    onEndMeeting={() => void handleCallEndRef.current()}
<<<<<<< HEAD
                    callId={callId}
=======
>>>>>>> origin/main
                />
            )}
        </div>
    );
};

export default DailyVideoRoom;
