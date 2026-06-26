'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import CustomVideoRoom from '@/components/dashboard/video/CustomVideoRoom';
import { loadMeetingForJoin } from '@/services/instantMeetingService';
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react';

const MicrosoftMeetingEmbed = dynamic(
    () => import('@/components/dashboard/video/MicrosoftMeetingEmbed'),
    { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div> }
);

export default function CallPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [teamsJoinUrl, setTeamsJoinUrl] = useState<string | null>(null);

    const callId = params?.roomId as string;

    useEffect(() => {
        if (authLoading) return;

        const fetchCallDetails = async () => {
            try {
                const { call, provider, joinUrl, error: fetchError } = await loadMeetingForJoin(callId);

                if (fetchError || !call) {
                    setError('Call not found or access denied.');
                    setLoading(false);
                    return;
                }

                if (!user && !call.is_public) {
                    router.push(`/login?redirect=/call/${callId}`);
                    return;
                }

                if (provider === 'teams') {
                    if (!joinUrl) {
                        setError('Teams join link missing. Start a new meeting from the dashboard.');
                        setLoading(false);
                        return;
                    }
                    setTeamsJoinUrl(joinUrl);
                }

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

    if (teamsJoinUrl) {
        return (
            <div className="h-screen w-screen bg-slate-950 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/80">
                    <p className="text-sm text-slate-300">Microsoft Teams · 40 minute session</p>
                    <a
                        href={teamsJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-blue-300 hover:text-blue-200"
                    >
                        Open in Teams app <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                </div>
                <div className="flex-1 min-h-0">
                    <MicrosoftMeetingEmbed
                        meetingLink={teamsJoinUrl}
                        displayName={user?.name || user?.email || 'Guest'}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-slate-950 overflow-hidden overscroll-none touch-none">
            {user && (
                <CustomVideoRoom
                    user={user}
                    callId={callId}
                    onLeave={() => router.push('/dashboard/business/teams')}
                />
            )}
        </div>
    );
}
