'use client';

import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';
import CalendlyEmbed from '../../booking/CalendlyEmbed';
import { Card } from '@/components/ui/UIComponents';
import { Calendar, Settings, AlertCircle } from 'lucide-react';

const BookingTab: React.FC = () => {
    const { currentTenant } = useTenant();

    const calendlyUrl = (currentTenant?.settings as any)?.calendly?.eventUrl;
    const isEnabled = (currentTenant?.settings as any)?.calendly?.enabled;

    if (!isEnabled || !calendlyUrl) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in-up">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Calendar className="w-10 h-10 text-slate-500" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Calendly Not Connected</h3>
                <p className="text-slate-400 max-w-md mb-8">
                    Connect your Calendly account in settings to enable the embedded booking view.
                </p>
                <button
                    onClick={() => window.location.href = '/dashboard/business/settings'}
                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-teal-900/20"
                >
                    <Settings className="w-4 h-4" />
                    Go to Settings
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Calendar className="w-6 h-6 text-teal-400" />
                        Booking Page
                    </h2>
                    <p className="text-slate-400 text-sm">Your public scheduling interface</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => window.open(calendlyUrl, '_blank')}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors border border-slate-700"
                    >
                        Open Original Link
                    </button>
                </div>
            </div>

            <Card className="p-0 overflow-hidden bg-slate-950 border-slate-800 min-h-[800px]">
                <CalendlyEmbed
                    url={calendlyUrl}
                    branding={{
                        primaryColor: '#2dd4bf',
                        backgroundColor: '#0f172a',
                        textColor: '#ffffff'
                    }}
                />
            </Card>

            <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
                <p className="text-sm text-blue-300">
                    This is how your clients see your booking page. You can share your link: <span className="font-mono text-white underline decoration-blue-500/50">{calendlyUrl}</span>
                </p>
            </div>
        </div>
    );
};

export default BookingTab;
