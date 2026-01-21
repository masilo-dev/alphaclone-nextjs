import React, { useState, useEffect } from 'react';
import { tenantService } from '@/services/tenancy/TenantService';
import { Tenant } from '@/services/tenancy/types';
import { Settings, Copy, Plus, X } from 'lucide-react';
import { Card } from '@/components/ui/UIComponents';

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

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
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

                <div className="space-y-8">
                    {/* 1. Main Toggle & Link */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-xl">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.enabled}
                                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                                    className="w-5 h-5 rounded text-teal-500 bg-slate-700 border-slate-600"
                                />
                                <span className="font-medium">Enable Public Booking Page</span>
                            </label>
                            {settings.enabled && (
                                <button
                                    className="text-xs flex items-center gap-1.5 text-teal-400 hover:text-teal-300 bg-teal-500/10 px-3 py-1.5 rounded-lg border border-teal-500/20"
                                    onClick={() => {
                                        const url = `${window.location.origin}/book/${settings.slug}`;
                                        navigator.clipboard.writeText(url);
                                    }}
                                >
                                    <Copy className="w-3 h-3" />
                                    Copy Link
                                </button>
                            )}
                        </div>
                        {settings.enabled && (
                            <div className="flex items-center gap-3">
                                <span className="text-slate-400 text-sm">Booking URL:</span>
                                <input
                                    type="text"
                                    value={settings.slug}
                                    onChange={(e) => setSettings({ ...settings, slug: e.target.value })}
                                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm min-w-[200px]"
                                />
                            </div>
                        )}
                    </div>

                    {/* 2. Availability */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold">Availability</h3>
                        <div className="grid grid-cols-7 gap-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                                <button
                                    key={day}
                                    onClick={() => toggleDay(idx)}
                                    className={`
                                        p-2 rounded-lg text-sm font-bold border transition-all
                                        ${settings.availability.days.includes(idx)
                                            ? 'bg-teal-500 text-slate-900 border-teal-400'
                                            : 'bg-slate-900 text-slate-500 border-slate-700 hover:border-slate-500'}
                                    `}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-slate-400">Start Time</label>
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
                                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-32"
                                />
                            </div>
                            <span className="pt-5 text-slate-500">to</span>
                            <div className="space-y-1">
                                <label className="text-xs text-slate-400">End Time</label>
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
                                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 w-32"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 3. Meeting Types */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold">Meeting Types</h3>
                            <button
                                onClick={() => setSettings({
                                    ...settings,
                                    meetingTypes: [
                                        ...settings.meetingTypes,
                                        { id: Math.random().toString(36).substr(2, 9), name: 'New Meeting', duration: 30, price: 0 }
                                    ]
                                })}
                                className="text-xs flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <Plus className="w-3 h-3" /> Add Type
                            </button>
                        </div>
                        <div className="space-y-3">
                            {settings.meetingTypes.map((type, idx) => (
                                <div key={type.id} className="flex gap-3 items-center bg-slate-800/30 p-3 rounded-xl border border-slate-800/50">
                                    <input
                                        type="text"
                                        value={type.name}
                                        onChange={(e) => {
                                            const newTypes = [...settings.meetingTypes];
                                            newTypes[idx].name = e.target.value;
                                            setSettings({ ...settings, meetingTypes: newTypes });
                                        }}
                                        className="bg-transparent border-b border-slate-700 focus:border-teal-500 outline-none px-2 py-1 flex-1"
                                        placeholder="Meeting Name"
                                    />
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={type.duration}
                                            onChange={(e) => {
                                                const newTypes = [...settings.meetingTypes];
                                                newTypes[idx].duration = parseInt(e.target.value);
                                                setSettings({ ...settings, meetingTypes: newTypes });
                                            }}
                                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-20 text-center text-sm"
                                        />
                                        <span className="text-xs text-slate-500">min</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newTypes = settings.meetingTypes.filter((_, i) => i !== idx);
                                            setSettings({ ...settings, meetingTypes: newTypes });
                                        }}
                                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-8 mt-4 border-t border-slate-800">
                    <button onClick={onClose} className="flex-1 py-3 text-slate-400 hover:bg-slate-800 rounded-xl font-medium">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </Card>
        </div>
    );
};
