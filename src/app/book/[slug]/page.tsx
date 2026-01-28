'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { bookingService } from '@/services/bookingService';
import { Tenant } from '@/services/tenancy/types';
import { Card } from '@/components/ui/UIComponents';

export default function BookingLandingPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params?.slug as string;

    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (slug) loadProfile();
    }, [slug]);

    const loadProfile = async () => {
        try {
            const { tenant, error } = await bookingService.getBookingProfile(slug);
            if (error) {
                setError(error);
            } else {
                setTenant(tenant);
            }
        } catch (err) {
            setError('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-teal-400">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    <p>Loading booking profile...</p>
                </div>
            </div>
        );
    }

    if (error || !tenant || !tenant.settings.booking) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Profile Not Found</h1>
                    <p className="text-slate-400">{error || 'This booking page does not exist.'}</p>
                </div>
            </div>
        );
    }

    const { booking, branding } = tenant.settings;

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 md:p-12 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/10 blur-[120px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
            </div>

            <div className="max-w-4xl mx-auto space-y-16 relative z-10">
                {/* Header Section */}
                <div className="text-center space-y-6 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {branding?.logo ? (
                        <div className="relative inline-block group">
                            <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-violet-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                            <img
                                src={branding.logo}
                                alt={tenant.name}
                                className="w-24 h-24 mx-auto rounded-3xl object-cover border border-white/10 shadow-2xl relative z-10 p-1 bg-slate-900"
                            />
                        </div>
                    ) : (
                        <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-teal-500/20 to-violet-500/20 border border-white/10 flex items-center justify-center">
                            <span className="text-4xl font-black text-white/20">{tenant.name.charAt(0)}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                            {tenant.name}
                        </h1>
                        <p className="text-slate-400 text-sm md:text-lg font-medium tracking-wide uppercase flex items-center justify-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping"></span>
                            Strategic Access Portal
                        </p>
                    </div>
                </div>

                {/* Grid of Meeting Types */}
                <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                    {booking.meetingTypes.map((type, index) => (
                        <div
                            key={type.id}
                            onClick={() => router.push(`/book/${slug}/${type.id}`)}
                            className="group relative cursor-pointer"
                        >
                            {/* Card Hover Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-violet-500 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-10 transition-all duration-500 -z-10"></div>

                            <div className="glass-panel p-6 md:p-8 rounded-[2rem] border border-white/5 bg-slate-900/40 backdrop-blur-3xl hover:border-white/20 transition-all duration-500 flex flex-col md:flex-row items-center gap-8 group-hover:translate-x-2">
                                <div className="flex-1 space-y-4 text-center md:text-left">
                                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                                        <h3 className="text-2xl md:text-3xl font-black text-white group-hover:text-teal-300 transition-colors tracking-tight">
                                            {type.name}
                                        </h3>
                                        <div className="flex items-center gap-2 justify-center md:justify-start">
                                            <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                {type.duration} MIN SESSION
                                            </span>
                                            {type.price > 0 && (
                                                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                                    ${type.price} PREMIUM
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-2xl font-medium italic overflow-hidden text-ellipsis">
                                        "{type.description || 'Initialize a high-impact session with our lead strategists.'}"
                                    </p>
                                </div>

                                <div className="hidden md:flex flex-col items-center gap-3">
                                    <div className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center bg-white/5 group-hover:bg-teal-500 group-hover:border-teal-400 transition-all duration-500 group-hover:scale-110">
                                        <svg className="w-6 h-6 text-white group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 group-hover:text-teal-400 uppercase tracking-widest transition-colors">Select Unit</span>
                                </div>

                                <div className="md:hidden w-full">
                                    <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-teal-500 transition-colors">
                                        Initialize Unit
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {booking.meetingTypes.length === 0 && (
                        <div className="text-center py-20 bg-slate-900/20 border-2 border-dashed border-white/5 rounded-[3rem] animate-pulse">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-400 mb-2">No active units available</h3>
                            <p className="text-slate-600 text-sm font-medium uppercase tracking-widest">Awaiting sector initialization</p>
                        </div>
                    )}
                </div>

                {/* Footer Credits */}
                <div className="text-center pt-20 animate-in fade-in duration-1000 delay-500">
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em] mb-4">Secured by AlphaClone Unified Intelligence</p>
                    <div className="flex items-center justify-center gap-8">
                        <div className="h-px w-12 bg-gradient-to-r from-transparent to-slate-800"></div>
                        <div className="w-2 h-2 rounded-full bg-slate-800"></div>
                        <div className="h-px w-12 bg-gradient-to-l from-transparent to-slate-800"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
