'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { bookingService, BookingSlot } from '@/services/bookingService';
import { Tenant } from '@/services/tenancy/types';
import { Card } from '@/components/ui/UIComponents';
import {
    format, addDays, startOfToday, isSameDay, isValid,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, addMonths, subMonths, isBefore
} from 'date-fns';
import { safeFormat } from '@/utils/dateUtils';
import { Clock, Calendar as CalendarIcon, CheckSquare, Plus, AlertCircle, User, LayoutGrid, ChevronLeft, ChevronRight, ArrowRight, Check, FileText, Globe } from 'lucide-react';

export default function BookingSlotPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params?.slug as string;
    const typeId = params?.typeId as string;

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [currentMonth, setCurrentMonth] = useState<Date>(startOfToday());
    const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
    const [slots, setSlots] = useState<BookingSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [topic, setTopic] = useState('');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (slug) loadProfile();
    }, [slug]);

    useEffect(() => {
        if (tenant && selectedDate) {
            loadSlots();
        }
    }, [tenant, selectedDate]);

    const loadProfile = async () => {
        const { tenant, error } = await bookingService.getBookingProfile(slug);
        if (error) setError(error);
        else setTenant(tenant);
    };

    const loadSlots = async () => {
        if (!tenant || !tenant.settings.booking) return;

        const meetingType = tenant.settings.booking.meetingTypes.find(t => t.id === typeId);
        if (!meetingType) return;

        setLoadingSlots(true);
        const { slots, error } = await bookingService.getAvailableSlots(
            tenant.id,
            format(selectedDate, 'yyyy-MM-dd'),
            meetingType.duration
        );

        if (error) {
            console.error('[BookingSlotPage] Error loading slots:', error);
        }

        setSlots(slots || []);
        setLoadingSlots(false);
        setSelectedSlot(null); // Reset selection
    };

    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenant || !selectedSlot) return;

        setSubmitting(true);
        try {
            const { bookingId, error } = await bookingService.createBooking(
                tenant.id,
                typeId,
                selectedSlot.start,
                { name, email, phone, topic, notes }
            );

            if (error) throw new Error(error);
            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Booking failed');
        } finally {
            setSubmitting(false);
        }
    };

    // Calendar Grid Logic
    const calendarDays = React.useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [currentMonth]);

    const previousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    // Render loading/error states...
    if (!tenant) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    const meetingType = tenant.settings.booking?.meetingTypes.find(t => t.id === typeId);
    if (!meetingType) return <div className="p-12 text-center text-red-400">Invalid Meeting Type</div>;

    if (success) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <Card className="max-w-md w-full p-8 text-center space-y-6 border-emerald-500/30 bg-emerald-900/10">
                    <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto text-3xl">
                        ✓
                    </div>
                    <h2 className="text-2xl font-bold text-white">Booking Confirmed!</h2>
                    <p className="text-slate-300">
                        You are scheduled with <b>{tenant.name}</b> for <b>{meetingType.name}</b>.
                    </p>
                    <div className="bg-slate-900/50 p-4 rounded-lg text-sm text-slate-400">
                        {safeFormat(selectedSlot!.start, 'EEEE, MMMM do yyyy')} <br />
                        {safeFormat(selectedSlot!.start, 'h:mm a')} - {safeFormat(selectedSlot!.end, 'h:mm a')}
                    </div>
                    <p className="text-xs text-slate-500">A calendar invitation and video link has been sent to {email}.</p>
                    <button
                        onClick={() => router.push(`/book/${slug}`)}
                        className="text-teal-400 hover:text-teal-300 text-sm font-medium"
                    >
                        Book Another Meeting
                    </button>
                </Card>
            </div>
        );
    }

    const isCompact = !!selectedSlot;

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 md:p-12 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 blur-[120px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-violet-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className={`max-w-7xl mx-auto grid ${isCompact ? 'lg:grid-cols-12 gap-8' : 'lg:grid-cols-12 gap-12'} relative z-10 transition-all duration-700`}>
                {/* 1. Profile Sidebar */}
                <div className={`${isCompact ? 'lg:col-span-3 lg:opacity-60' : 'lg:col-span-4'} space-y-4 md:space-y-8 animate-in fade-in slide-in-from-left-4 duration-700 transition-all`}>
                    <button
                        onClick={() => router.push(`/book/${slug}`)}
                        className="flex items-center gap-2 text-slate-500 hover:text-white text-xs font-black uppercase tracking-widest group transition-all"
                    >
                        <span className="group-hover:-translate-x-1 transition-transform">←</span> BACK TO SECTORS
                    </button>

                    <div className="space-y-6">
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-violet-500 rounded-3xl blur opacity-20"></div>
                            {tenant.settings.branding?.logo ? (
                                <img src={tenant.settings.branding.logo} className={`${isCompact ? 'w-12 h-12 rounded-2xl' : 'w-20 h-20 rounded-3xl'} object-cover border border-white/10 relative z-10 p-1 bg-slate-900 transition-all duration-500`} />
                            ) : (
                                <div className={`${isCompact ? 'w-12 h-12 rounded-2xl' : 'w-20 h-20 rounded-3xl'} bg-slate-900 border border-white/10 flex items-center justify-center relative z-10 transition-all duration-500`}>
                                    <span className={`${isCompact ? 'text-lg' : 'text-2xl'} font-black text-white/20`}>{tenant.name.charAt(0)}</span>
                                </div>
                            )}
                        </div>

                        <div>
                            <h2 className="text-teal-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-60">Unit Deployment</h2>
                            <h1 className={`${isCompact ? 'text-xl md:text-2xl' : 'text-3xl md:text-5xl'} font-black tracking-tighter text-white mb-3 md:mb-4 leading-none transition-all duration-500`}>{meetingType.name}</h1>
                            <div className="flex flex-wrap items-center gap-2 md:gap-3">
                                <span className="px-2 py-0.5 md:px-3 md:py-1 bg-white/5 border border-white/10 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 md:gap-2">
                                    <Clock className="w-2.5 h-2.5 md:w-3 md:h-3 text-teal-400" /> {meetingType.duration} MIN
                                </span>
                                <span className="px-2 py-0.5 md:px-3 md:py-1 bg-white/5 border border-white/10 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 md:gap-2">
                                    <Globe className="w-2.5 h-2.5 md:w-3 md:h-3 text-teal-400" /> GLOBAL
                                </span>
                            </div>
                        </div>

                        {!isCompact && (
                            <div className="glass-panel p-6 rounded-[2rem] border border-white/5 bg-slate-900/40 backdrop-blur-3xl animate-in fade-in duration-500">
                                <p className="text-slate-400 text-sm leading-relaxed font-medium italic">
                                    "{meetingType.description || 'Initialize a high-impact session with our lead strategists to accelerate your project trajectory.'}"
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Selection Area (Calendar + Slots) */}
                <div className={`${isCompact ? 'lg:col-span-9' : 'lg:col-span-8'} flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-right-4 duration-700 delay-200 transition-all`}>
                    <div className={`glass-panel ${isCompact ? 'p-6' : 'p-8 md:p-10'} rounded-[2.5rem] md:rounded-[3rem] border border-white/5 bg-slate-900/40 backdrop-blur-3xl transition-all duration-500`}>

                        {!selectedSlot ? (
                            <div className="grid lg:grid-cols-2 gap-12">
                                {/* Calendar Column */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Select Date</h3>
                                        <div className="flex gap-2">
                                            <button onClick={previousMonth} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors">
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <span className="text-sm font-bold text-slate-300 w-32 text-center">
                                                {format(currentMonth, 'MMMM yyyy')}
                                            </span>
                                            <button onClick={nextMonth} className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors">
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-7 gap-y-4 gap-x-1 sm:gap-x-2 text-center">
                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                                            <div key={d} className="text-[10px] font-black text-slate-600 flex justify-center items-center">{d}</div>
                                        ))}
                                        {calendarDays.map((day, idx) => {
                                            const isToday = isSameDay(day, startOfToday());
                                            const isSelected = isSameDay(day, selectedDate);
                                            const isCurrentMonth = isSameMonth(day, currentMonth);
                                            const isPast = isBefore(day, startOfToday());

                                            return (
                                                <button
                                                    key={day.toISOString()}
                                                    disabled={isPast}
                                                    onClick={() => setSelectedDate(day)}
                                                    className={`
                                                        h-10 w-10 mx-auto rounded-full flex items-center justify-center text-xs font-bold transition-all relative
                                                        ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : ''}
                                                        ${isPast ? 'text-slate-800 cursor-not-allowed line-through decoration-slate-800' : ''}
                                                        ${isSelected
                                                            ? 'bg-teal-500 text-slate-900 shadow-lg shadow-teal-500/20 scale-110'
                                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'}
                                                        ${isToday && !isSelected ? 'border border-teal-500/50 text-teal-500' : ''}
                                                    `}
                                                >
                                                    {format(day, 'd')}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Slots Column */}
                                <div className="space-y-6 lg:border-l lg:border-white/5 lg:pl-12">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                                            Availability
                                        </h3>
                                        {loadingSlots && <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></div>}
                                    </div>

                                    <p className="text-sm font-medium text-white">
                                        {format(selectedDate, 'EEEE, MMMM do')}
                                    </p>

                                    {slots.length === 0 && !loadingSlots ? (
                                        <div className="py-12 text-center">
                                            <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">No slots available</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {slots.map((slot, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setSelectedSlot(slot)}
                                                    className="py-3 px-4 bg-white/5 border border-white/5 hover:border-teal-500/50 hover:bg-teal-500/10 rounded-xl text-teal-400 text-xs font-bold transition-all text-center"
                                                >
                                                    {safeFormat(slot.start, 'h:mm a')}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                                <div className="flex items-center justify-between mb-8">
                                    <button
                                        onClick={() => setSelectedSlot(null)}
                                        className="text-xs font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
                                    >
                                        ← Change Time
                                    </button>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-white">{format(selectedDate, 'MMMM do')}</div>
                                        <div className="text-xs font-black text-teal-500 uppercase tracking-widest">
                                            {safeFormat(selectedSlot.start, 'h:mm a')}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                                    <h3 className="text-2xl md:text-3xl font-black text-white tracking-tighter">Initialize Link</h3>
                                    <div className="flex -space-x-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-600 uppercase">ID</div>
                                        ))}
                                    </div>
                                </div>

                                <form onSubmit={handleBook} className="space-y-6">
                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Full Name</label>
                                            <input required type="text" className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-teal-500/50 outline-none transition-all font-bold placeholder:text-slate-800" placeholder="Enter full legal name" value={name} onChange={e => setName(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Email Endpoint</label>
                                            <input required type="email" className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-teal-500/50 outline-none transition-all font-bold placeholder:text-slate-800" placeholder="Enter secure email address" value={email} onChange={e => setEmail(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Mobile Uplink</label>
                                            <input required type="tel" className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-teal-500/50 outline-none transition-all font-bold placeholder:text-slate-800" placeholder="+1 (555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Primary Objective</label>
                                            <input required type="text" className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-teal-500/50 outline-none transition-all font-bold placeholder:text-slate-800" placeholder="Define mission focus..." value={topic} onChange={e => setTopic(e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">Extended Intel (Optional)</label>
                                        <textarea className="w-full bg-white/5 border border-white/5 rounded-2xl px-6 py-4 text-white focus:ring-2 focus:ring-teal-500/50 outline-none transition-all font-bold placeholder:text-slate-800 min-h-[120px] resize-none" placeholder="Provide additional context..." value={notes} onChange={e => setNotes(e.target.value)} />
                                    </div>

                                    {error && (
                                        <div className="p-4 bg-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-red-500/20 animate-pulse">
                                            Protocol Failure: {error}
                                        </div>
                                    )}

                                    <button type="submit" disabled={submitting} className="w-full py-6 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-slate-900 font-black text-xs uppercase tracking-[0.3em] rounded-2xl transition-all shadow-2xl shadow-teal-500/20 active:scale-95 disabled:opacity-50">
                                        {submitting ? 'PROCESSING PROTOCOL...' : 'CONFIRM UNIT DEPLOYMENT'}
                                    </button>
                                </form>
                            </div>
                        )}

                    </div>

                    <div className="text-center opacity-20 hover:opacity-100 transition-opacity">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em]">Encrypted Session Initialization Protocol Alpha-9</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
