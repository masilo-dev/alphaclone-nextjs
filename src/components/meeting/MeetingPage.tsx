import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Daily, { DailyCall } from '@daily-co/daily-js';
import { meetingAdapterService } from '../../services/meetingAdapterService';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { Clock, AlertTriangle, Loader2, Video, LogOut } from 'lucide-react';

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

            // Step 3: Initialize Daily.co iframe
            if (!containerRef.current) {
                setError('Failed to initialize video container');
                return;
            }

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
                    zIndex: '40'
                }
            });

            callObjectRef.current = callObject;

            // Set up event listeners
            callObject
                .on('joined-meeting', () => {
                    setIsJoining(false);
                    setIsInMeeting(true);
                    startTimeRef.current = new Date();
                    toast.success('Joined meeting successfully!');

                    // Start 40-minute countdown
                    if (result.autoEndAt) {
                        startTimer(result.autoEndAt);
                    }
                })
                .on('left-meeting', async () => {
                    await handleLeave();
                })
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
        <div className="fixed inset-0 bg-gray-900">
            {/* 40-Minute Timer Overlay */}
            {isInMeeting && (
                <div className="absolute top-4 right-4 z-50 bg-black/80 backdrop-blur-md px-4 py-3 rounded-lg border border-white/10 shadow-2xl">
                    <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-slate-400" />
                        <div>
                            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Time Remaining</p>
                            <div className={`font-mono text-xl font-bold ${getTimerColor()} ${timeRemaining < 300 ? 'animate-pulse' : ''}`}>
                                {formatTime(timeRemaining)}
                            </div>
                        </div>
                    </div>
                    {timeRemaining < 300 && (
                        <p className="text-xs text-red-400 mt-2 animate-pulse">
                            Meeting ending soon!
                        </p>
                    )}
                </div>
            )}

            {/* AlphaClone Branding Overlay */}
            <div className="absolute top-4 left-4 z-50 bg-black/80 backdrop-blur-md px-4 py-3 rounded-lg border border-white/10 shadow-2xl">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-teal-500/20 rounded-lg">
                        <Video className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-sm">{meetingInfo?.title || 'Meeting'}</h2>
                        <p className="text-slate-400 text-xs">AlphaClone Systems</p>
                    </div>
                </div>
            </div>

            {/* Manual Leave Button */}
            <button
                onClick={handleLeave}
                className="absolute bottom-6 right-6 z-50 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 shadow-2xl"
                title="Leave Meeting"
            >
                <LogOut className="w-4 h-4" />
                Leave Meeting
            </button>

            {/* Daily.co iframe container - Embedded invisibly */}
            <div
                ref={containerRef}
                className="w-full h-full"
                style={{ zIndex: 40 }}
            />
        </div>
    );
};

export default MeetingPage;
