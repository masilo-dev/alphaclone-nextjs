import React, { useEffect, useRef, useState } from 'react';
import Daily, { DailyCall } from '@daily-co/daily-js';
import { dailyService } from '../../services/dailyService';
import { User } from '../../types';
import toast from 'react-hot-toast';

interface DailyVideoRoomProps {
    user: User;
    roomUrl: string;
    callId?: string;
    onLeave: () => void;
}

/**
 * Daily Prebuilt Video Room
 * Uses Daily.co's built-in UI with all controls included
 * NO custom UI overlay - pure Daily experience
 */
const DailyVideoRoom: React.FC<DailyVideoRoomProps> = ({
    user,
    roomUrl,
    callId,
    onLeave
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const callObjectRef = useRef<DailyCall | null>(null);
    const [isJoining, setIsJoining] = useState(true);
    const [callStartTime, setCallStartTime] = useState<Date | null>(null);

    useEffect(() => {
        let mounted = true;

        const initializeCall = async () => {
            if (!containerRef.current) return;

            try {
                // 1. Get Meeting Token if possible (for admin privileges)
                let token: string | undefined = undefined;
                // Extract room name from URL if not passed explicitly
                const roomName = roomUrl.split('/').pop();

                if (roomName) {
                    const { token: fetchedToken } = await dailyService.getMeetingToken(roomName, user.name, user.role === 'admin' || user.role === 'tenant_admin');
                    if (fetchedToken) token = fetchedToken;
                }

                // 2. Create Daily call object with Branding
                const callObject = Daily.createFrame(containerRef.current, {
                    showLeaveButton: true,
                    showFullscreenButton: true,
                    iframeStyle: {
                        position: 'fixed',
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

                // Set up event listeners
                callObject
                    .on('joined-meeting', () => {
                        if (mounted) {
                            setIsJoining(false);
                            setCallStartTime(new Date());

                            if (callId) {
                                dailyService.startVideoCall(callId).catch(console.error);
                            }

                            toast.success('Connected Securely.');
                        }
                    })
                    .on('left-meeting', async () => {
                        if (mounted) {
                            await handleCallEnd();
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
                const { error } = await dailyService.joinRoom(
                    callObject,
                    roomUrl,
                    user.name,
                    token
                );

                if (error) {
                    toast.error(`Failed to join: ${error}`);
                    if (mounted) {
                        setIsJoining(false);
                        setTimeout(onLeave, 2000);
                    }
                }
            } catch (err) {
                console.error('Failed to initialize call:', err);
                toast.error('Failed to initialize video uplink');
                if (mounted) {
                    setIsJoining(false);
                    setTimeout(onLeave, 2000);
                }
            }
        };

        const handleCallEnd = async () => {
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

            onLeave();
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
    }, [roomUrl, user.name, user.role, callId, callStartTime, onLeave]);

    return (
        <div className="fixed inset-0 z-50 bg-gray-900">
            {/* Loading overlay */}
            {isJoining && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-500 mx-auto mb-6"></div>
                        <p className="text-white text-xl font-medium mb-2">Joining meeting...</p>
                        <p className="text-slate-400 text-sm">Please wait while we connect you</p>
                    </div>
                </div>
            )}

            {/* Daily Prebuilt iframe container - NO custom controls */}
            <div
                ref={containerRef}
                className="w-full h-full"
            />
        </div>
    );
};

export default DailyVideoRoom;
