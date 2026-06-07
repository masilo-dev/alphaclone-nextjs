'use client';

import React, { useEffect, useState } from 'react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { microsoft365Service } from '@/services/microsoft365Service';
import { microsoftAuthService } from '@/services/microsoftAuthService';
import { tenantService } from '@/services/tenancy/TenantService';
import {
    Video,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Search,
    UserCheck,
    Settings,
    Calendar,
    PhoneCall
} from 'lucide-react';
import { Button, Badge } from '@/components/ui/UIComponents';
import toast from 'react-hot-toast';

interface TeamsPageProps {
    user: any;
    setActiveTab: (tab: string) => void;
}

export default function TeamsPage({ user, setActiveTab }: TeamsPageProps) {
    const { currentTenant } = useTenant();
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});
    const [loadingPresence, setLoadingPresence] = useState(false);

    // Custom checker
    const [searchEmail, setSearchEmail] = useState('');
    const [checkedPresence, setCheckedPresence] = useState<{ email: string; status: string } | null>(null);
    const [checkingEmail, setCheckingEmail] = useState(false);

    useEffect(() => {
        if (currentTenant?.id) {
            void loadTeamsStatus();
        }

        const params = new URLSearchParams(window.location.search);
        const oauthStatus = params.get('microsoft');
        if (!oauthStatus) {
            return;
        }

        const reason = params.get('reason');
        if (oauthStatus === 'connected') {
            toast.success('Microsoft 365 connected');
            if (currentTenant?.id) {
                void loadTeamsStatus();
            }
        } else if (oauthStatus === 'error') {
            toast.error(reason || 'Microsoft connection failed');
        }

        params.delete('microsoft');
        params.delete('reason');
        const nextSearch = params.toString();
        const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
        window.history.replaceState({}, '', nextUrl);
    }, [currentTenant?.id]);

    const handleConnect = () => {
        microsoftAuthService.initiateOAuth('/dashboard/business/teams');
    };

    const loadTeamsStatus = async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        try {
            const connected = await microsoftAuthService.isConnected();
            setIsConnected(connected);

            // Fetch team members
            const members = await tenantService.getTenantUsers(currentTenant.id);
            setTeamMembers(members || []);

            if (connected && members && members.length > 0) {
                setLoadingPresence(true);
                const map: Record<string, string> = {};
                await Promise.all(
                    members.map(async (m: any) => {
                        const email = m.profiles?.email;
                        if (email) {
                            const { status: presenceStatus } = await microsoft365Service.fetchTeamsPresence(currentTenant.id, email);
                            map[email] = presenceStatus;
                        }
                    })
                );
                setPresenceMap(map);
                setLoadingPresence(false);
            }
        } catch (err: any) {
            console.error('Error loading MS Teams status:', err);
            toast.error('Failed to load MS Teams integration status.');
        } finally {
            setLoading(false);
        }
    };

    const handleSinglePresenceCheck = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant?.id) return;
        if (!searchEmail.trim()) {
            toast.error('Enter an email address');
            return;
        }

        setCheckingEmail(true);
        setCheckedPresence(null);
        try {
            const { status: presenceStatus, error } = await microsoft365Service.fetchTeamsPresence(currentTenant.id, searchEmail.trim());
            if (error) throw new Error(error);

            setCheckedPresence({
                email: searchEmail.trim(),
                status: presenceStatus
            });
            toast.success(`Presence fetched successfully`);
        } catch (err: any) {
            toast.error(err.message || 'Failed to check presence');
        } finally {
            setCheckingEmail(false);
        }
    };

    const getStatusColor = (statusStr: string) => {
        switch (statusStr?.toLowerCase()) {
            case 'online':
                return 'bg-emerald-500 text-emerald-400 border-emerald-500/20';
            case 'away':
                return 'bg-amber-500 text-amber-400 border-amber-500/20';
            case 'busy':
                return 'bg-rose-500 text-rose-400 border-rose-500/20';
            case 'offline':
            default:
                return 'bg-slate-500 text-slate-400 border-slate-500/20';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Loader2 className="w-10 h-10 animate-spin text-teal-400 mb-4" />
                <p className="text-slate-400 text-sm">Synchronizing Microsoft Teams state...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto text-slate-200 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Video className="w-8 h-8 text-blue-400" />
                        Microsoft Teams
                    </h1>
                    <p className="text-slate-400">Manage real-time communication synchronization and calling integrations.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={() => setActiveTab('/dashboard/business/settings')} variant="outline" className="gap-2 border-slate-800 hover:bg-slate-900 text-slate-300">
                        <Settings className="w-4 h-4" />
                        Configure Credentials
                    </Button>
                </div>
            </div>

            {/* Connection Hero Card */}
            <div className={`p-6 rounded-2xl border ${isConnected ? 'bg-blue-500/5 border-blue-500/20' : 'bg-slate-900/60 border-slate-800'} flex flex-col md:flex-row justify-between items-start md:items-center gap-6`}>
                <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                        <Video className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-bold text-white">Teams Sync Engine</h2>
                            {isConnected ? (
                                <Badge variant="success">Active</Badge>
                            ) : (
                                <Badge variant="warning">Setup Needed</Badge>
                            )}
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                            {isConnected
                                ? 'Your Microsoft account is connected once for your profile. Outlook, Calendar, Teams, and OneDrive stay available across every workspace you open.'
                                : 'Connect Microsoft 365 once to unlock Teams, Outlook, Calendar, and OneDrive across all your workspaces.'}
                        </p>
                    </div>
                </div>

                {!isConnected && (
                    <Button onClick={handleConnect} className="bg-blue-600 hover:bg-blue-500 text-white font-bold shrink-0">
                        Connect Microsoft 365
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Team Status Directory */}
                <div className="md:col-span-2 space-y-4">
                    <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                            <span>Workspace Directory</span>
                            {loadingPresence && <Loader2 className="w-4 h-4 animate-spin text-teal-400" />}
                        </h3>

                        {teamMembers.length === 0 ? (
                            <p className="text-sm text-slate-500">No workspace members found.</p>
                        ) : (
                            <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto pr-2">
                                {teamMembers.map((member: any) => {
                                    const email = member.profiles?.email;
                                    const displayName = member.profiles?.full_name || email || 'Workspace Member';
                                    const role = member.role || 'Member';
                                    const presence = presenceMap[email] || 'offline';

                                    return (
                                        <div key={member.id} className="py-4 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center font-bold text-slate-300 text-sm">
                                                    {displayName.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-white">{displayName}</h4>
                                                    <p className="text-xs text-slate-500">{email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400 uppercase font-bold tracking-tight bg-slate-950/40 border border-white/5 px-2 py-0.5 rounded-full">{role}</span>
                                                {isConnected ? (
                                                    <div className={`flex items-center gap-1.5 px-2.5 py-0.5 border rounded-full bg-slate-950/40 text-[10px] font-black uppercase tracking-wider`}>
                                                        <span className={`w-2 h-2 rounded-full ${getStatusColor(presence).split(' ')[0]} animate-pulse`} />
                                                        <span className={getStatusColor(presence).split(' ')[1]}>{presence}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Sync inactive</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Presence Checker tool */}
                <div className="space-y-6">
                    <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-4">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Presence Verifier</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Query Teams presence status for any email in the tenant. Allows validating status mapping overrides.
                        </p>

                        <form onSubmit={handleSinglePresenceCheck} className="space-y-3">
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
                            <Button
                                type="submit"
                                disabled={checkingEmail || !isConnected}
                                className="w-full bg-blue-600/80 hover:bg-blue-600 text-white font-bold py-2 text-xs"
                            >
                                {checkingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check Status'}
                            </Button>
                        </form>

                        {checkedPresence && (
                            <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5 space-y-3 animate-fade-in">
                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Result</div>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs truncate max-w-[120px] font-semibold text-slate-300">{checkedPresence.email}</div>
                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 border rounded-full bg-slate-950/40 text-[10px] font-black uppercase tracking-wider`}>
                                        <span className={`w-2 h-2 rounded-full ${getStatusColor(checkedPresence.status).split(' ')[0]} animate-pulse`} />
                                        <span className={getStatusColor(checkedPresence.status).split(' ')[1]}>{checkedPresence.status}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick navigation */}
                    <div className="p-5 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Quick Actions</h4>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => setActiveTab('/dashboard/business/calendar')}
                                className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/40 hover:bg-slate-950/80 border border-white/5 hover:border-slate-700 text-left text-xs transition-colors"
                            >
                                <Calendar className="w-4 h-4 text-blue-400" />
                                <span>Go to Calendar</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('/dashboard/business/meetings')}
                                className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950/40 hover:bg-slate-950/80 border border-white/5 hover:border-slate-700 text-left text-xs transition-colors"
                            >
                                <PhoneCall className="w-4 h-4 text-blue-400" />
                                <span>Go to Meetings</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
