'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import DailyVideoRoom from '@/components/dashboard/DailyVideoRoom';
import { dailyService } from '@/services/dailyService';
import { Loader2, AlertCircle } from 'lucide-react';

export default function CallPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [roomUrl, setRoomUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const callId = params.roomId as string;

    useEffect(() => {
        if (authLoading) return;

        const fetchCallDetails = async () => {
            try {
                // Check if it's a UUID (our DB ID) or a full URL
                // We assume it's our DB ID from the route /call/[id]
                const { call, error: fetchError } = await dailyService.getVideoCall(callId);

                if (fetchError || !call) {
                    setError('Call not found or access denied.');
                    setLoading(false);
                    return;
                }

                if (!user && !call.is_public) {
                    // Redirect to login ONLY if not logged in AND call is private
                    router.push(`/login?redirect=/call/${callId}`);
                    return;
                }

                // If user is the host (admin), we might need a special token?
                setRoomUrl(call.daily_room_url || null);
                setLoading(false);

            } catch (err) {
                console.error('Error fetching call:', err);
                setError('Failed to load call details.');
                setLoading(false);
            }
        };

        fetchCallDetails();
    }, [callId, user, authLoading, router]);

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
                <Loader2 className="w-12 h-12 text-teal-500 animate-spin mb-4" />
                <h2 className="text-xl font-medium">Connecting to Secure Channel...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
                <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl max-w-md text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold mb-2">Connection Failed</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
                    >
                        Return to Admin Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-slate-950 overflow-hidden">
            {roomUrl && (
                <DailyVideoRoom
                    user={user as any}
                    roomUrl={roomUrl}
                    callId={callId}
                    onLeave={() => router.push(user ? '/dashboard/business/meetings' : '/')}
                />
            )}
        </div>
    );
}
