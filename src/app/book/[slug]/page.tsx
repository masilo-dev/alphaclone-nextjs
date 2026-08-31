'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchTenantBookingPage, BookingType } from '@/actions/booking';
import { Tenant } from '@/services/tenancy/types';
import { Clock, ArrowRight, Video, Calendar, Loader2 } from 'lucide-react';
import { PLATFORM_BOOKING_URL } from '@/constants';
import Image from 'next/image';

export default function BookingLandingPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params?.slug as string;

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [bookingTypes, setBookingTypes] = useState<BookingType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (slug) {
            loadData();
        }
    }, [slug]);

    const loadData = async () => {
        try {
            const { tenant, services } = await fetchTenantBookingPage(slug);
            setTenant(tenant);
            setBookingTypes(services);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to load booking page');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-slate-900 dark:text-white animate-spin" />
            </div>
        );
    }

    if (error || !tenant) {
        return (
            <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center flex-col gap-4">
                <p className="text-red-500 font-medium">{error || 'Booking page not found'}</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-slate-900 text-white rounded-lg">Retry</button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 font-sans selection:bg-teal-500/30">
            <main className="max-w-3xl mx-auto px-6 py-12 md:py-20 lg:py-24">

                {/* Profile Header */}
                <div className="text-center space-y-6 mb-12 md:mb-16 animate-in slide-in-from-bottom-4 duration-700 fade-in">
                    {tenant.settings.branding?.logo ? (
                        <div className="w-24 h-24 mx-auto rounded-full p-1 border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden relative">
                            <Image 
                                src={tenant.settings.branding.logo} 
                                alt={tenant.name} 
                                fill
                                className="object-cover rounded-full" 
                                sizes="96px"
                                priority
                            />
                        </div>
                    ) : (
                        <div className="w-24 h-24 mx-auto rounded-full bg-slate-200 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-800 flex items-center justify-center text-3xl font-bold text-slate-500 shadow-xl">
                            {tenant.name[0]}
                        </div>
                    )}

                    <div className="space-y-2">
                        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">{tenant.name}</h1>
                        <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
                            Select a service below to schedule directly with {tenant.name}.
                        </p>
                    </div>
                </div>

                {/* Services List or Calendly Embed */}
                <div className="animate-in slide-in-from-bottom-8 duration-1000 delay-100 fade-in fill-mode-backwards">
                    {bookingTypes.length > 0 ? (
                        <div className="grid gap-4">
                            {bookingTypes.map((service) => (
                                <div
                                    key={service.id}
                                    onClick={() => router.push(`/book/${slug}/${service.slug}`)}
                                    className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xl transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                                >
                                    <div className="space-y-2">
                                        <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                                            {service.name}
                                        </h2>
                                        {service.description && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 pr-4">{service.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 pt-1">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {service.duration} mins
                                            </div>
                                            {service.price > 0 && (
                                                <div className="flex items-center gap-1.5">
                                                    <span>$</span>
                                                    {service.price} {service.currency}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5">
                                                <Video className="w-3.5 h-3.5" />
                                                Online
                                            </div>
                                        </div>
                                    </div>
                                    <div className="hidden md:flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-slate-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-slate-900 transition-all transform group-hover:translate-x-1">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-4">
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Online booking is being set up for this workspace.
                            </p>
                            <a
                                href={(tenant.settings as any)?.calendly?.eventUrl || PLATFORM_BOOKING_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-2xl transition-colors"
                            >
                                <Calendar className="w-5 h-5" />
                                Open scheduling page
                            </a>
                        </div>
                    )}
                </div>

                {/* Footer brand */}
                <div className="mt-16 text-center">
                    <a href="https://alphaclonesystems.com" target="_blank" className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all">
                        <span>Powered by AlphaClone</span>
                    </a>
                </div>
            </main>
        </div>
    );
}
