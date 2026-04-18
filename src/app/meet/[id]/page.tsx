'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import CustomVideoRoom from '@/components/dashboard/video/CustomVideoRoom';
import { dailyService } from '@/services/dailyService';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function MeetPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [roomUrl, setRoomUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [callId, setCallId] = useState<string | null>(null);

    const [inputPin, setInputPin] = useState('');
    const [expectedPin, setExpectedPin] = useState<string | null>(null);
    const [isPinValidated, setIsPinValidated] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [pinError, setPinError] = useState('');
    const [validatedMeetingPin, setValidatedMeetingPin] = useState<string | undefined>(undefined);

    // This ID is the database UUID or the business slug
    const meetingIdOrSlug = params?.id as string;

    // Use lazy state to generate a stable guest ID once
    const [guestId] = React.useState(() => `guest-${Date.now()}`);

    // Memoize the guest user object to ensure it's pure and doesn't change on every render
    const guestUser = React.useMemo(() => ({
        id: guestId,
        name: guestName || 'Guest',
        email: guestEmail,
        role: 'client' as const,
        avatar: ''
    }), [guestId, guestName, guestEmail]);

    useEffect(() => {
        // Wait for auth to initialize (even if user is null, we need to know that for sure)
        if (authLoading) return;

        const connectToMeeting = async () => {
            try {
                // Utility to check if string is a valid UUID
                const isUUID = (str: string) => {
                    const regexExp = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/gi;
                    return regexExp.test(str);
                };

                let targetMeetingId = meetingIdOrSlug;

                // If it's not a UUID, treat it as a slug and look up the tenant
                if (!isUUID(meetingIdOrSlug)) {
                    // Try to resolve the tenant by slug
                    const { data: tenant, error: tenantError } = await supabase
                        .from('tenants')
                        .select('id, admin_user_id')
                        .eq('slug', meetingIdOrSlug)
                        .is('deletion_pending_at', null)
                        .single();

                    if (tenantError || !tenant) {
                        setError('Business not found or is no longer active.');
                        setLoading(false);
                        return;
                    }

                    // Look up the permanent room for this tenant
                    const { data: permanentRooms, error: roomError } = await supabase
                        .from('video_calls')
                        .select('id, metadata')
                        .eq('tenant_id', tenant.id)
                        .eq('is_permanent', true)
                        .eq('status', 'active');

                    if (roomError || !permanentRooms || permanentRooms.length === 0) {
                        setError('This business has not set up a permanent meeting room yet.');
                        setLoading(false);
                        return;
                    }

                    targetMeetingId = permanentRooms[0].id;
                    const metadata = permanentRooms[0].metadata;
                    if (metadata?.meeting_pin) {
                        setExpectedPin(metadata.meeting_pin);

                        // Check if PIN has expired (35 minutes after meeting start)
                        if (metadata.meeting_started_at) {
                            const timeSinceStart = Date.now() - metadata.meeting_started_at;
                            if (timeSinceStart > 35 * 60 * 1000) {
                                setError('The meeting code has expired. Please contact the host for a new link/code.');
                                setLoading(false);
                                return;
                            }
                        }
                    }
                } else {
                    const { data: room } = await supabase
                        .from('video_calls')
                        .select('metadata')
                        .eq('id', targetMeetingId)
                        .single();

                    const metadata = room?.metadata;
                    if (metadata && metadata.meeting_pin) {
                        setExpectedPin(metadata.meeting_pin);

                        // Check if PIN has expired (35 minutes after meeting start)
                        if (metadata.meeting_started_at) {
                            const timeSinceStart = Date.now() - metadata.meeting_started_at;
                            if (timeSinceStart > 35 * 60 * 1000) {
                                setError('The meeting code has expired. Please contact the host for a new link/code.');
                                setLoading(false);
                                return;
                            }
                        }
                    }
                }

                // 1. Fetch meeting details from OUR database
                // This ensures we control access, status, and logic
                const { call, error: fetchError } = await dailyService.getVideoCall(targetMeetingId);

                if (fetchError || !call) {
                    setError('Meeting not found. Please check the link and try again.');
                    setLoading(false);
                    return;
                }

                setCallId(call.id);

                // 2. SECURITY CHECK: Is the meeting active or scheduled?
                if (call.status === 'ended' || call.status === 'cancelled') {
                    setError('This meeting has ended.');
                    setLoading(false);
                    return;
                }

                // 3. AUTH CHECK: Is it public or does the user have access?
                if (!call.is_public && !user) {
                    // Redirect to login, then back here
                    router.push(`/login?redirect=/meet/${meetingIdOrSlug}`);
                    return;
                }

                // If the user logging in is the host/tenant owner, skip the PIN check
                if (user && call.host_id === user.id) {
                    setIsPinValidated(true);
                }

                // 4. Token & URL Generation
                // Ideally, we generate a token for the user to join securely.
                // For now, we will use the roomUrl.
                // TODO: Enhance with token generation for stricter access control if needed.

                if (!call.daily_room_url) {
                    setError('Meeting room configuration error.');
                    setLoading(false);
                    return;
                }

                setRoomUrl(call.daily_room_url);
                setLoading(false);

                // For permanent public rooms with no PIN, we can potentially auto-join if name is already known
                // or just ensure the UI is extremely minimal.
                if (call.is_permanent && call.is_public && !expectedPin && guestName) {
                    setIsPinValidated(true);
                }

            } catch (err) {
                console.error('Error connecting to meeting:', err);
                setError('Failed to connect to the secure meeting channel.');
                setLoading(false);
            }
        };

        connectToMeeting();
    }, [meetingIdOrSlug, authLoading, user, router]);

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPinError('');

        if (!guestName.trim()) {
            setPinError('Please enter your name.');
            return;
        }

        if (expectedPin && inputPin !== expectedPin) {
            setPinError('Incorrect meeting code. Please try again.');
            return;
        }

        if (expectedPin) {
            setValidatedMeetingPin(inputPin.trim());
        } else {
            setValidatedMeetingPin(undefined);
        }
        setIsPinValidated(true);
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
                <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-teal-500/20 blur-xl rounded-full"></div>
                        <Loader2 className="w-16 h-16 text-teal-500 animate-spin relative z-10" />
                    </div>
                    <h2 className="text-xl font-medium tracking-wide">Securing Connection...</h2>
                    <p className="text-slate-500 text-sm flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Verifying meeting status
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md text-center shadow-2xl">
                    <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>

                    <h2 className="text-2xl font-bold mb-2">Unable to Join</h2>
                    <p className="text-slate-400 mb-8 leading-relaxed">{error}</p>

                    <button
                        onClick={() => router.push(user ? '/dashboard' : '/')}
                        className="w-full py-3 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700 font-medium"
                    >
                        Return to Homepage
                    </button>
                </div>
            </div>
        );
    }

    // Require PIN validation if expectedPin exists and hasn't been validated yet
    if (expectedPin && !isPinValidated) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
                <form onSubmit={handlePinSubmit} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-teal-500/20">
                            <ShieldCheck className="w-8 h-8 text-teal-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {meetingIdOrSlug.length < 20 ? `${meetingIdOrSlug}'s Office` : 'Join Secure Meeting'}
                        </h2>
                        <p className="text-slate-400 text-sm">
                            {expectedPin ? 'Please enter the meeting code provided by the host.' : 'Welcome! Please enter your name to join the meeting.'}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">Your Name</label>
                            <input
                                type="text"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                                placeholder="What should we call you?"
                                required
                            />
                        </div>

                        {expectedPin && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Meeting Code</label>
                                <input
                                    type="text"
                                    value={inputPin}
                                    onChange={(e) => setInputPin(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white font-mono text-center tracking-widest text-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                                    placeholder="------"
                                    maxLength={6}
                                    required
                                />
                            </div>
                        )}

                        {pinError && (
                            <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                {pinError}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full mt-6 py-3 px-6 bg-teal-600 hover:bg-teal-500 text-white rounded-xl transition-all font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                        >
                            Join Meeting
                        </button>
                    </div>
                </form>
            </div>
        );
    }


    return (
        <div className="h-screen w-screen bg-slate-950 overflow-hidden relative">
            {/* The URL bar will show /meet/[id], effectively masking the Daily URL */}
            {roomUrl && (
                <CustomVideoRoom
                    user={user || guestUser}
                    roomUrl={roomUrl}
                    callId={callId!}
                    meetingAccessPin={validatedMeetingPin}
                    onLeave={() => router.push(user ? '/dashboard' : '/')}
                    showSidebar={false}
                />
            )}
        </div>
    );
}
