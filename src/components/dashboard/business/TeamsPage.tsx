'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTenant } from '@/contexts/TenantContext';
import { microsoft365Service } from '@/services/microsoft365Service';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import { tenantService } from '@/services/tenancy/TenantService';
import {
    createInstantMeeting,
    loadMeetingForJoin,
    type PlatformMeetingProvider,
} from '@/services/instantMeetingService';
import MeetingProviderBadge from '@/components/dashboard/common/MeetingProviderBadge';
import { supabase } from '@/lib/supabase';
import {
    Video,
    Loader2,
    Search,
    Settings,
    Calendar,
    PhoneCall,
    Plus,
    Copy,
    Clock,
    Users,
    Wifi,
    ExternalLink,
    X,
} from 'lucide-react';
import { Button, Badge } from '@/components/ui/UIComponents';
import toast from 'react-hot-toast';

// Lazy-load the heavy video room so it doesn't block the page
const CustomVideoRoom = dynamic(
    () => import('@/components/dashboard/video/CustomVideoRoom'),
    { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-teal-400" /></div> }
);

const MicrosoftMeetingEmbed = dynamic(
    () => import('@/components/dashboard/video/MicrosoftMeetingEmbed'),
    { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div> }
);

interface TeamsPageProps {
    user: any;
    setActiveTab: (tab: string) => void;
}

interface MeetingRow {
    id: string;
    title: string;
    status: string;
    created_at: string;
    host_id: string;
    daily_room_url: string | null;
    metadata?: Record<string, unknown> | null;
}

export default function TeamsPage({ user, setActiveTab }: TeamsPageProps) {
    const { currentTenant } = useTenant();

    // Connection state
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});
    const [loadingPresence, setLoadingPresence] = useState(false);

    // Presence checker
    const [searchEmail, setSearchEmail] = useState('');
    const [checkedPresence, setCheckedPresence] = useState<{ email: string; status: string } | null>(null);
    const [checkingEmail, setCheckingEmail] = useState(false);

    // Meetings
    const [meetings, setMeetings] = useState<MeetingRow[]>([]);
    const [loadingMeetings, setLoadingMeetings] = useState(false);
    const [starting, setStarting] = useState(false);

    // Active call inside the page
    const [activeCallId, setActiveCallId] = useState<string | null>(null);
    const [activeProvider, setActiveProvider] = useState<PlatformMeetingProvider | null>(null);
    const [activeJoinUrl, setActiveJoinUrl] = useState<string | null>(null);

    // ── Load everything ──────────────────────────────────────────────────────
    useEffect(() => {
        if (currentTenant?.id) {
            void loadAll();
        }

        const params = new URLSearchParams(window.location.search);
        const oauthStatus = params.get('microsoft');
        if (oauthStatus === 'connected') toast.success('Microsoft 365 connected');
        else if (oauthStatus === 'error') toast.error(params.get('reason') || 'Microsoft connection failed');
        params.delete('microsoft'); params.delete('reason');
        const next = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${next ? `?${next}` : ''}`);
    }, [currentTenant?.id]);

    const loadAll = useCallback(async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        try {
            const connected = await microsoftAuthService.isConnected();
            setIsConnected(connected);

            const members = await tenantService.getTenantUsers(currentTenant.id);
            setTeamMembers(members || []);

            if (connected && members?.length) {
                setLoadingPresence(true);
                const map: Record<string, string> = {};
                await Promise.all(members.map(async (m: any) => {
                    const email = m.profiles?.email;
                    if (email) {
                        const { status } = await microsoft365Service.fetchTeamsPresence(currentTenant.id, email);
                        map[email] = status;
                    }
                }));
                setPresenceMap(map);
                setLoadingPresence(false);
            }
        } catch {
            toast.error('Failed to load Teams status.');
        } finally {
            setLoading(false);
        }

        // Load meetings
        setLoadingMeetings(true);
        const { data } = await supabase
            .from('video_calls')
            .select('id, title, status, created_at, host_id, daily_room_url, metadata')
            .eq('tenant_id', currentTenant.id)
            .in('status', ['scheduled', 'active'])
            .order('created_at', { ascending: false })
            .limit(20);
        setMeetings((data as MeetingRow[]) || []);
        setLoadingMeetings(false);
    }, [currentTenant?.id]);

    // ── Start an instant meeting ─────────────────────────────────────────────
    const startInstantMeeting = async () => {
        setStarting(true);
        const toastId = toast.loading(isConnected ? 'Creating Microsoft Teams meeting…' : 'Creating secure meeting room…');
        try {
            const { call, provider, error } = await createInstantMeeting({
                hostId: user.id,
                tenantId: currentTenant?.id,
                title: `Teams Meeting · ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
            });
            if (error || !call) {
                toast.error(error === 'LIMIT_EXCEEDED_TEASER' ? 'Meeting limit reached. Upgrade to host more.' : (error || 'Could not create meeting'), { id: toastId });
                return;
            }
            toast.success(provider === 'teams' ? 'Teams meeting ready — joining now…' : 'Room ready — joining now…', { id: toastId });
            setActiveCallId(call.id);
            setActiveProvider(provider);
            setActiveJoinUrl(provider === 'teams' ? call.daily_room_url || null : null);
            await loadAll();
        } finally {
            setStarting(false);
        }
    };

    const joinMeeting = async (callId: string) => {
        const toastId = toast.loading('Opening meeting…');
        const { call, provider, joinUrl, error } = await loadMeetingForJoin(callId);
        if (error || !call) {
            toast.error(error || 'Could not open meeting', { id: toastId });
            return;
        }
        if (provider === 'teams' && !joinUrl) {
            toast.error('Teams join link missing. Start a new meeting or reconnect Microsoft 365.', { id: toastId });
            return;
        }
        toast.dismiss(toastId);
        setActiveCallId(call.id);
        setActiveProvider(provider);
        setActiveJoinUrl(joinUrl);
    };

    const leaveActiveMeeting = () => {
        setActiveCallId(null);
        setActiveProvider(null);
        setActiveJoinUrl(null);
        void loadAll();
    };

    // ── Copy invite link ─────────────────────────────────────────────────────
    const copyMeetingLink = (callId: string) => {
        const link = `${window.location.origin}/meet/${callId}`;
        navigator.clipboard.writeText(link);
        toast.success('Meeting link copied');
    };

    // ── Presence check ────────────────────────────────────────────────────────
    const handlePresenceCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant?.id || !searchEmail.trim()) return;
        setCheckingEmail(true);
        setCheckedPresence(null);
        try {
            const { status, error } = await microsoft365Service.fetchTeamsPresence(currentTenant.id, searchEmail.trim());
            if (error) throw new Error(error);
            setCheckedPresence({ email: searchEmail.trim(), status });
        } catch (err: any) {
            toast.error(err.message || 'Failed to check presence');
        } finally {
            setCheckingEmail(false);
        }
    };

    const getStatusColor = (s: string) => {
        switch (s?.toLowerCase()) {
            case 'online':  return { dot: 'bg-emerald-500', text: 'text-emerald-400' };
            case 'away':    return { dot: 'bg-amber-500',   text: 'text-amber-400'   };
            case 'busy':    return { dot: 'bg-rose-500',    text: 'text-rose-400'    };
            default:        return { dot: 'bg-slate-500',   text: 'text-slate-400'   };
        }
    };

    // ── Active video room overlay ─────────────────────────────────────────────
    if (activeCallId) {
        return (
            <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        {activeProvider === 'teams' ? 'Microsoft Teams meeting' : 'Meeting in progress'}
                    </div>
                    <button
                        onClick={leaveActiveMeeting}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Leave meeting and return to dashboard"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 relative">
                    {activeProvider === 'teams' && activeJoinUrl ? (
                        <MicrosoftMeetingEmbed
                            meetingLink={activeJoinUrl}
                            displayName={user?.name || user?.email || 'Host'}
                        />
                    ) : (
                        <CustomVideoRoom
                            user={user}
                            callId={activeCallId}
                            onLeave={leaveActiveMeeting}
                        />
                    )}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-teal-400 mb-4" />
                <p className="text-slate-400 text-sm">Loading Teams workspace…</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto text-slate-200 animate-fade-in pb-10">

            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Video className="w-8 h-8 text-blue-400" />
                        Microsoft Teams &amp; Meetings
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Start or join a secure video meeting, check presence, and manage your team.
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button
                        onClick={() => setActiveTab('/dashboard/business/settings')}
                        variant="outline"
                        className="gap-2 border-slate-800 hover:bg-slate-900 text-slate-300"
                    >
                        <Settings className="w-4 h-4" /> Configure
                    </Button>
                    <Button
                        onClick={startInstantMeeting}
                        disabled={starting}
                        className="gap-2 bg-teal-600 hover:bg-teal-500 text-white font-bold shadow-lg shadow-teal-500/20"
                    >
                        {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {starting ? 'Starting…' : isConnected ? 'New Teams Meeting' : 'New Meeting'}
                    </Button>
                </div>
            </div>

            {/* ── Connection status ── */}
            <div className={`p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isConnected ? 'bg-blue-500/5 border-blue-500/20' : 'bg-slate-900/60 border-slate-800'}`}>
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isConnected ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                        <Wifi className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-white">Teams Sync Engine</span>
                            <Badge variant={isConnected ? 'success' : 'warning'}>{isConnected ? 'Active' : 'Setup Needed'}</Badge>
                        </div>
                        <p className="text-sm text-slate-400">
                            {isConnected
                                ? 'Microsoft account connected. Outlook, Calendar, Teams, and OneDrive are available.'
                                : 'Connect Microsoft 365 to unlock Teams presence, calendar sync, and more.'}
                        </p>
                    </div>
                </div>
                {!isConnected && (
                    <Button
                        onClick={() => microsoftAuthService.initiateOAuth('/dashboard/business/teams')}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold shrink-0"
                    >
                        Connect Microsoft 365
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── Meeting Rooms ── */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-bold text-white flex items-center gap-2">
                                <Video className="w-5 h-5 text-teal-400" /> Active Rooms
                            </h2>
                            <Button
                                onClick={startInstantMeeting}
                                disabled={starting}
                                className="gap-1.5 h-8 text-xs px-3 bg-teal-600 hover:bg-teal-500 text-white"
                            >
                                <Plus className="w-3.5 h-3.5" /> New Meeting
                            </Button>
                        </div>

                        {loadingMeetings ? (
                            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-800/40 animate-pulse" />)}</div>
                        ) : meetings.length === 0 ? (
                            <div className="flex flex-col items-center py-10 gap-3 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                                    <Video className="w-7 h-7 text-teal-400" />
                                </div>
                                <p className="text-slate-400 text-sm max-w-xs">No active rooms. Start a meeting and your team can join instantly.</p>
                                <Button onClick={startInstantMeeting} disabled={starting} className="gap-2">
                                    <Plus className="w-4 h-4" /> Start a Meeting
                                </Button>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-800">
                                {meetings.map(m => (
                                    <div key={m.id} className="flex items-center justify-between py-3 gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                                                <Video className="w-5 h-5 text-teal-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="text-sm font-semibold text-white truncate">{m.title || 'Untitled meeting'}</p>
                                                    <MeetingProviderBadge meeting={m} />
                                                </div>
                                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant={m.status === 'active' ? 'success' : 'neutral'}>{m.status}</Badge>
                                            <button
                                                onClick={() => copyMeetingLink(m.id)}
                                                className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                                title="Copy invite link"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <Button onClick={() => void joinMeeting(m.id)} className="gap-1.5 h-8 text-xs px-3">
                                                <Video className="w-3.5 h-3.5" /> Join
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Team Directory */}
                    <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Users className="w-4 h-4" /> Workspace Directory
                            </h3>
                            {loadingPresence && <Loader2 className="w-4 h-4 animate-spin text-teal-400" />}
                        </div>
                        {teamMembers.length === 0 ? (
                            <p className="text-sm text-slate-500">No workspace members found.</p>
                        ) : (
                            <div className="divide-y divide-white/5 max-h-72 overflow-y-auto pr-1">
                                {teamMembers.map((member: any) => {
                                    const email = member.profiles?.email;
                                    const name = member.profiles?.full_name || email || 'Workspace Member';
                                    const role = member.role || 'Member';
                                    const presence = presenceMap[email] || 'offline';
                                    const { dot, text } = getStatusColor(presence);
                                    return (
                                        <div key={member.id} className="py-3 flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center font-bold text-slate-300 text-xs">
                                                    {name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{name}</p>
                                                    <p className="text-xs text-slate-500">{email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight bg-slate-950/40 border border-white/5 px-2 py-0.5 rounded-full">{role}</span>
                                                {isConnected && (
                                                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 border border-white/5 rounded-full bg-slate-950/40 text-[10px] font-black uppercase tracking-wider">
                                                        <span className={`w-2 h-2 rounded-full ${dot} animate-pulse`} />
                                                        <span className={text}>{presence}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right Sidebar ── */}
                <div className="space-y-4">

                    {/* Presence checker */}
                    <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Presence Verifier</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">Query live Teams presence for any user in your tenant.</p>
                        <form onSubmit={handlePresenceCheck} className="space-y-3">
                            <div className="relative">
                                <input
                                    type="email"
                                    value={searchEmail}
                                    onChange={(e) => setSearchEmail(e.target.value)}
                                    placeholder="user@domain.com"
                                    className="w-full rounded-xl border border-slate-800 bg-slate-950/50 pl-10 pr-4 py-2.5 text-xs text-white outline-none focus:border-teal-500/40"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                            </div>
                            <Button type="submit" disabled={checkingEmail || !isConnected} className="w-full bg-blue-600/80 hover:bg-blue-600 text-white font-bold py-2 text-xs">
                                {checkingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check Status'}
                            </Button>
                        </form>
                        {checkedPresence && (() => {
                            const { dot, text } = getStatusColor(checkedPresence.status);
                            return (
                                <div className="p-3 rounded-xl bg-slate-950/50 border border-white/5 space-y-2">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Result</div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs truncate font-semibold text-slate-300">{checkedPresence.email}</span>
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 border border-white/5 rounded-full bg-slate-950/40 text-[10px] font-black uppercase tracking-wider">
                                            <span className={`w-2 h-2 rounded-full ${dot} animate-pulse`} />
                                            <span className={text}>{checkedPresence.status}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Quick actions */}
                    <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Quick Actions</h4>
                        <div className="space-y-2">
                            <button
                                onClick={startInstantMeeting}
                                disabled={starting}
                                className="flex items-center gap-2 w-full p-3 rounded-xl bg-teal-600/10 hover:bg-teal-600/20 border border-teal-500/20 text-left text-sm font-semibold text-teal-300 transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Start Instant Meeting
                            </button>
                            <button
                                onClick={() => setActiveTab('/dashboard/business/calendar')}
                                className="flex items-center gap-2 w-full p-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-950/80 border border-white/5 hover:border-slate-700 text-left text-xs text-slate-300 transition-colors"
                            >
                                <Calendar className="w-4 h-4 text-blue-400" /> Go to Calendar
                            </button>
                            <button
                                onClick={() => setActiveTab('/dashboard/business/meetings')}
                                className="flex items-center gap-2 w-full p-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-950/80 border border-white/5 hover:border-slate-700 text-left text-xs text-slate-300 transition-colors"
                            >
                                <PhoneCall className="w-4 h-4 text-blue-400" /> All Meetings
                            </button>
                            <a
                                href="https://teams.microsoft.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 w-full p-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-950/80 border border-white/5 hover:border-slate-700 text-left text-xs text-slate-300 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4 text-blue-400" /> Open Teams Web
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
