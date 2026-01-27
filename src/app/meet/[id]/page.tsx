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

    // This ID is the database UUID, NOT the Daily room name
    const meetingId = params.id as string;

    useEffect(() => {
        // Wait for auth to initialize (even if user is null, we need to know that for sure)
        if (authLoading) return;

        const connectToMeeting = async () => {
            try {
                // 1. Fetch meeting details from OUR database
                // This ensures we control access, status, and logic
                const { call, error: fetchError } = await dailyService.getVideoCall(meetingId);

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
                    router.push(`/login?redirect=/meet/${meetingId}`);
                    return;
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

            } catch (err) {
                console.error('Error connecting to meeting:', err);
                setError('Failed to connect to the secure meeting channel.');
                setLoading(false);
            }
        };

        connectToMeeting();
    }, [meetingId, authLoading, user, router]);

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

    return (
        <div className="h-screen w-screen bg-slate-950 overflow-hidden relative">
            {/* The URL bar will show /meet/[id], effectively masking the Daily URL */}
            {roomUrl && (
                <CustomVideoRoom
                    user={user || {
                        id: `guest-${Date.now()}`,
                        name: 'Guest',
                        email: '',
                        role: 'client',
                        avatar: ''
                    }} // Fallback guest user if public
                    roomUrl={roomUrl}
                    callId={callId!}
                    onLeave={() => router.push(user ? '/dashboard' : '/')}
                    showSidebar={false}
                />
            )}
        </div>
    );
}
