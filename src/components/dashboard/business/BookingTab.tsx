'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '../../../contexts/TenantContext';
import { useAuth } from '../../../contexts/AuthContext';
import CalendlyEmbed from '../../booking/CalendlyEmbed';
import { Card } from '@/components/ui/UIComponents';
import { Calendar, Settings, AlertCircle, Clock, ExternalLink, RefreshCw, User } from 'lucide-react';
import { toast } from 'react-hot-toast';

const BookingTab: React.FC = () => {
    const { currentTenant } = useTenant();
    const { user } = useAuth();
    const [activeView, setActiveView] = useState<'schedule' | 'booking'>('schedule');
    const [scheduledEvents, setScheduledEvents] = useState<any[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const calendlyConfig = (currentTenant?.settings as any)?.calendly;
    const calendlyUrl = calendlyConfig?.eventUrl;
    const isEnabled = calendlyConfig?.enabled;

    useEffect(() => {
        if (isEnabled && currentTenant?.id) {
            fetchScheduledEvents();
        }
    }, [isEnabled, currentTenant?.id]);

    const fetchScheduledEvents = async () => {
        if (!currentTenant?.id) return;
        setLoadingEvents(true);
        try {
            const res = await fetch(`/api/calendly/scheduled-events?tenantId=${currentTenant.id}`);
            if (res.ok) {
                const data = await res.json();
                setScheduledEvents(data.events || []);
            }
        } catch (error) {
            console.error('Failed to fetch scheduled events:', error);
        } finally {
            setLoadingEvents(false);
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

            if (res.ok) {
                const data = await res.json();
                toast.success(`Synced ${data.syncedCount} new events!`);
                fetchScheduledEvents();
            } else {
                toast.error('Sync failed');
            }
        } catch (error) {
            toast.error('Communication error during sync');
        } finally {
            setSyncing(false);
        }
    };

    if (!isEnabled || !calendlyUrl) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Calendar className="w-10 h-10 text-slate-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Calendly Not Connected</h3>
                <p className="text-slate-400 max-w-md mb-8">
                    Connect your Calendly account in settings to enable the embedded booking view and schedule sync.
                </p>
                <button
                    onClick={() => window.location.href = '/dashboard/business/settings'}
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-900/20"
                >
                    <Settings className="w-4 h-4" />
                    Go to Settings
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-teal-400" />
                        Scheduling
                    </h2>
                    <p className="text-slate-400 text-sm">Manage your meetings and availability</p>
                </div>

                <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 self-stretch sm:self-auto">
                    <button
                        onClick={() => setActiveView('schedule')}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === 'schedule' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                        My Schedule
                    </button>
                    <button
                        onClick={() => setActiveView('booking')}
                        className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeView === 'booking' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
                    >
                        Booking Page
                    </button>
                </div>
            </div>

            {activeView === 'schedule' ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Upcoming Appointments
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => window.open('https://calendly.com/app/scheduled_events/user/me', '_blank')}
                                className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white transition-colors bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Manage Availability
                            </button>
                            <button
                                onClick={handleSyncNow}
                                disabled={syncing}
                                className="flex items-center gap-1.5 text-xs font-bold text-teal-400 hover:text-teal-300 transition-colors bg-teal-500/5 px-3 py-1.5 rounded-lg border border-teal-500/20 disabled:opacity-50"
                            >
                                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                                {syncing ? 'Syncing...' : 'Sync Now'}
                            </button>
                        </div>
                    </div>

                    {loadingEvents ? (
                        <div className="grid grid-cols-1 gap-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-24 bg-slate-900/50 rounded-2xl animate-pulse border border-slate-800" />
                            ))}
                        </div>
                    ) : scheduledEvents.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {scheduledEvents.map((event: any) => {
                                const start = new Date(event.start_time);
                                return (
                                    <Card key={event.id} className="p-5 bg-slate-900/40 border-slate-800 hover:border-teal-500/30 transition-all flex flex-col justify-between group">
                                        <div>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform">
                                                    <Calendar className="w-5 h-5" />
                                                </div>
                                                <span className="text-[10px] font-bold px-2 py-1 bg-slate-800 text-slate-400 rounded-lg border border-slate-700">
                                                    Scheduled
                                                </span>
                                            </div>
                                            <h4 className="font-bold text-white mb-1 group-hover:text-teal-400 transition-colors line-clamp-1">{event.title}</h4>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                                                <Clock className="w-3 h-3 text-teal-500/50" />
                                                {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center">
                                                    <User className="w-3 h-3 text-slate-500" />
                                                </div>
                                                <span className="text-[10px] text-slate-400">1 Invitee</span>
                                            </div>
                                            <button
                                                onClick={() => window.location.href = '/dashboard/business/calendar'}
                                                className="text-[10px] font-bold text-teal-400 hover:underline"
                                            >
                                                View in Calendar
                                            </button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 bg-slate-900/20 border border-slate-800 border-dashed rounded-3xl">
                            <Calendar className="w-10 h-10 text-slate-700 mb-4" />
                            <p className="text-slate-500 font-medium text-sm">No upcoming appointments found.</p>
                            <p className="text-[10px] text-slate-600 mt-1 uppercase tracking-widest">Bookings sync automatically</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-teal-500/5 border border-teal-500/10 p-4 rounded-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400">
                                <AlertCircle className="w-4 h-4" />
                            </div>
                            <p className="text-xs text-slate-300">
                                This is your <span className="text-white font-bold">Public Booking Link</span> (how clients see it). Calendly <span className="underline">does not</span> allow embedding their private admin dashboard.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => window.open('https://calendly.com/app', '_blank')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Open Calendly Admin
                            </button>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(calendlyUrl);
                                    toast.success('Link copied!');
                                }}
                                className="px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                            >
                                Copy Link
                            </button>
                        </div>
                    </div>

                    <Card className="p-0 overflow-hidden bg-slate-950 border-slate-800 border-2" style={{ height: 'calc(100vh - 300px)', minHeight: '600px' }}>
                        <CalendlyEmbed
                            url={calendlyUrl}
                            branding={{
                                primaryColor: '#2dd4bf',
                                backgroundColor: '#0f172a',
                                textColor: '#ffffff'
                            }}
                        />
                    </Card>
                </div>
            )}
        </div>
    );
};

export default BookingTab;
