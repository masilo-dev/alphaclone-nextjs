import React, { useState, useEffect } from 'react';
import { tenantService } from '@/services/tenancy/TenantService';
import { Tenant } from '@/services/tenancy/types';
import { Settings, Copy, Plus, X, ExternalLink, Check } from 'lucide-react';
import { Card, Button } from '@/components/ui/UIComponents';

interface BookingSettingsProps {
    tenant: Tenant;
    onUpdate: () => void;
    onClose: () => void;
}

export const BookingSettings: React.FC<BookingSettingsProps> = ({ tenant, onUpdate, onClose }) => {
    const [settings, setSettings] = useState(tenant.settings.booking || {
        enabled: false,
        slug: tenant.slug,
        availability: {
            days: [1, 2, 3, 4, 5], // Mon-Fri
            hours: { start: '09:00', end: '17:00' }
        },
        meetingTypes: [
            { id: '30min', name: '30 Min Meeting', duration: 30, price: 0 }
        ]
    });

    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await tenantService.updateTenant(tenant.id, {
                settings: {
                    ...tenant.settings,
                    booking: settings
                }
            });
            onUpdate();
            onClose();
        } catch (err) {
            console.error('Failed to save booking settings', err);
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-300">
            <div
                className="absolute inset-0 bg-transparent"
                onClick={onClose}
            />
            <Card className="relative bg-[#0a0a0a] border border-slate-800/50 sm:rounded-3xl p-0 flex flex-col w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-teal-500/10 rounded-xl">
                            <Settings className="w-6 h-6 text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Booking Settings</h2>
                            <p className="text-slate-400 text-sm">Configure your public booking page</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-10 overscroll-contain">
                    {/* 1. Main Toggle & Link */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-5 bg-teal-500/5 border border-teal-500/10 rounded-2xl group transition-all hover:bg-teal-500/10">
                            <label className="flex items-center gap-4 cursor-pointer select-none">
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${settings.enabled ? 'bg-teal-500 border-teal-500' : 'border-slate-600 bg-slate-800'}`}>
                                    {settings.enabled && <Check className="w-4 h-4 text-slate-950 font-bold" />}
                                    <input
                                        type="checkbox"
                                        checked={settings.enabled}
                                        onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                                        className="hidden"
                                    />
                                </div>
                                <div>
                                    <span className="font-bold text-white tracking-wide block">Booking Page Status</span>
                                    <span className="text-xs text-slate-500 uppercase font-mono tracking-widest leading-none">
                                        {settings.enabled ? 'Global Up-Link Active' : 'System Offline'}
                                    </span>
                                </div>
                            </label>
                            {settings.enabled && (
                                <div className="flex flex-col sm:flex-row gap-2 mt-2 sm:mt-0">
                                    <button
                                        className="text-[10px] flex items-center justify-center gap-2 text-teal-400 hover:text-white bg-slate-900 px-4 py-3 sm:py-2 rounded-xl border border-slate-800 transition-all font-black tracking-widest uppercase italic w-full sm:w-auto"
                                        onClick={() => {
                                            const url = `${window.location.origin}/book/${settings.slug}`;
                                            window.open(url, '_blank');
                                        }}
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        PREVIEW
                                    </button>
                                    <button
                                        className="text-[10px] flex items-center justify-center gap-2 text-slate-950 bg-teal-500 hover:bg-white px-4 py-3 sm:py-2 rounded-xl transition-all font-black tracking-widest uppercase w-full sm:w-auto"
                                        onClick={() => {
                                            const url = `${window.location.origin}/book/${settings.slug}`;
                                            navigator.clipboard.writeText(url);
                                        }}
                                    >
                                        <Copy className="w-3 h-3" />
                                        COPY LINK
                                    </button>
                                </div>
                            )}
                        </div>
                        {settings.enabled && (
                            <div className="flex flex-col gap-2">
                                <span className="text-slate-500 text-[10px] font-black tracking-widest uppercase px-2">Deployment Path</span>
                                <div className="relative group">
                                    <div className="hidden sm:flex absolute inset-y-0 left-4 items-center pointer-events-none text-slate-500 font-mono text-xs">
                                        alphaclone.tech/book/
                                    </div>
                                    <div className="sm:hidden mb-2 text-slate-500 font-mono text-xs px-1">
                                        alphaclone.tech/book/
                                    </div>
                                    <input
                                        type="text"
                                        value={settings.slug}
                                        onChange={(e) => setSettings({ ...settings, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl sm:pl-[125px] px-4 py-4 text-sm font-bold text-teal-400 focus:border-teal-500/50 outline-none transition-all"
                                        placeholder="your-custom-slug"
                                    />
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
                                        h-12 sm:h-auto aspect-square sm:aspect-auto sm:py-4 rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95
                                        ${settings.availability.days.includes(idx)
                                            ? 'bg-white text-slate-950 border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                                            : 'bg-slate-900/50 text-slate-500 border-slate-800 hover:border-slate-600'}
                                    `}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 bg-slate-900/50 p-6 rounded-3xl border border-slate-800/50">
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
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-base font-bold text-white focus:border-teal-500/50 outline-none"
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
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-base font-bold text-white focus:border-teal-500/50 outline-none"
                                />
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
                                className="text-[10px] flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-600 px-4 py-2 rounded-xl transition-all font-black uppercase tracking-widest text-white active:scale-95"
                            >
                                <Plus className="w-3 h-3 text-teal-400" /> ADD TYPE
                            </button>
                        </div>
                        <div className="space-y-4">
                            {settings.meetingTypes.map((type, idx) => (
                                <div key={type.id} className="group flex flex-col sm:flex-row gap-4 sm:items-center bg-slate-900/40 p-5 rounded-2xl border border-slate-800/50 hover:border-slate-700/50 transition-all">
                                    <div className="flex-1 flex items-center gap-4">
                                        <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center shrink-0">
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
                                                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 w-24 text-center text-sm font-black text-teal-400"
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

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-xl flex gap-4 shrink-0">
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
