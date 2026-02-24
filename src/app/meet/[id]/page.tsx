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

    // This ID is the database UUID or the business slug
    const meetingIdOrSlug = params.id as string;

    // Use lazy state to generate a stable guest ID once
    const [guestId] = React.useState(() => `guest-${Date.now()}`);

    // Memoize the guest user object to ensure it's pure and doesn't change on every render
    const guestUser = React.useMemo(() => ({
        id: guestId,
        name: 'Guest',
        email: '',
        role: 'client' as const,
        avatar: ''
    }), [guestId]);

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
                        .select('admin_user_id')
                        .eq('slug', meetingIdOrSlug)
                        .is('deletion_pending_at', null)
                        .single();

                    if (tenantError || !tenant) {
                        setError('Business not found or is no longer active.');
                        setLoading(false);
                        return;
                    }

                    // Look up the permanent room for this admin user
                    const { data: permanentRooms, error: roomError } = await supabase
                        .from('video_calls')
                        .select('id')
                        .eq('host_id', tenant.admin_user_id)
                        .eq('is_permanent', true)
                        .eq('status', 'active');

                    if (roomError || !permanentRooms || permanentRooms.length === 0) {
                        setError('This business has not set up a permanent meeting room yet.');
                        setLoading(false);
                        return;
                    }

                    // Use the first active permanent room found
                    targetMeetingId = permanentRooms[0].id;
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
    }, [meetingIdOrSlug, authLoading, user, router]);

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
                    user={user || guestUser}
                    roomUrl={roomUrl}
                    callId={callId!}
                    onLeave={() => router.push(user ? '/dashboard' : '/')}
                    showSidebar={false}
                />
            )}
        </div>
    );
}
