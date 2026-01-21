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
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12">
            <div className="max-w-3xl mx-auto space-y-12">
                {/* Header */}
                <div className="text-center space-y-4">
                    {branding?.logo && (
                        <img
                            src={branding.logo}
                            alt={tenant.name}
                            className="w-20 h-20 mx-auto rounded-full object-cover border-2 border-slate-800"
                        />
                    )}
                    <h1 className="text-4xl font-bold">{tenant.name}</h1>
                    <p className="text-slate-400">Select a meeting type to schedule</p>
                </div>

                {/* Meeting Types Grid */}
                <div className="grid md:grid-cols-1 gap-4">
                    {booking.meetingTypes.map((type) => (
                        <Card
                            key={type.id}
                            className="p-6 hover:border-teal-500/50 transition-all cursor-pointer group bg-slate-900/50 backdrop-blur-sm"
                            onClick={() => router.push(`/book/${slug}/${type.id}`)}
                        >
                            <div className="flex justify-between items-center">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-teal-500 group-hover:shadow-[0_0_10px_rgba(20,184,166,0.5)] transition-shadow"></div>
                                        <h3 className="text-xl font-bold group-hover:text-teal-400 transition-colors">
                                            {type.name}
                                        </h3>
                                    </div>
                                    <p className="text-slate-400 text-sm pl-6 max-w-lg">
                                        {type.description || 'No description provided.'}
                                    </p>
                                    <div className="flex items-center gap-4 pl-6 pt-2 text-sm text-slate-500">
                                        <span className="flex items-center gap-1">
                                            🕒 {type.duration} mins
                                        </span>
                                        {type.price > 0 && (
                                            <span className="flex items-center gap-1 text-emerald-400">
                                                💰 ${type.price}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-slate-600 group-hover:text-teal-400 transform group-hover:translate-x-1 transition-all">
                                    ➔
                                </div>
                            </div>
                        </Card>
                    ))}

                    {booking.meetingTypes.length === 0 && (
                        <div className="text-center p-8 bg-slate-900 rounded-xl border border-slate-800 border-dashed text-slate-500">
                            No meeting types configured.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
