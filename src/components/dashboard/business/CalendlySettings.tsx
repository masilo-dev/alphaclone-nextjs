import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, XCircle, Link, Copy, Users, ArrowRightLeft } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext';

const CalendlySettings: React.FC = () => {
    const { currentTenant, refreshTenants } = useTenant();
    const { user } = useAuth();
    const [connecting, setConnecting] = useState(false);
    const [manualUrl, setManualUrl] = useState('');
    const [showManual, setShowManual] = useState(false);
    const [saving, setSaving] = useState(false);
    const [reconnectRequired, setReconnectRequired] = useState(false);

    // New state for fetching event types and syncing
    const [eventTypes, setEventTypes] = useState<any[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [contactCount, setContactCount] = useState<number | null>(null);
    const [syncingContacts, setSyncingContacts] = useState(false);

    const calendlyConfig = (currentTenant?.settings as any)?.calendly;
    const isConnected = Boolean(calendlyConfig?.enabled && (calendlyConfig?.calendlyUserUri || calendlyConfig?.isManual));

    useEffect(() => {
        if (isConnected && currentTenant) {
            fetchEventTypes();
            fetchContactCount();
        }
    }, [isConnected, currentTenant]);

    const fetchEventTypes = async () => {
        setLoadingEvents(true);
        try {
            const res = await fetch(`/api/calendly/event-types?tenantId=${currentTenant?.id}`);
            if (res.status === 401 || res.status === 403) {
                setReconnectRequired(true);
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setEventTypes(data.eventTypes || []);
                setReconnectRequired(false);
            }
        } catch (error) {
            console.error('Failed to fetch event types:', error);
        } finally {
            setLoadingEvents(false);
        }
    };

    const fetchContactCount = async () => {
        try {
            const res = await fetch(`/api/calendly/contacts?tenantId=${currentTenant?.id}`);
            if (res.ok) {
                const data = await res.json();
                setContactCount(data.count ?? null);
            }
        } catch {
            // non-fatal
        }
    };

    const handleSyncContactsToCRM = async () => {
        if (!currentTenant || !user) return;
        setSyncingContacts(true);
        try {
            const res = await fetch('/api/calendly/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Synced ${data.synced} CRM clients → Calendly Contacts!`);
                await fetchContactCount();
            } else {
                toast.error(data.error || 'Sync failed');
            }
        } catch {
            toast.error('Failed to sync contacts');
        } finally {
            setSyncingContacts(false);
        }
    };

    const handleSyncNow = async () => {
        if (!currentTenant || !user) return;
        setSyncing(true);
        try {
            const res = await fetch('/api/calendly/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id, userId: user.id })
            });

            const data = await res.json();
            if (res.status === 401 || res.status === 403) {
                setReconnectRequired(true);
                toast.error('Calendly session expired. Please reconnect.');
                return;
            }
            if (res.ok) {
                toast.success(`Successfully synced ${data.syncedCount} new events!`);
                setReconnectRequired(false);
            } else {
                toast.error(data.error || 'Failed to sync events');
            }
        } catch (error) {
            console.error('Manual sync failed:', error);
            toast.error('Failed to communicate with sync service.');
        } finally {
            setSyncing(false);
        }
    };

    const handleCopyLink = (url: string) => {
        navigator.clipboard.writeText(url);
        toast.success('Booking link copied entirely!');
    };

    const handleConnect = () => {
        if (!currentTenant) return;
        setConnecting(true);
        // Redirect to our connect API route
        window.location.href = `/api/auth/calendly/connect?tenantId=${currentTenant.id}`;
    };

    // Fallback: if the API route doesn't exist, show a manual link option
    useEffect(() => {
        if (connecting) {
            const timeout = setTimeout(() => {
                setConnecting(false);
                setShowManual(true);
                toast.error('Calendly connection timed out. Please use the manual link option below.');
            }, 10000);
            return () => clearTimeout(timeout);
        }
    }, [connecting]);

    const handleDisconnect = async () => {
        if (!currentTenant || !window.confirm('Are you sure you want to disconnect Calendly? This will disable the booking page.')) return;

        try {
            const response = await fetch(`/api/calendly/status?tenantId=${encodeURIComponent(currentTenant.id)}`, { method: 'DELETE', credentials: 'include' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Calendly could not be disconnected');
            await refreshTenants();
            setEventTypes([]);
            toast.success('Calendly disconnected successfully.');
        } catch (err: any) {
            console.error('Disconnect error:', err);
            toast.error('Failed to disconnect Calendly');
        }
    };

    const handleSaveManual = async () => {
        if (!currentTenant || !manualUrl) return;
        setSaving(true);
        try {
            const response = await fetch('/api/calendly/status', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: currentTenant.id, eventUrl: manualUrl }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Calendly link could not be saved');
            await refreshTenants();
            setShowManual(false);
            setManualUrl('');
            toast.success('Manual link saved!');
        } catch (err) {
            console.error('Save manual error:', err);
            toast.error('Failed to save link');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-bold mb-4">Calendly Integration</h3>
                <p className="text-slate-400 mb-6">
                    Connect your Calendly account to enable the automated booking system, sync events to your dashboard, and manage your meetings.
                </p>
            </div>

            {reconnectRequired && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <div>
                            <p className="text-red-200 text-sm font-bold">Re-authentication Required</p>
                            <p className="text-red-500/70 text-xs">Your Calendly connection has expired or been revoked.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleConnect}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all"
                    >
                        Reconnect Now
                    </button>
                </div>
            )}

            <div className={`p-6 rounded-2xl border ${isConnected ? 'bg-teal-500/5 border-teal-500/20' : 'bg-slate-900/50 border-slate-800'}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isConnected ? 'bg-teal-500/10 text-teal-400' : 'bg-slate-800 text-slate-500'}`}>
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-white">
                                    {isConnected ? 'Calendly Connected' : 'Calendly Not Connected'}
                                </h4>
                                {isConnected ? (
                                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                                ) : (
                                    <AlertCircle className="w-4 h-4 text-slate-500" />
                                )}
                            </div>
                            <p className="text-sm text-slate-400 max-w-md">
                                {isConnected
                                    ? `Successfully linked to your Calendly account. Your booking page is now active using your Calendly events.`
                                    : 'Connect your account to allow clients to book meetings directly through AlphaClone.'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {isConnected ? (
                            <>
                                <button
                                    onClick={handleSyncNow}
                                    disabled={syncing}
                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-lg transition-all disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                                    {syncing ? 'Syncing...' : 'Sync Events'}
                                </button>
                                <button
                                    onClick={handleSyncContactsToCRM}
                                    disabled={syncingContacts}
                                    className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-bold rounded-lg transition-all disabled:opacity-50"
                                    title="Push your CRM clients into Calendly Contacts"
                                >
                                    <ArrowRightLeft className={`w-4 h-4 ${syncingContacts ? 'animate-spin' : ''}`} />
                                    {syncingContacts ? 'Syncing...' : 'Sync CRM → Calendly'}
                                </button>
                                {contactCount !== null && (
                                    <span className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-lg border border-slate-700">
                                        <Users className="w-3.5 h-3.5 text-violet-400" />
                                        {contactCount} Calendly Contacts
                                    </span>
                                )}
                                <a
                                    href="https://calendly.com/app/scheduled_events/user/me"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 text-sm font-bold rounded-lg transition-all"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Manage Events
                                </a>
                                <button
                                    onClick={handleDisconnect}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-bold rounded-lg transition-all"
                                >
                                    <XCircle className="w-4 h-4" />
                                    Disconnect
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col gap-3 items-end">
                                <button
                                    onClick={handleConnect}
                                    disabled={connecting}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-600 text-slate-900 font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {connecting ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                    )}
                                    {connecting ? 'CONNECTING...' : 'CONNECT CALENDLY'}
                                </button>
                                <button
                                    onClick={() => setShowManual(!showManual)}
                                    className="text-xs text-slate-500 hover:text-teal-400 font-medium underline underline-offset-4"
                                >
                                    {showManual ? 'Cancel manual entry' : 'Or connect manually with link'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Event Types Display (Authorized Only) */}
                {isConnected && !loadingEvents && eventTypes.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-800 animate-fade-in">
                        <h5 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Your Active Event Types</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {eventTypes.filter(et => et.active).map(et => (
                                <div key={et.uri} className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-between hover:border-teal-500/30 transition-colors">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h6 className="font-bold text-white truncate pr-2">{et.name}</h6>
                                            <span className="text-xs font-bold px-2 py-1 bg-teal-500/10 text-teal-400 rounded bg-teal-500 border border-teal-500">{et.duration} min</span>
                                        </div>
                                        <p className="text-xs text-slate-400 line-clamp-2 mb-4 break-words">
                                            {et.description_plain || 'No description provided.'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-auto">
                                        <button
                                            onClick={() => handleCopyLink(et.scheduling_url)}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors"
                                        >
                                            <Copy className="w-3 h-3" /> Copy Link
                                        </button>
                                        <a
                                            href={et.scheduling_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white rounded-lg transition-colors"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {showManual && !isConnected && (
                    <div className="mt-6 pt-6 border-t border-slate-800 space-y-4 animate-fade-in">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paste your Calendly Link</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualUrl}
                                    onChange={(e) => setManualUrl(e.target.value)}
                                    placeholder="https://calendly.com/your-profile/30min"
                                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors"
                                />
                                <button
                                    onClick={handleSaveManual}
                                    disabled={saving || !manualUrl}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                                >
                                    {saving ? 'SAVING...' : 'SAVE LINK'}
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 italic">
                                Note: Manual links enable the booking page but do not sync dashboard meetings automatically.
                            </p>
                        </div>
                    </div>
                )}

                {isConnected && calendlyConfig.eventUrl && (
                    <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500 font-medium">Your Default Scheduling URL:</span>
                            <a
                                href={calendlyConfig.eventUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-400 hover:underline flex items-center gap-1"
                            >
                                {calendlyConfig.eventUrl}
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* Informational Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <div className="p-4 bg-slate-900/30 border border-slate-800/50 rounded-xl">
                    <h5 className="text-sm font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-teal-400" />
                        Branded Experience
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        AlphaClone automatically skins your Calendly booking page with your brand colors for a seamless client experience.
                    </p>
                </div>
                <div className="p-4 bg-slate-900/30 border border-slate-800/50 rounded-xl">
                    <h5 className="text-sm font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-teal-400" />
                        Automated Sync
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Bookings are automatically synced to your AlphaClone dashboard and notifications are sent to your team.
                    </p>
                </div>
                <div className="p-4 bg-violet-900/20 border border-violet-800/30 rounded-xl">
                    <h5 className="text-sm font-bold text-white mb-2 uppercase tracking-wider flex items-center gap-2">
                        <Users className="w-4 h-4 text-violet-400" />
                        Contacts API
                    </h5>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Sync your CRM clients into Calendly Contacts. Routing form submissions automatically flow in as new leads. <span className="text-violet-400 font-semibold">New May 2026.</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CalendlySettings;

