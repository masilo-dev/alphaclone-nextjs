import React, { useState } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { Settings, Video, Link } from 'lucide-react';
import { CalendlySettingsModal } from './CalendlySettingsModal';
import { Button, Badge } from '@/components/ui/UIComponents';

interface MeetingsPageProps {
    user: User;
    onJoinRoom?: (callId: string) => void;
}

const MeetingsPage: React.FC<MeetingsPageProps> = () => {
    const { currentTenant } = useTenant();
    const [showSettings, setShowSettings] = useState(false);

    const copyBookingLink = () => {
        const calendlyUrl = (currentTenant?.settings as any)?.calendly?.eventUrl;
        if (calendlyUrl) {
            navigator.clipboard.writeText(calendlyUrl);
            import('react-hot-toast').then(({ toast }) => toast.success('Calendly link copied'));
        } else if (currentTenant?.settings.booking?.slug) {
            const url = `${window.location.origin}/book/${currentTenant.settings.booking.slug}`;
            navigator.clipboard.writeText(url);
            import('react-hot-toast').then(({ toast }) => toast.success('Booking link copied'));
        } else {
            import('react-hot-toast').then(({ toast }) => toast.error('No booking link is configured yet'));
        }
    };

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Meetings</h1>
                    <p className="text-slate-400">Booking and calendar management now. Native video rooms are coming soon.</p>
                </div>
                <div className="flex gap-2">
                    {((currentTenant?.settings as any)?.calendly?.enabled || currentTenant?.settings.booking?.enabled) && (
                        <Button variant="outline" onClick={copyBookingLink} className="gap-2 border-slate-700 hover:bg-slate-800">
                            <Link className="w-4 h-4" />
                            Booking Link
                        </Button>
                    )}
                    <Button onClick={() => setShowSettings(true)} variant="outline" className="gap-2 border-slate-700 hover:bg-slate-800">
                        <Settings className="w-4 h-4" />
                        Settings
                    </Button>
                </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8">
                <div className="flex flex-col md:flex-row gap-5 items-start">
                    <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                        <Video className="w-7 h-7 text-teal-400" />
                    </div>
                    <div className="space-y-3">
                        <Badge variant="warning">Coming Soon</Badge>
                        <h2 className="text-xl font-bold text-white">Native AlphaClone Video Rooms</h2>
                        <p className="text-slate-400 max-w-2xl">
                            The in-app video room is intentionally disabled while the production meeting stack is finalized.
                            Use Calendly or the booking link for scheduling; meeting links will remain AlphaClone-branded once native rooms are enabled.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-2">
                            {((currentTenant?.settings as any)?.calendly?.enabled || currentTenant?.settings.booking?.enabled) && (
                                <Button variant="outline" onClick={copyBookingLink} className="gap-2 border-slate-700 hover:bg-slate-800">
                                    <Link className="w-4 h-4" />
                                    Copy Booking Link
                                </Button>
                            )}
                            <Button onClick={() => setShowSettings(true)} variant="secondary" className="gap-2">
                                <Settings className="w-4 h-4" />
                                Booking Settings
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {showSettings && currentTenant && (
                <CalendlySettingsModal
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
};

export default MeetingsPage;
