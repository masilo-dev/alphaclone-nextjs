'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchBookingData, BookingType } from '@/actions/booking';
import {
    format, addDays, startOfToday, isSameDay, isValid,
    startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, addMonths, subMonths, isBefore, parseISO, getHours, set
} from 'date-fns';
import {
    Clock, ChevronLeft, ChevronRight, Globe,
    CheckCircle2, AlertCircle, Calendar, User, ArrowLeft, Phone, Mail
} from 'lucide-react';
import { Tenant } from '@/services/tenancy/types';
import { bookingService, BookingSlot } from '@/services/bookingService';
import toast from 'react-hot-toast';

// Redundant local interface removed. Using imported BookingSlot from @/services/bookingService.

type Step = 'date' | 'time' | 'form' | 'success';

export default function BookingPage() {
    const params = useParams();
    const router = useRouter();
    const activeSlug = params?.slug as string;
    const serviceSlug = params?.service_slug as string;

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [service, setService] = useState<BookingType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Flow State
    const [step, setStep] = useState<Step>('date');

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
    const [bookingSuccess, setBookingSuccess] = useState<{ date: Date; time: string; url: string } | null>(null);

    // Logic Settings (Defaults)
    const bufferTime = tenant?.settings.booking?.bufferTime || 15;
    const minNotice = tenant?.settings.booking?.minNotice || 4;
    const futureLimit = tenant?.settings.booking?.futureLimit || 60;

    // --- Data Loading ---
    useEffect(() => {
        if (activeSlug && serviceSlug) loadInitialData();
    }, [activeSlug, serviceSlug]);

    const loadInitialData = async () => {
        try {
            const { tenant, service } = await fetchBookingData(activeSlug, serviceSlug);
            setTenant(tenant);
            setService(service);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to load booking details');
        } finally {
            setLoading(false);
        }
    };

    // --- Slot Fetching ---
    useEffect(() => {
        if (selectedDate && tenant && service) {
            fetchSlots(selectedDate);
            // On mobile, moving to date select doesn't auto-advance, user taps slot later
            // On desktop, we show slots side-by-side
        } else {
            setSlots([]);
        }
    }, [selectedDate, tenant, service]);

    const fetchSlots = async (date: Date) => {
        if (!tenant?.id || !service?.id) return;
        setLoadingSlots(true);
        try {
            const dateStr = format(date, 'yyyy-MM-dd');
            const { slots: fetchedSlots, error } = await bookingService.getAvailableSlots(
                tenant.id,
                dateStr,
                service.duration || 30
            );

            if (error) {
                toast.error(error);
                setSlots([]);
            } else {
                setSlots(fetchedSlots);
            }
        } catch (err) {
            toast.error('Could not load availability');
        } finally {
            setLoadingSlots(false);
        }
    };

    const handleSlotSelect = (slot: BookingSlot) => {
        setSelectedSlot(slot);
        if (window.innerWidth < 1024) {
            setStep('form'); // Mobile auto-advance
        }
    };

    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSlot || !tenant || !service) return;

        setSubmitting(true);
        try {
            const { bookingId, error: bookingError } = await bookingService.createBooking(
                tenant.id,
                service.id,
                selectedSlot.start,
                selectedSlot.end,
                {
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    notes: formData.notes
                }
            );

            if (bookingError) throw new Error(bookingError);

            setBookingSuccess({
                date: parseISO(selectedSlot.start),
                time: format(parseISO(selectedSlot.start), 'h:mm a'),
                url: `/meet/active` // Placeholder, will be updated by server response if possible
            });
            setStep('success');
            toast.success('Confirmed!');
        } catch (err: any) {
            toast.error(err.message || 'Booking failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // --- Render Helpers ---
    const calendarDays = useMemo(() => eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth)),
        end: endOfWeek(endOfMonth(currentMonth))
    }), [currentMonth]);

    if (loading) return <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-900 dark:border-white border-t-transparent rounded-full animate-spin"></div></div>;
    if (error || !tenant || !service) return <div className="min-h-screen flex items-center justify-center text-red-500">{error || 'Not found'}</div>;

    // Success View
    if (step === 'success' && bookingSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xl animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Booking Confirmed</h1>
                    <p className="text-slate-500 mb-8">We've sent a calendar invite to {formData.email}</p>

                    <div className="bg-slate-50 dark:bg-slate-950 rounded-xl p-6 mb-6 text-left border border-slate-100 dark:border-slate-800 space-y-4">
                        <div className="flex justify-between">
                            <span className="text-sm font-medium text-slate-500">Service</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{service.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm font-medium text-slate-500">Date</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{format(bookingSuccess.date, 'MMM do, yyyy')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm font-medium text-slate-500">Time</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">{bookingSuccess.time}</span>
                        </div>
                    </div>

                    {bookingSuccess.url && (
                        <a href={bookingSuccess.url} target="_blank" className="block w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl mb-3 hover:opacity-90 transition-opacity">
                            Join Meeting
                        </a>
                    )}
                    <button onClick={() => window.location.reload()} className="text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                        Book Another
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans selection:bg-teal-500/30">
            {/* Header / Nav */}
            <div className="max-w-6xl mx-auto p-4 md:p-8">
                <button
                    onClick={() => {
                        if (step === 'form') setStep('date');
                        else router.back();
                    }}
                    className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {step === 'form' ? 'Back to Calendar' : 'Back'}
                </button>

                <div className="grid lg:grid-cols-12 gap-8 lg:gap-16">

                    {/* LEFT PANEL: Context */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="flex items-start gap-4">
                            {tenant.settings.branding?.logo ? (
                                <img src={tenant.settings.branding.logo} className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-xl font-bold text-slate-400">
                                    {tenant.name[0]}
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-medium text-slate-500">{tenant.name}</p>
                                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">{service.name}</h1>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                                <Clock className="w-5 h-5 text-slate-900 dark:text-white" />
                                {service.duration} min
                            </div>
                            {service.price > 0 && (
                                <div className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-400">
                                    <div className="w-5 h-5 flex items-center justify-center font-bold text-slate-900 dark:text-white">$</div>
                                    {service.currency} {service.price}
                                </div>
                            )}
                        </div>

                        {service.description && (
                            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-6">
                                {service.description}
                            </p>
                        )}

                        {/* Desktop: Selected Slot Preview */}
                        {selectedSlot && window.innerWidth >= 1024 && (
                            <div className="mt-8 p-4 bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 rounded-xl">
                                <div className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider mb-1">Selected Time</div>
                                <div className="font-semibold text-teal-900 dark:text-teal-100">
                                    {format(parseISO(selectedSlot.start), 'EEEE, MMMM do')}
                                    <br />
                                    {format(parseISO(selectedSlot.start), 'h:mm a')}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT PANEL: Interaction Area */}
                    <div className="lg:col-span-8">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none min-h-[500px]">

                            {/* STEP: DATE & TIME */}
                            {step === 'date' && (
                                <div className="flex flex-col md:flex-row gap-8 h-full">
                                    {/* Calendar */}
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-6">
                                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                                {format(currentMonth, 'MMMM yyyy')}
                                            </h2>
                                            <div className="flex gap-1">
                                                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                                                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"><ChevronRight className="w-5 h-5" /></button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-7 gap-y-2 text-center mb-2">
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="text-[10px] font-bold text-slate-400 uppercase">{d}</div>)}
                                        </div>
                                        <div className="grid grid-cols-7 gap-y-2">
                                            {calendarDays.map((day, i) => {
                                                const isCurrentMonth = isSameMonth(day, currentMonth);
                                                const isPast = isBefore(day, startOfToday());
                                                const isSelected = selectedDate && isSameDay(day, selectedDate);
                                                return (
                                                    <button
                                                        key={i}
                                                        disabled={isPast || !isCurrentMonth}
                                                        onClick={() => setSelectedDate(day)}
                                                        className={`
                                                            h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm font-medium transition-all
                                                            ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : ''}
                                                            ${isPast ? 'text-slate-300 dark:text-slate-700 line-through decoration-slate-300' : ''}
                                                            ${isSelected
                                                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold scale-110'
                                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}
                                                        `}
                                                    >
                                                        {format(day, 'd')}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-950/50 py-2 rounded-lg">
                                            <Globe className="w-3.5 h-3.5" />
                                            {Intl.DateTimeFormat().resolvedOptions().timeZone}
                                        </div>
                                    </div>

                                    {/* Slots Column (Desktop: Side / Mobile: Below) */}
                                    <div className={`md:w-64 md:border-l border-slate-200 dark:border-slate-800 md:pl-8 ${!selectedDate ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider">
                                            {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select date'}
                                        </h3>

                                        {loadingSlots ? (
                                            <div className="space-y-3">
                                                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}
                                            </div>
                                        ) : slots.length === 0 ? (
                                            <div className="text-sm text-slate-500 py-4">No availability for this day.</div>
                                        ) : (
                                            <div className="space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {slots.map((slot, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            async function handleDesktopClick() {
                                                                setSelectedSlot(slot);
                                                                // On desktop, we stay here but update selection state, 
                                                                // actually let's move to form on desktop too for simplicity?
                                                                // The user asked for "Simple". Simple = Step by Step is often clearer.
                                                                // But commonly desktop allows seeing both.
                                                                // Let's optimize: Mobile -> Auto-advance. Desktop -> Show "Next" button or Auto-Advance?
                                                                // Let's Auto-Advance on both for immediate feedback.
                                                                setStep('form');
                                                            }
                                                            handleDesktopClick();
                                                        }}
                                                        className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-900 dark:hover:border-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex justify-between group"
                                                    >
                                                        {format(parseISO(slot.start), 'h:mm a')}
                                                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* STEP: FORM */}
                            {step === 'form' && selectedSlot && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-300">
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Final Details</h2>
                                        <p className="text-slate-500 text-sm">Please fill in your information to complete the booking.</p>
                                    </div>

                                    <form onSubmit={handleBook} className="space-y-5">
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Full Name</label>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input
                                                        required
                                                        value={formData.name}
                                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                                        placeholder="John Doe"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Email Address</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input
                                                        required
                                                        type="email"
                                                        value={formData.email}
                                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                                        placeholder="john@example.com"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Phone (Optional)</label>
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input
                                                        type="tel"
                                                        value={formData.phone}
                                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all"
                                                        placeholder="+1 (555) 000-0000"
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Notes</label>
                                                <textarea
                                                    rows={3}
                                                    value={formData.notes}
                                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all resize-none"
                                                    placeholder="Anything we should know?"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full py-4 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 text-white dark:text-slate-950 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                        >
                                            {submitting ? 'Confirming...' : 'Confirm Booking'}
                                        </button>
                                    </form>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
