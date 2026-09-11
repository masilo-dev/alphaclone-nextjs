import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext'; // Assuming context exists
import { Save, Plus, Trash2, Clock, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface ScheduleDay {
    day: string; // 'mon', 'tue'...
    slots: { start: string; end: string }[]; // '09:00', '17:00'
    active: boolean;
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<string, string> = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
    fri: 'Friday', sat: 'Saturday', sun: 'Sunday'
};

export default function AvailabilityEditor() {
    const { currentTenant } = useTenant();
    const [loading, setLoading] = useState(true);
    const [scheduleId, setScheduleId] = useState<string | null>(null);

    // State for the weekly schedule
    const [weekSchedule, setWeekSchedule] = useState<Record<string, ScheduleDay>>({
        mon: { day: 'mon', active: true, slots: [{ start: '09:00', end: '17:00' }] },
        tue: { day: 'tue', active: true, slots: [{ start: '09:00', end: '17:00' }] },
        wed: { day: 'wed', active: true, slots: [{ start: '09:00', end: '17:00' }] },
        thu: { day: 'thu', active: true, slots: [{ start: '09:00', end: '17:00' }] },
        fri: { day: 'fri', active: true, slots: [{ start: '09:00', end: '17:00' }] },
        sat: { day: 'sat', active: false, slots: [] },
        sun: { day: 'sun', active: false, slots: [] },
    });

    useEffect(() => {
        if (currentTenant) loadSchedule();
    }, [currentTenant]);

    const loadSchedule = async () => {
        try {
            const { data, error } = await supabase
                .from('availability_schedules')
                .select('*')
                .eq('tenant_id', currentTenant?.id)
                .order('is_default', { ascending: false }) // Prioritize default
                .single();

            if (data) {
                setScheduleId(data.id);
                // Parse JSON back to state
                if (data.schedule_json) {
                    const parsed = data.schedule_json;
                    const newState = { ...weekSchedule };
                    // Merge DB data into state
                    DAYS.forEach(d => {
                        if (parsed[d]) {
                            newState[d] = {
                                day: d,
                                active: parsed[d].length > 0,
                                slots: parsed[d].length > 0 ? parsed[d] : [{ start: '09:00', end: '17:00' }]
                            };
                        } else {
                            newState[d] = { day: d, active: false, slots: [] };
                        }
                    });
                    setWeekSchedule(newState);
                }
            }
        } catch (err) {
            // No schedule found is fine, we use default
        } finally {
            setLoading(false);
        }
    };

    const saveSchedule = async () => {
        if (!currentTenant) return;
        const toastId = toast.loading('Saving availability...');

        try {
            // Convert state to JSON format for DB
            // { mon: [{start...}], tue: [] ... }
            const scheduleJson: Record<string, any[]> = {};

            DAYS.forEach(d => {
                const dayData = weekSchedule[d];
                if (dayData.active && dayData.slots.length > 0) {
                    scheduleJson[d] = dayData.slots;
                } else {
                    scheduleJson[d] = []; // Empty array means closed
                }
            });

            if (scheduleId) {
                // Update
                const { error } = await supabase
                    .from('availability_schedules')
                    .update({
                        schedule_json: scheduleJson,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', scheduleId);
                if (error) throw error;
            } else {
                // Insert
                const { error } = await supabase
                    .from('availability_schedules')
                    .insert({
                        tenant_id: currentTenant.id,
                        name: 'Default Hours',
                        is_default: true,
                        schedule_json: scheduleJson
                    });
                if (error) throw error;
                // Reload to get ID
                loadSchedule();
            }

            toast.success('Availability Updated!', { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error('Failed to save', { id: toastId });
        }
    };

    const toggleDay = (day: string) => {
        setWeekSchedule(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                active: !prev[day].active
            }
        }));
    };

    const updateSlot = (day: string, idx: number, field: 'start' | 'end', value: string) => {
        setWeekSchedule(prev => {
            const newSlots = [...prev[day].slots];
            newSlots[idx] = { ...newSlots[idx], [field]: value };
            return {
                ...prev,
                [day]: { ...prev[day], slots: newSlots }
            };
        });
    };

    /* ... Add/Remove slot logic omitted for brevity, keeping simple mon-fri 9-5 editor first ... */

    if (loading) return <div className="text-slate-500 animate-pulse">Loading schedule...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-teal-500" /> Weekly Hours
                    </h2>
                    <p className="text-sm text-slate-400">Set your standard availability.</p>
                </div>
                <button
                    onClick={saveSchedule}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Save className="w-4 h-4" /> Save Changes
                </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800">
                {DAYS.map(dayKey => {
                    const day = weekSchedule[dayKey];
                    return (
                        <div key={dayKey} className={`p-4 flex flex-col md:flex-row md:items-center gap-4 transition-colors ${day.active ? 'bg-slate-900' : 'bg-slate-950/50'}`}>
                            {/* Checkbox & Label */}
                            <div className="w-32 flex items-center gap-3">
                                <button
                                    onClick={() => toggleDay(dayKey)}
                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${day.active ? 'bg-teal-500 border-teal-500 text-slate-900' : 'border-slate-600 bg-transparent'}`}
                                >
                                    {day.active && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </button>
                                <span className={`font-bold uppercase tracking-wider text-xs ${day.active ? 'text-white' : 'text-slate-500'}`}>
                                    {DAY_LABELS[dayKey]}
                                </span>
                            </div>

                            {/* Logic */}
                            <div className="flex-1">
                                {day.active ? (
                                    <div className="flex flex-col gap-2">
                                        {day.slots.map((slot, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <input
                                                    type="time"
                                                    value={slot.start}
                                                    onChange={e => updateSlot(dayKey, idx, 'start', e.target.value)}
                                                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none"
                                                />
                                                <span className="text-slate-500 text-xs">-</span>
                                                <input
                                                    type="time"
                                                    value={slot.end}
                                                    onChange={e => updateSlot(dayKey, idx, 'end', e.target.value)}
                                                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none"
                                                />
                                                {/* Hidden remove button for later */}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-sm text-slate-600 font-medium italic">Unavailable</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
