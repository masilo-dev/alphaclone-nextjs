'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { bookingService, BookingSlot } from '@/services/bookingService';
import { Tenant } from '@/services/tenancy/types';
import { Card } from '@/components/ui/UIComponents';
import { format, addDays, startOfToday, isSameDay } from 'date-fns';

export default function BookingSlotPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params?.slug as string;
    const typeId = params?.typeId as string;

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
    const [slots, setSlots] = useState<BookingSlot[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
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

        if (error) console.error(error); // Don't show critical error for no slots, just empty
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
                { name, email, notes }
            );

            if (error) throw new Error(error);
            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Booking failed');
        } finally {
            setSubmitting(false);
        }
    };

    // Render loading/error states...
    if (!tenant) return <div className="p-12 text-center text-slate-400">Loading...</div>;

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
                        {format(new Date(selectedSlot!.start), 'EEEE, MMMM do yyyy')} <br />
                        {format(new Date(selectedSlot!.start), 'h:mm a')} - {format(new Date(selectedSlot!.end), 'h:mm a')}
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

    // Generate next 7 days for quick picker
    const nextDays = Array.from({ length: 7 }).map((_, i) => addDays(startOfToday(), i));

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12">
            <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">

                {/* Sidebar Info */}
                <div className="md:col-span-1 space-y-6">
                    <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm">
                        ← Back
                    </button>
                    <div>
                        <h2 className="text-slate-400 text-sm uppercase tracking-wider mb-2">Scheduling</h2>
                        <h1 className="text-3xl font-bold mb-2">{meetingType.name}</h1>
                        <div className="flex items-center gap-2 text-slate-400">
                            <span>⏱ {meetingType.duration} min</span>
                            <span>•</span>
                            <span>🎥 Video Call</span>
                        </div>
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed">
                        {meetingType.description}
                    </p>
                    {tenant.settings.branding?.logo && (
                        <div className="pt-6 border-t border-slate-800">
                            <div className="flex items-center gap-3">
                                <img src={tenant.settings.branding.logo} className="w-10 h-10 rounded-full" />
                                <span className="font-medium text-slate-300">{tenant.name}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content */}
                <Card className="md:col-span-2 p-6 md:p-8 bg-slate-900 border-slate-800">
                    <div className="space-y-8">

                        {/* 1. Date Picker (Horizontal) */}
                        <div className="space-y-4">
                            <h3 className="tex-sm font-medium text-slate-300">Select Date</h3>
                            <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-thin scrollbar-thumb-slate-700">
                                {nextDays.map(date => {
                                    const isSelected = isSameDay(date, selectedDate);
                                    return (
                                        <button
                                            key={date.toISOString()}
                                            onClick={() => setSelectedDate(date)}
                                            className={`
                                                flex flex-col items-center justify-center min-w-[4.5rem] p-3 rounded-xl border transition-all
                                                ${isSelected
                                                    ? 'bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-900/20'
                                                    : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800'}
                                            `}
                                        >
                                            <span className="text-xs uppercase font-bold">{format(date, 'EEE')}</span>
                                            <span className="text-xl font-bold">{format(date, 'd')}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. Slot Picker */}
                        <div className="space-y-4">
                            <h3 className="tex-sm font-medium text-slate-300">Available Times</h3>
                            {loadingSlots ? (
                                <div className="h-20 flex items-center justify-center text-slate-500">Check availability...</div>
                            ) : slots.length === 0 ? (
                                <div className="text-center p-6 bg-slate-800/30 rounded-lg text-slate-500 text-sm">
                                    No slots available on this date.
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {slots.map((slot, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`
                                                py-2 px-3 rounded-lg text-sm font-medium transition-all border
                                                ${selectedSlot === slot
                                                    ? 'bg-white text-slate-900 border-white'
                                                    : 'bg-slate-800 text-teal-400 border-slate-700 hover:border-teal-500/50 hover:bg-slate-800/80'}
                                            `}
                                        >
                                            {format(new Date(slot.start), 'h:mm a')}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 3. Details Form (Shows when slot selected) */}
                        {selectedSlot && (
                            <div className="pt-8 border-t border-slate-800 animate-in fade-in slide-in-from-top-4 duration-300">
                                <h3 className="text-lg font-bold mb-6">Enter Details</h3>
                                <form onSubmit={handleBook} className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400">Your Name</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs text-slate-400">Email Address</label>
                                            <input
                                                required
                                                type="email"
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                                                value={email}
                                                onChange={e => setEmail(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs text-slate-400">Notes (Optional)</label>
                                        <textarea
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none min-h-[100px]"
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                        />
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-500/10 text-red-400 text-sm rounded-lg border border-red-500/20">
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {submitting ? 'Confirming...' : 'Schedule Meeting'}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
