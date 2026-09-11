'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import CustomVideoRoom from '@/components/dashboard/video/CustomVideoRoom';
import DailyVideoRoom from '@/components/dashboard/DailyVideoRoom';
import MicrosoftMeetingEmbed from '@/components/dashboard/video/MicrosoftMeetingEmbed';
import { useMeetingSession } from '@/hooks/useMeetingSession';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

export default function MeetPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { currentTenant } = useTenant();
    const meetingScopeKey = `${user?.id || 'guest'}:${currentTenant?.id || 'no-tenant'}`;
    const { endMeeting } = useMeetingSession(meetingScopeKey);
    const [roomUrl, setRoomUrl] = useState<string | null>(null);
    const [meetingProvider, setMeetingProvider] = useState<'livekit' | 'daily' | 'teams' | 'jitsi'>('livekit');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [callId, setCallId] = useState<string | null>(null);

    const [inputPin, setInputPin] = useState('');
    const [requiresPin, setRequiresPin] = useState(false);
    const [isPinValidated, setIsPinValidated] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [guestIdentityConfirmed, setGuestIdentityConfirmed] = useState(false);
    const [pinError, setPinError] = useState('');
    const [validatedMeetingPin, setValidatedMeetingPin] = useState<string | undefined>(undefined);
    const [meetingAccessToken, setMeetingAccessToken] = useState<string | undefined>(undefined);

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
        if (authLoading || !meetingIdOrSlug) return;
        let cancelled = false;
        (async () => {
            try {
                const response = await fetch(`/api/meetings/resolve/${encodeURIComponent(meetingIdOrSlug)}`, { cache: 'no-store' });
                const payload = await response.json();
                if (response.status === 401) {
                    router.push(`/login?redirect=/meet/${encodeURIComponent(meetingIdOrSlug)}`);
                    return;
                }
                if (!response.ok) throw new Error(payload.error || 'Meeting not found');
                if (cancelled) return;
                const meeting = payload.meeting;
                if (!meeting.isPublic && !user) { router.push(`/login?redirect=/meet/${encodeURIComponent(meetingIdOrSlug)}`); return; }
                if (meeting.pinExpired && !user) throw new Error('The meeting code has expired. Please contact the host for a new code.');
                if (meeting.provider !== 'livekit' && !meeting.joinUrl) throw new Error('Meeting provider configuration is incomplete.');
                setCallId(meeting.callId);
                setRequiresPin(Boolean(meeting.requiresPin));
                setMeetingProvider(meeting.provider);
                setRoomUrl(meeting.joinUrl);
                setMeetingAccessToken(meeting.resolvedByAccessToken ? meetingIdOrSlug : undefined);
                if (!meeting.requiresPin) setIsPinValidated(true);
                setLoading(false);
            } catch (reason) {
                if (!cancelled) { setError(reason instanceof Error ? reason.message : 'Failed to connect to the secure meeting channel.'); setLoading(false); }
            }
        })();
        return () => { cancelled = true; };
    }, [meetingIdOrSlug, authLoading, user, router]);

    const handlePinSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPinError('');

        if (!user && !guestName.trim()) {
            setPinError('Please enter your name.');
            return;
        }

        if (requiresPin) {
            if (!/^\d{6}$/.test(inputPin.trim())) { setPinError('Enter the six-digit meeting code.'); return; }
            setValidatedMeetingPin(inputPin.trim());
        } else {
            setValidatedMeetingPin(undefined);
        }
        setIsPinValidated(true);
        setGuestIdentityConfirmed(true);
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
    if ((!user && !guestIdentityConfirmed) || (requiresPin && !isPinValidated)) {
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
                            {requiresPin ? 'Enter your name and the meeting code provided by the host.' : 'Enter your name before joining the secure meeting.'}
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

                        {requiresPin && (
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
            {callId && meetingProvider === 'livekit' && (
                <CustomVideoRoom
                    user={user || guestUser}
                    callId={callId!}
                    meetingAccessPin={validatedMeetingPin}
                    guestName={guestName}
                    meetingAccessToken={meetingAccessToken}
                    onLeave={() => {
                        endMeeting();
                        router.push(user ? '/dashboard' : '/');
                    }}
                />
            )}
            {roomUrl && meetingProvider === 'daily' && (
                <DailyVideoRoom user={user || guestUser} roomUrl={roomUrl} callId={callId!} meetingAccessPin={validatedMeetingPin} meetingAccessToken={meetingAccessToken} guestName={guestName} onLeave={() => { endMeeting(); router.push(user ? '/dashboard' : '/'); }} />
            )}
            {roomUrl && meetingProvider === 'teams' && (
                <MicrosoftMeetingEmbed
                    meetingLink={roomUrl}
                    displayName={(user?.name || guestName || 'Guest').trim()}
                />
            )}
            {roomUrl && meetingProvider === 'jitsi' && (
                <iframe
                    src={roomUrl}
                    title="Jitsi Meeting"
                    className="h-full w-full border-0"
                    allow="camera; microphone; fullscreen; display-capture"
                />
            )}
        </div>
    );
}
