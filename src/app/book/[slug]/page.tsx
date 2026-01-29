'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Clock, ArrowRight, Calendar, User, CheckCircle2 } from 'lucide-react';
import { Tenant } from '@/services/tenancy/types';
import { tenantService } from '@/services/tenancy/TenantService';

interface BookingType {
    id: string;
    name: string;
    slug: string;
    description: string;
    duration: number;
    price: number;
    currency: string;
}

export default function BookingLandingPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params?.slug as string;

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [bookingTypes, setBookingTypes] = useState<BookingType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (slug) loadData();
    }, [slug]);

    const loadData = async () => {
        try {
            // 1. Get Tenant
            const tenantData = await tenantService.getTenantBySlug(slug);
            if (!tenantData) throw new Error('Tenant not found');
            setTenant(tenantData);

            // 2. Get Booking Types (Services)
            // Note: In production we'd use a service method, but direct query is fine for now
            const { data: services, error: serviceError } = await supabase
                .from('booking_types')
                .select('*')
                .eq('tenant_id', tenantData.id)
                .eq('is_active', true)
                .order('duration', { ascending: true }); // Sort by duration or name

            if (serviceError) console.error('Error fetching services:', serviceError);

            // Mock data if empty (For Development Visualization)
            if (!services || services.length === 0) {
                // For now, let's just show an empty state or maybe a "demo" service?
                // No, empty state is better, urges user to create one.
                // OR we can map legacy JSON settings if they exist?
                // Let's stick to the new table. If empty, it's empty.
            }

            setBookingTypes(services || []);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center text-slate-400">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-2">404</h1>
                    <p>Profile not found.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-teal-500/10 blur-[150px] rounded-full"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-500/10 blur-[150px] rounded-full"></div>
            </div>

            <div className="max-w-4xl mx-auto relative z-10 pt-12 md:pt-20">

                {/* Header / Profile */}
                <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex justify-center mb-6">
                        {tenant.settings.branding?.logo ? (
                            <img src={tenant.settings.branding.logo} className="w-24 h-24 rounded-3xl object-cover border border-white/10 shadow-2xl shadow-teal-500/20" />
                        ) : (
                            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center shadow-2xl">
                                <span className="text-3xl font-black text-white/20">{tenant.name.charAt(0)}</span>
                            </div>
                        )}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        {tenant.name}
                    </h1>
                    <p className="text-slate-400 max-w-lg mx-auto leading-relaxed">
                        Welcome to our scheduling page. Please select an event type below to continue with your booking.
                    </p>
                </div>

                {/* Services Grid */}
                {bookingTypes.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-4 md:gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        {bookingTypes.map(service => (
                            <div
                                key={service.id}
                                onClick={() => router.push(`/book/${slug}/${service.slug}`)}
                                className="group relative p-6 md:p-8 bg-slate-900/40 border border-white/5 hover:border-teal-500/50 rounded-[2rem] hover:bg-slate-900/60 transition-all cursor-pointer backdrop-blur-xl overflow-hidden"
                            >
                                {/* Hover Glow */}
                                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/5 group-hover:to-transparent transition-all duration-500"></div>

                                <div className="relative flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                        <div className={`w-3 h-3 rounded-full ${['bg-teal-500', 'bg-violet-500', 'bg-orange-500', 'bg-pink-500'][Math.floor(Math.random() * 4)]}`}></div>
                                    </div>
                                    <span className="text-slate-500 group-hover:text-teal-400 transition-colors">
                                        <ArrowRight className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold mb-2 group-hover:text-white transition-colors">{service.name}</h3>
                                <div className="flex items-center gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" /> {service.duration} mins
                                    </span>
                                    {service.price > 0 && (
                                        <span className="flex items-center gap-1.5 text-emerald-400">
                                            Only {service.currency} {service.price}
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm text-slate-400 leading-relaxed opacity-80 line-clamp-2">
                                    {service.description || 'No description provided.'}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-slate-900/30 rounded-[3rem] border border-white/5 border-dashed">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Calendar className="w-6 h-6 text-slate-500" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-300 mb-2">No active services</h3>
                        <p className="text-slate-500 text-sm max-w-xs mx-auto">This partner hasn't set up any booking types yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
