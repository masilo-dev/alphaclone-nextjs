import React, { useState, useEffect } from 'react';
import { tenantService } from '@/services/tenancy/TenantService';
import { Tenant, TenantSettings } from '@/services/tenancy/types';
import { Settings, Copy, Plus, X, ExternalLink, Globe, Calendar } from 'lucide-react';
import { Card, Button } from '@/components/ui/UIComponents';

interface BookingSettingsProps {
    tenant: Tenant;
    onUpdate: () => void;
    onClose: () => void;
}

export const BookingSettings: React.FC<BookingSettingsProps> = ({ tenant, onUpdate, onClose }) => {
    const [settings, setSettings] = useState<NonNullable<TenantSettings['booking']>>(tenant.settings.booking || {
        enabled: false,
        slug: tenant.slug,
        availability: {
            days: [1, 2, 3, 4, 5], // Mon-Fri
            hours: { start: '09:00', end: '17:00' },
            timezone: 'UTC' // Default
        },
        meetingTypes: [
            { id: '30min', name: '30 Min Meeting', duration: 30, price: 0 }
        ],
        // Default Logic Settings
        bufferTime: 15,
        minNotice: 4,
        futureLimit: 60
    });

    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await tenantService.updateTenant(tenant.id, {
                slug: settings.slug, // Sync root slug for routing
                settings: {
                    ...tenant.settings,
                    booking: settings
                }
            });
            onUpdate();
            onClose();
        } catch (err: any) {
            console.error('Failed to save booking settings', err);
            if (err.message?.includes('violates unique constraint') || err.code === '23505') {
                alert('This booking link is already taken. Please choose another one.');
            } else {
                alert('Failed to save settings. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (dayIndex: number) => {
        const days = settings.availability.days.includes(dayIndex)
            ? settings.availability.days.filter(d => d !== dayIndex)
            : [...settings.availability.days, dayIndex].sort();

        setSettings({
            ...settings,
            availability: { ...settings.availability, days }
        });
    };

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-300">
            <div
                className="absolute inset-0 bg-transparent"
                onClick={onClose}
            />
            <Card className="relative bg-slate-900 border border-slate-700 sm:rounded-3xl p-0 flex flex-col w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                {/* Header */}
                <div className="flex items-start sm:items-center justify-between p-4 sm:p-6 border-b border-slate-700 bg-slate-900/50 backdrop-blur-xl shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-3 bg-teal-500/10 rounded-xl">
                            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold">Booking Settings</h2>
                            <p className="text-slate-400 text-xs sm:text-sm">Configure your public booking page</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg -mr-2 sm:mr-0">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-10 overscroll-contain">
                    {/* [NEW] Calendly Priority Check */}
                    {(tenant.settings as any)?.calendly?.enabled && (
                        <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl flex items-start gap-4">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Calendar className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-purple-200">Calendly Active</h3>
                                <p className="text-xs text-purple-400/80 leading-relaxed">
                                    Your Calendly integration is currently active and serving as your primary booking system.
                                    Legacy booking settings below are disabled to prevent synchronization conflicts.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className={((tenant.settings as any)?.calendly?.enabled) ? "hidden" : ""}>
                        {/* 1. Main Toggle & Link */}
                        <div className="space-y-6">
                            {/* Enable Toggle */}
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 bg-slate-800 rounded-2xl border border-slate-700">
                                <div>
                                    <h3 className="font-bold text-white text-sm">Public Booking Page</h3>
                                    <p className="text-xs text-slate-500">Allow clients to book you online.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.enabled}
                                        onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                                </label>
                            </div>

                            {settings.enabled && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {/* Link Display & Copy */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Your Booking Link</label>
                                        <div className="flex flex-col md:flex-row gap-2">
                                            <div className="flex-1 bg-slate-950 border border-slate-700 rounded-xl flex items-center px-4 py-3 gap-2 overflow-hidden">
                                                <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                                                <span className="text-sm text-slate-500 truncate inline-block max-w-[120px] sm:max-w-none">alphaclone.tech/book/</span>
                                                <input
                                                    value={settings.slug}
                                                    onChange={(e) => setSettings({ ...settings, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                                                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-white placeholder-slate-600 min-w-[50px]"
                                                    placeholder="username"
                                                />
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const url = `${window.location.origin}/book/${settings.slug}`;
                                                    navigator.clipboard.writeText(url);
                                                }}
                                                className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-colors"
                                                title="Copy Link"
                                            >
                                                <Copy className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const url = `${window.location.origin}/book/${settings.slug}`;
                                                    window.open(url, '_blank');
                                                }}
                                                className="p-3 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/20 transition-colors"
                                                title="Open Page"
                                            >
                                                <ExternalLink className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-500 px-1">Tip: Keep your slug short and simple.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. Availability */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-2 leading-none">Service Frequency</h3>
                                <div className="h-[1px] flex-1 bg-slate-800 mx-4 opacity-50" />
                            </div>
                            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                                    <button
                                        key={day}
                                        onClick={() => toggleDay(idx)}
                                        className={`
                                        h-12 sm:h-auto aspect-square sm:aspect-auto sm:py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95
                                        ${settings.availability.days.includes(idx)
                                                ? 'bg-white text-slate-950 border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                                                : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:border-slate-600'}
                                    `}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 bg-slate-800 p-6 rounded-3xl border border-slate-700">
                                <div className="flex-1 w-full space-y-2">
                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Shift Start</label>
                                    <input
                                        type="time"
                                        value={settings.availability.hours.start}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            availability: {
                                                ...settings.availability,
                                                hours: {
                                                    ...settings.availability.hours,
                                                    start: e.target.value
                                                }
                                            }
                                        })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-6 py-4 text-base font-bold text-white focus:border-teal-500 outline-none"
                                    />
                                </div>
                                <div className="hidden sm:block pt-6">
                                    <div className="w-8 h-[2px] bg-slate-800 rounded-full" />
                                </div>
                                <div className="flex-1 w-full space-y-2">
                                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Shift End</label>
                                    <input
                                        type="time"
                                        value={settings.availability.hours.end}
                                        onChange={(e) => setSettings({
                                            ...settings,
                                            availability: {
                                                ...settings.availability,
                                                hours: {
                                                    ...settings.availability.hours,
                                                    end: e.target.value
                                                }
                                            }
                                        })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-6 py-4 text-base font-bold text-white focus:border-teal-500 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Timezone Selector */}
                            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-bold text-white">Operational Timezone</label>
                                    <p className="text-xs text-slate-500">Your availability will be calculated based on this zone.</p>
                                </div>
                                <select
                                    value={settings.availability.timezone || 'UTC'}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        availability: {
                                            ...settings.availability,
                                            timezone: e.target.value
                                        }
                                    })}
                                    className="w-full sm:w-64 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-teal-500"
                                >
                                    <option value="UTC">UTC (Universal Time)</option>
                                    <option value="America/New_York">Eastern Time (US & Canada)</option>
                                    <option value="America/Chicago">Central Time (US & Canada)</option>
                                    <option value="America/Denver">Mountain Time (US & Canada)</option>
                                    <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                                    <option value="Europe/London">London (GMT/BST)</option>
                                    <option value="Europe/Paris">Paris (CET)</option>
                                    <option value="Asia/Dubai">Dubai (GST)</option>
                                    <option value="Asia/Singapore">Singapore (SGT)</option>
                                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                                    <option value="Australia/Sydney">Sydney (AEST)</option>
                                </select>
                            </div>

                            {/* [NEW] Booking Logic Settings */}
                            <div className="bg-slate-800 p-6 rounded-3xl border border-slate-700 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-2 leading-none">Smart Logic</h3>
                                    <div className="h-[1px] flex-1 bg-slate-800 mx-4 opacity-50" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    {/* Buffer Time */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Buffer Time</label>
                                        <div className="relative">
                                            <select
                                                value={settings.bufferTime || 15}
                                                onChange={(e) => setSettings({ ...settings, bufferTime: parseInt(e.target.value) })}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-teal-500 appearance-none"
                                            >
                                                <option value={0}>None</option>
                                                <option value={5}>5 mins</option>
                                                <option value={10}>10 mins</option>
                                                <option value={15}>15 mins</option>
                                                <option value={30}>30 mins</option>
                                                <option value={60}>1 hour</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs font-bold">MIN</div>
                                        </div>
                                        <p className="text-[10px] text-slate-500 px-2 leading-tight">Padding between meetings.</p>
                                    </div>

                                    {/* Min Notice */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Minimum Notice</label>
                                        <div className="relative">
                                            <select
                                                value={settings.minNotice || 4}
                                                onChange={(e) => setSettings({ ...settings, minNotice: parseInt(e.target.value) })}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-teal-500 appearance-none"
                                            >
                                                <option value={0}>Instant</option>
                                                <option value={1}>1 hour</option>
                                                <option value={2}>2 hours</option>
                                                <option value={4}>4 hours</option>
                                                <option value={24}>24 hours</option>
                                                <option value={48}>48 hours</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs font-bold">URS</div>
                                        </div>
                                        <p className="text-[10px] text-slate-500 px-2 leading-tight">Prevent last-minute bookings.</p>
                                    </div>

                                    {/* Future Limit */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Booking Limit</label>
                                        <div className="relative">
                                            <select
                                                value={settings.futureLimit || 60}
                                                onChange={(e) => setSettings({ ...settings, futureLimit: parseInt(e.target.value) })}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-teal-500 appearance-none"
                                            >
                                                <option value={14}>2 weeks</option>
                                                <option value={30}>30 days</option>
                                                <option value={60}>60 days</option>
                                                <option value={90}>3 months</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-xs font-bold">DYS</div>
                                        </div>
                                        <p className="text-[10px] text-slate-500 px-2 leading-tight">How far ahead people can book.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Meeting Types */}
                        <div className="space-y-6 pb-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] px-2 leading-none">Transmission Types</h3>
                                <div className="h-[1px] flex-1 bg-slate-800 mx-4 opacity-50" />
                                <button
                                    onClick={() => setSettings({
                                        ...settings,
                                        meetingTypes: [
                                            ...settings.meetingTypes,
                                            { id: Math.random().toString(36).substr(2, 9), name: 'New Meeting', duration: 30, price: 0 }
                                        ]
                                    })}
                                    className="text-[10px] flex items-center gap-2 bg-slate-800 border border-slate-700 hover:border-slate-600 hover:bg-slate-700 px-4 py-2 rounded-xl transition-all font-black uppercase tracking-widest text-white active:scale-95"
                                >
                                    <Plus className="w-3 h-3 text-teal-400" /> ADD TYPE
                                </button>
                            </div>
                            <div className="space-y-4">
                                {settings.meetingTypes.map((type, idx) => (
                                    <div key={type.id} className="group flex flex-col sm:flex-row gap-4 sm:items-center bg-slate-900/40 p-5 rounded-2xl border border-slate-700 hover:border-slate-600 transition-all">
                                        <div className="flex-1 flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-950 border border-slate-700 rounded-xl flex items-center justify-center shrink-0">
                                                <span className="text-xs font-black text-slate-600">0{idx + 1}</span>
                                            </div>
                                            <input
                                                type="text"
                                                value={type.name}
                                                onChange={(e) => {
                                                    const newTypes = [...settings.meetingTypes];
                                                    newTypes[idx].name = e.target.value;
                                                    setSettings({ ...settings, meetingTypes: newTypes });
                                                }}
                                                className="bg-transparent text-white font-bold placeholder:text-slate-700 outline-none w-full"
                                                placeholder="Meeting Name"
                                            />
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end gap-6 sm:pl-4 sm:border-l sm:border-slate-800">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="number"
                                                    value={type.duration}
                                                    onChange={(e) => {
                                                        const newTypes = [...settings.meetingTypes];
                                                        newTypes[idx].duration = parseInt(e.target.value);
                                                        setSettings({ ...settings, meetingTypes: newTypes });
                                                    }}
                                                    className="bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 w-24 text-center text-sm font-black text-teal-400"
                                                />
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">MIN</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const newTypes = settings.meetingTypes.filter((_, i) => i !== idx);
                                                    setSettings({ ...settings, meetingTypes: newTypes });
                                                }}
                                                className="p-3 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all active:scale-90"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 md:p-6 border-t border-slate-700 bg-slate-900/50 backdrop-blur-xl flex gap-4 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-[10px] font-black tracking-widest uppercase text-slate-500 hover:text-white hover:bg-slate-800 rounded-2xl transition-all"
                    >
                        DISCARD
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-[2] py-4 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 text-slate-950 font-black tracking-[0.2em] uppercase rounded-2xl transition-all shadow-[0_0_30px_rgba(45,212,191,0.2)] disabled:shadow-none active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                        {saving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                                SYNCING...
                            </>
                        ) : (
                            'UPDATE PROTOCOLS'
                        )}
                    </button>
                </div>
            </Card>
        </div>
    );
};
