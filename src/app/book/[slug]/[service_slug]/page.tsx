'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
    format, addDays, startOfToday, isSameDay, isValid,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, addMonths, subMonths, isBefore, parseISO, getHours
} from 'date-fns';
import {
    Clock, ChevronLeft, ChevronRight, Globe,
    Sun, Moon, Sunset, CheckCircle2, AlertCircle
} from 'lucide-react';
import { tenantService } from '@/services/tenancy/TenantService';
import { Tenant } from '@/services/tenancy/types';
import toast from 'react-hot-toast';

// Types
interface BookingType {
    id: string;
    name: string;
    description: string;
    duration: number;
    price: number;
    currency: string;
}

interface BookingSlot {
    start: string; // ISO
    end: string;   // ISO
}

export default function BookingPage() {
    const params = useParams();
    const router = useRouter();
    const activeSlug = params?.slug as string;
    const serviceSlug = params?.service_slug as string;

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [service, setService] = useState<BookingType | null>(null);

    // Calendar State
    const [currentMonth, setCurrentMonth] = useState<Date>(startOfToday());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Slots State
    const [slots, setSlots] = useState<BookingSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Initialization
    useEffect(() => {
        if (activeSlug && serviceSlug) loadInitialData();
    }, [activeSlug, serviceSlug]);

    const loadInitialData = async () => {
        try {
            // 1. Fetch Tenant
            const t = await tenantService.getTenantBySlug(activeSlug);
            if (!t) throw new Error('Tenant not found');
            setTenant(t);

            // 2. Fetch Service (Booking Type)
            const { data: s, error } = await supabase
                .from('booking_types')
                .select('*')
                .eq('tenant_id', t.id)
                .eq('slug', serviceSlug)
                .single();

            if (error || !s) throw new Error('Service not found');
            setService(s);

        } catch (err) {
            console.error(err);
            toast.error('Failed to load booking details');
        }
    };

    // Load Slots when Date Changes
    useEffect(() => {
        if (selectedDate && tenant && service) {
            fetchSlots(selectedDate);
        } else {
            setSlots([]);
        }
    }, [selectedDate, tenant, service]);

    const fetchSlots = async (date: Date) => {
        setLoadingSlots(true);
        try {
            // TODO: Replace with real RPC or server-side logic
            // Ideally: fetch(`/api/booking/slots?date=${...}&type=${service.id}`)

            // MOCK LOGIC FOR UI DEV
            // Generate some random slots for now to prove UI works
            await new Promise(r => setTimeout(r, 600)); // Fake latency

            const mockSlots: BookingSlot[] = [];
            const startHour = 9;
            const endHour = 17;
            const duration = service?.duration || 30;

            // Generate slots every [duration] minutes
            let current = new Date(date);
            current.setHours(startHour, 0, 0, 0);

            const end = new Date(date);
            end.setHours(endHour, 0, 0, 0);

            while (current < end) {
                // Randomly skip some to simulate busy
                if (Math.random() > 0.3) {
                    mockSlots.push({
                        start: current.toISOString(),
                        end: new Date(current.getTime() + duration * 60000).toISOString()
                    });
                }
                current = new Date(current.getTime() + duration * 60000);
            }

            setSlots(mockSlots);
        } catch (err) {
            toast.error('Could not load availability');
        } finally {
            setLoadingSlots(false);
        }
    };

    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenant || !service || !selectedSlot) return;
        setSubmitting(true);

        try {
            // Insert into 'bookings' table directly (since we have public insert policy)
            // Or use API route for emails etc.
            // Using API route is better for side-effects (emails, calendar sync).

            // For now, let's try direct Supabase insert to verify Schema
            const { error } = await supabase.from('bookings').insert({
                tenant_id: tenant.id,
                booking_type_id: service.id,
                client_name: formData.name,
                client_email: formData.email,
                client_phone: formData.phone,
                client_notes: formData.notes,
                start_time: selectedSlot.start,
                end_time: selectedSlot.end,
                status: 'confirmed',
                metadata: { source: 'web_booking_v3' }
            });

            if (error) throw error;
            setSuccess(true);
        } catch (err) {
            console.error(err);
            toast.error('Booking failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // --- Helpers ---
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentMonth]);

    const groupedSlots = useMemo(() => {
        const groups = {
            morning: [] as BookingSlot[],
            afternoon: [] as BookingSlot[],
            evening: [] as BookingSlot[]
        };

        slots.forEach(slot => {
            const hour = getHours(parseISO(slot.start));
            if (hour < 12) groups.morning.push(slot);
            else if (hour < 17) groups.afternoon.push(slot);
            else groups.evening.push(slot);
        });

        return groups;
    }, [slots]);

    // --- Loading / Error States ---
    if (!tenant || !service) return <div className="h-screen bg-[#050505] flex items-center justify-center text-slate-500 animate-pulse">Loading...</div>;

    // --- Success View ---
    if (success) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-slate-900/50 border border-teal-500/30 rounded-[2rem] p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/20 blur-[50px] rounded-full"></div>
                    <div className="w-20 h-20 bg-teal-500/20 text-teal-400 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-xl shadow-teal-500/10">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2">Confirmed!</h2>
                    <p className="text-slate-400 mb-8">You are booked with {tenant.name}.</p>

                    <div className="bg-slate-950 p-6 rounded-2xl mb-8 border border-white/5">
                        <div className="text-white font-bold text-lg mb-1">{service.name}</div>
                        <div className="text-teal-400 text-sm font-bold uppercase tracking-wider">
                            {format(parseISO(selectedSlot!.start), 'EEEE, MMMM do @ h:mm a')}
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setSuccess(false);
                            setSelectedSlot(null);
                            setSelectedDate(null);
                        }}
                        className="text-slate-500 hover:text-white text-sm font-bold uppercase tracking-widest transition-colors"
                    >
                        Book Another
                    </button>
                </div>
            </div>
        );
    }

    const isDateSelected = !!selectedDate;
    const isSlotSelected = !!selectedSlot;

    // --- Main Render ---
    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 lg:p-12 relative flex items-center justify-center">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-500/5 blur-[100px] rounded-full"></div>
            </div>

            <div className={`w-full max-w-7xl grid transition-all duration-700 gap-8 ${isSlotSelected ? 'lg:grid-cols-12' : 'lg:grid-cols-12'}`}>

                {/* 1. Sidebar (Service Info) */}
                <div className={`${isSlotSelected ? 'lg:col-span-4 lg:opacity-50' : 'lg:col-span-4'} flex flex-col gap-6 lg:border-r lg:border-white/5 lg:pr-8`}>
                    <button onClick={() => router.back()} className="self-start text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-white transition-colors mb-4">
                        ← Back
                    </button>

                    <div>
                        <div className="flex items-center gap-4 mb-6">
                            {tenant.settings.branding?.logo ? (
                                <img src={tenant.settings.branding.logo} className="w-16 h-16 rounded-2xl object-cover" />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center font-black text-2xl text-slate-600">
                                    {tenant.name[0]}
                                </div>
                            )}
                            <div>
                                <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{tenant.name}</div>
                                <h1 className="text-2xl font-black">{service.name}</h1>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-6">
                            <span className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-slate-300 flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-teal-500" /> {service.duration} mins
                            </span>
                            {service.price > 0 && (
                                <span className="px-3 py-1 bg-white/5 rounded-full text-xs font-bold text-emerald-400">
                                    {service.currency} {service.price}
                                </span>
                            )}
                        </div>

                        <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-line">
                            {service.description}
                        </p>
                    </div>
                </div>

                {/* 2. Calendar & Slots */}
                <div className={`${isSlotSelected ? 'hidden lg:block lg:col-span-4' : 'lg:col-span-8'} transition-all`}>
                    <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-6 backdrop-blur-xl">
                        {/* Month Nav */}
                        <div className="flex items-center justify-between mb-8 px-2">
                            <h2 className="text-lg font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
                            <div className="flex gap-1">
                                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-white/5 rounded-full text-slate-400"><ChevronLeft className="w-5 h-5" /></button>
                                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-white/5 rounded-full text-slate-400"><ChevronRight className="w-5 h-5" /></button>
                            </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-y-4 mb-8 text-center">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="text-[10px] font-black text-slate-600">{d}</div>)}
                            {calendarDays.map(day => {
                                const isCurrentMonth = isSameMonth(day, currentMonth);
                                const isSelected = selectedDate && isSameDay(day, selectedDate);
                                const isPast = isBefore(day, startOfToday());

                                return (
                                    <button
                                        key={day.toISOString()}
                                        disabled={isPast || !isCurrentMonth}
                                        onClick={() => setSelectedDate(day)}
                                        className={`
                                            h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm font-bold transition-all
                                            ${!isCurrentMonth ? 'opacity-0' : ''}
                                            ${isPast ? 'text-slate-800 decoration-slate-800 line-through' : ''}
                                            ${isSelected ? 'bg-teal-500 text-slate-950 scale-110 shadow-lg shadow-teal-500/20' : 'text-slate-300 hover:bg-white/10'}
                                        `}
                                    >
                                        {format(day, 'd')}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex justify-center items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            <Globe className="w-3 h-3" /> {Intl.DateTimeFormat().resolvedOptions().timeZone}
                        </div>
                    </div>

                    {/* Mobile Only Slot View (If date selected but no slot) */}
                    {isDateSelected && !isSlotSelected && (
                        <div className="mt-6 block lg:hidden">
                            <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-wider">Available Times</h3>
                            <SlotsList
                                loading={loadingSlots}
                                slots={groupedSlots}
                                onSelect={setSelectedSlot}
                            />
                        </div>
                    )}
                </div>

                {/* 3. Slot List (Desktop) OR Form (Both) */}
                <div className={`${isSlotSelected ? 'lg:col-span-4' : 'hidden lg:block lg:col-span-0 opacity-0'} transition-all`}>

                    {!isSlotSelected ? (
                        // Desktop Slot Picker
                        isDateSelected && (
                            <div className="h-full border-l border-white/5 pl-8 animate-in fade-in slide-in-from-right-8 duration-500">
                                <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-wider">
                                    {format(selectedDate!, 'EEEE, MMM do')}
                                </h3>
                                <SlotsList
                                    loading={loadingSlots}
                                    slots={groupedSlots}
                                    onSelect={setSelectedSlot}
                                />
                            </div>
                        )
                    ) : (
                        // Booking Form
                        <div className="bg-slate-900 border border-white/5 rounded-[2rem] p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-8 duration-500 shadow-2xl">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Selected Time</div>
                                    <div className="text-xl font-black text-white">{format(parseISO(selectedSlot.start), 'h:mm a')}</div>
                                    <div className="text-sm text-teal-400 font-bold">{format(parseISO(selectedSlot.start), 'MMMM do, yyyy')}</div>
                                </div>
                                <button onClick={() => setSelectedSlot(null)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white">
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleBook} className="space-y-4">
                                <Input label="Full Name" value={formData.name} onChange={v => setFormData({ ...formData, name: v })} required />
                                <Input label="Email Address" type="email" value={formData.email} onChange={v => setFormData({ ...formData, email: v })} required />
                                <Input label="Phone Number" type="tel" value={formData.phone} onChange={v => setFormData({ ...formData, phone: v })} />

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">Notes</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-teal-500 focus:outline-none transition-colors min-h-[100px] resize-none"
                                        placeholder="Optional..."
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black uppercase tracking-widest text-xs rounded-xl transition-all active:scale-95 disabled:opacity-50 mt-4"
                                >
                                    {submitting ? 'Confirming...' : 'Confirm Booking'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

// --- Sub Components ---

function SlotsList({ slots, loading, onSelect }: { slots: any, loading: boolean, onSelect: (s: BookingSlot) => void }) {
    if (loading) return <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>;

    // Check if empty
    if (!slots.morning.length && !slots.afternoon.length && !slots.evening.length) {
        return <div className="text-center text-slate-500 text-sm py-12">No available times.</div>;
    }

    return (
        <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {['morning', 'afternoon', 'evening'].map(period => {
                const periodSlots = slots[period as keyof typeof slots];
                if (!periodSlots.length) return null;

                return (
                    <div key={period} className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                            {period === 'morning' && <Sun className="w-3 h-3 text-orange-400" />}
                            {period === 'afternoon' && <Sunset className="w-3 h-3 text-pink-400" />}
                            {period === 'evening' && <Moon className="w-3 h-3 text-indigo-400" />}
                            {period}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-2">
                            {periodSlots.map((slot: BookingSlot, idx: number) => (
                                <button
                                    key={idx}
                                    onClick={() => onSelect(slot)}
                                    className="py-3 px-2 bg-white/5 border border-white/5 hover:border-teal-500 hover:bg-teal-500/10 rounded-xl text-teal-400 text-xs font-bold transition-all text-center active:scale-95"
                                >
                                    {format(parseISO(slot.start), 'h:mm a')}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

interface InputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    required?: boolean;
}

function Input({ label, value, onChange, type = 'text', required = false }: InputProps) {
    return (
        <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider ml-1">{label}</label>
            <input
                type={type}
                required={required}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-teal-500 focus:outline-none transition-colors font-bold"
            />
        </div>
    );
}
