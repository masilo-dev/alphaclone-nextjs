import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Daily, { DailyCall } from '@daily-co/daily-js';
import { meetingAdapterService } from '../../services/meetingAdapterService';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { VideoLayout } from './VideoLayout';
import { VideoControls } from './VideoControls';
import { MeetingChat } from './MeetingChat';

interface MeetingPageProps {
    user: User;
}

/**
 * Meeting Page - /meet/:token
 *
 * Handles the complete meeting experience:
 * - Token validation
 * - Single-use link enforcement
 * - Daily.co iframe embedding (hidden from user)
 * - 40-minute countdown timer
 * - Auto-end on time limit
 * - AlphaClone branding
 */
const MeetingPage: React.FC<MeetingPageProps> = ({ user }) => {
    const router = useRouter();
    const params = useParams();
    const token = params?.token as string;

    // State
    const [isValidating, setIsValidating] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [meetingInfo, setMeetingInfo] = useState<any>(null);
    const [meetingId, setMeetingId] = useState<string | null>(null);
    const [timeRemaining, setTimeRemaining] = useState<number>(40 * 60); // 40 minutes in seconds
    const [isInMeeting, setIsInMeeting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // State for local media
    const [muted, setMuted] = useState(false);
    const [cameraOff, setCameraOff] = useState(false);
    const [screenShareOn, setScreenShareOn] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [participantsOpen, setParticipantsOpen] = useState(false);

    // Refs
    const callObjectRef = useRef<DailyCall | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<Date | null>(null);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!token) {
            toast.error('Invalid meeting link');
            router.push('/dashboard');
            return;
        }

        validateAndJoin();

        // Cleanup on unmount
        return () => {
            cleanup();
        };
    }, [token]);

    const validateAndJoin = async () => {
        try {
            // Step 1: Validate token
            setIsValidating(true);
            const { validation, error: validateError } = await meetingAdapterService.validateMeetingLink(token!);

            if (validateError || !validation) {
                setError(validateError || 'Failed to validate meeting link');
                toast.error(validateError || 'Failed to validate meeting link');
                setTimeout(() => router.push('/dashboard'), 3000);
                return;
            }

            if (!validation.valid) {
                const friendlyMessages: Record<string, string> = {
                    expired: 'This meeting link has expired',
                    used: 'This meeting link has already been used',
                    not_found: 'Meeting not found',
                    unknown: 'Invalid meeting link'
                };

                const message = friendlyMessages[validation.reason || 'unknown'];
                setError(message);
                toast.error(message);
                setTimeout(() => router.push('/dashboard'), 3000);
                return;
            }

            setMeetingInfo(validation.meeting);
            setIsValidating(false);

            // Step 2: Join meeting (marks link as used, gets Daily URL)
            setIsJoining(true);
            const { result, error: joinError } = await meetingAdapterService.joinMeeting(
                token!,
                user.id,
                user.name
            );

            if (joinError || !result || !result.success) {
                setError(result?.error || joinError || 'Failed to join meeting');
                toast.error(result?.error || joinError || 'Failed to join meeting');
                setTimeout(() => router.push('/dashboard'), 3000);
                return;
            }

            setMeetingId(result.meetingId!);

            // Step 3: Initialize Daily.co (Custom Object Mode)
            // Note: We use createCallObject instead of createFrame for custom UI
            const callObject = Daily.createCallObject({
                url: result.dailyUrl!,
                // We don't pass containerRef because we aren't using iframe
            });

            callObjectRef.current = callObject;

            // Set up event listeners
            callObject
                .on('joined-meeting', (e) => {
                    setIsJoining(false);
                    setIsInMeeting(true);
                    startTimeRef.current = new Date();
                    toast.success('Joined meeting successfully!');
                    updateParticipants();

                    // Start 40-minute countdown
                    if (result.autoEndAt) {
                        startTimer(result.autoEndAt);
                    }
                })
                .on('left-meeting', async () => {
                    await handleLeave();
                })
                .on('participant-joined', updateParticipants)
                .on('participant-updated', updateParticipants)
                .on('participant-left', updateParticipants)
                .on('track-started', updateParticipants)
                .on('track-stopped', updateParticipants)
                .on('error', (error) => {
                    console.error('Daily error:', error);
                    toast.error(`Call error: ${error?.errorMsg || 'Unknown error'}`);
                    setIsJoining(false);
                });

            // Step 4: Join the Daily room
            await callObject.join({
                url: result.dailyUrl!,
                token: result.dailyToken,
                userName: user.name
            });

            // Step 5: Subscribe to meeting status changes (for admin force-end)
            if (result.meetingId) {
                const unsubscribe = meetingAdapterService.subscribeMeetingStatus(
                    result.meetingId,
                    (status, reason) => {
                        if (status === 'ended') {
                            const reasonMessages: Record<string, string> = {
                                manual: 'Meeting ended by host',
                                time_limit: 'Meeting time limit reached (40 minutes)',
                                all_left: 'All participants have left'
                            };

                            const message = reasonMessages[reason || 'manual'] || 'Meeting ended';
                            toast.error(message);
                            handleLeave();
                        }
                    }
                );

                unsubscribeRef.current = unsubscribe;
            }

        } catch (err) {
            console.error('Error in validateAndJoin:', err);
            setError(err instanceof Error ? err.message : 'Failed to join meeting');
            toast.error('Failed to join meeting');
            router.push('/dashboard');
        }
    };

    // Helper to sync Daily participants to React state
    const [participants, setParticipants] = useState<Record<string, any>>({});
    const [localParticipant, setLocalParticipant] = useState<any>(null);

    const updateParticipants = () => {
        if (!callObjectRef.current) return;

        const p = callObjectRef.current.participants();
        setLocalParticipant(p.local);

        const remote: Record<string, any> = {};
        Object.keys(p).forEach(id => {
            if (id !== 'local') remote[id] = p[id];
        });
        setParticipants(remote);
    };

    const startTimer = (autoEndAt: string) => {
        const endTime = new Date(autoEndAt).getTime();

        timerIntervalRef.current = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
            setTimeRemaining(remaining);

            if (remaining === 0) {
                handleAutoEnd();
            }
        }, 1000);
    };

    const handleAutoEnd = async () => {
        toast.error('Meeting time limit reached (40 minutes)');

        // Calculate duration
        const durationSeconds = startTimeRef.current
            ? Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000)
            : undefined;

        // End meeting in database
        if (meetingId) {
            await meetingAdapterService.endMeeting(
                meetingId,
                user.id,
                'time_limit',
                durationSeconds
            );
        }

        // Leave Daily room
        await handleLeave();
    };

    const handleLeave = async () => {
        try {
            // Stop timer
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }

            // Leave Daily room
            if (callObjectRef.current) {
                await callObjectRef.current.leave();
                await callObjectRef.current.destroy();
                callObjectRef.current = null;
            }

            // Calculate duration
            const durationSeconds = startTimeRef.current
                ? Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000)
                : undefined;

            // End meeting in database if still active
            if (meetingId && isInMeeting) {
                await meetingAdapterService.endMeeting(
                    meetingId,
                    user.id,
                    'manual',
                    durationSeconds
                );
            }

            // Navigate back to dashboard
            router.push('/dashboard/conference');
        } catch (err) {
            console.error('Error leaving meeting:', err);
            router.push('/dashboard/conference');
        }
    };

    const cleanup = () => {
        // Stop timer
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }

        // Unsubscribe from status changes
        if (unsubscribeRef.current) {
            unsubscribeRef.current();
        }

        // Leave Daily room
        if (callObjectRef.current) {
            callObjectRef.current.leave().catch(console.error);
            callObjectRef.current.destroy().catch(console.error);
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimerColor = (): string => {
        if (timeRemaining < 300) return 'text-red-400'; // < 5 minutes
        if (timeRemaining < 600) return 'text-orange-400'; // < 10 minutes
        return 'text-white';
    };

    // Initial media state sync
    useEffect(() => {
        if (localParticipant) {
            setMuted(!localParticipant.audio);
            setCameraOff(!localParticipant.video);
        }
    }, [localParticipant]);

    // Error state
    if (error) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-slate-900 to-black flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <div className="mb-6 flex justify-center">
                        <div className="p-4 bg-red-500/10 rounded-full">
                            <AlertTriangle className="w-16 h-16 text-red-500" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">Unable to Join Meeting</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Loading/Validating state
    if (isValidating || isJoining) {
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-slate-900 to-black flex items-center justify-center">
                <div className="text-center max-w-md px-6">
                    <div className="mb-6 flex justify-center">
                        <Loader2 className="w-16 h-16 text-teal-500 animate-spin" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-4">
                        {isValidating ? 'Validating meeting link...' : 'Joining meeting...'}
                    </h2>
                    <p className="text-slate-400">
                        {isValidating
                            ? 'Please wait while we verify your access'
                            : 'Connecting you to the video room'}
                    </p>
                    {meetingInfo && (
                        <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
                            <p className="text-sm text-slate-400 mb-1">Meeting</p>
                            <p className="text-white font-medium">{meetingInfo.title}</p>
                            {meetingInfo.hostName && (
                                <>
                                    <p className="text-sm text-slate-400 mt-2 mb-1">Host</p>
                                    <p className="text-white">{meetingInfo.hostName}</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Meeting in progress

    return (
        <div className="fixed inset-0 bg-gray-900 flex flex-col">
            {/* 40-Minute Timer Overlay */}
            {isInMeeting && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-lg flex items-center gap-3">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <div className={`font-mono text-sm font-bold ${getTimerColor()} ${timeRemaining < 300 ? 'animate-pulse' : ''}`}>
                        {formatTime(timeRemaining)}
                    </div>
                </div>
            )}

            {/* Video Layout Area */}
            <div className="flex-1 relative flex">
                <VideoLayout
                    callObject={callObjectRef.current}
                    participants={participants}
                    localParticipant={localParticipant}
                />

                {/* Chat Sidepanel */}
                {chatOpen && (
                    <div className="w-80 bg-slate-900 border-l border-slate-800 z-40 hidden md:block">
                        <MeetingChat
                            callObject={callObjectRef.current}
                            currentUser={{ id: user.id, name: user.name }}
                            callId={meetingId || undefined}
                        />
                    </div>
                )}
            </div>

            {/* Bottom Controls */}
            {isInMeeting && (
                <VideoControls
                    callObject={callObjectRef.current}
                    muted={muted}
                    cameraOff={cameraOff}
                    screenShareOn={screenShareOn}
                    chatOpen={chatOpen}
                    participantsOpen={participantsOpen}
                    onToggleMute={() => {
                        const newState = !muted;
                        setMuted(newState);
                        callObjectRef.current?.setLocalAudio(!newState);
                    }}
                    onToggleCamera={() => {
                        const newState = !cameraOff;
                        setCameraOff(newState);
                        callObjectRef.current?.setLocalVideo(!newState);
                    }}
                    onToggleScreenShare={async () => {
                        try {
                            if (screenShareOn) {
                                await callObjectRef.current?.stopScreenShare();
                                setScreenShareOn(false);
                            } else {
                                // Mobile browsers may throw errors here if not supported
                                await callObjectRef.current?.startScreenShare();
                                setScreenShareOn(true);
                            }
                        } catch (err: any) {
                            console.error('Screen share error:', err);
                            toast.error('Screen sharing failed. It may not be supported on this browser.');
                            setScreenShareOn(false);
                        }
                    }}
                    onToggleChat={() => setChatOpen(!chatOpen)}
                    onToggleParticipants={() => setParticipantsOpen(!participantsOpen)}
                    onLeave={handleLeave}
                />
            )}

            {/* Mobile Chat Drawer (if needed, or simple toggle) */}
            {chatOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 md:hidden">
                    <div className="absolute right-0 top-0 bottom-20 w-80 bg-slate-900">
                        <MeetingChat
                            callObject={callObjectRef.current}
                            currentUser={{ id: user.id, name: user.name }}
                            callId={meetingId || undefined}
                        />
                        <button
                            onClick={() => setChatOpen(false)}
                            className="absolute top-2 right-2 text-slate-400 p-2"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MeetingPage;
