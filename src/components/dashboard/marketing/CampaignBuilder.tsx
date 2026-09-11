'use client';

import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import CampaignBuilderShell from '@/components/dashboard/business/CampaignBuilder';

interface CampaignBuilderProps {
    onClose: () => void;
    onCreated: () => void;
}

export default function CampaignBuilder({ onClose, onCreated }: CampaignBuilderProps) {
    const { user } = useAuth();

    if (!user?.id) return null;

    return (
        <div className="flex h-full min-h-0 flex-col bg-slate-950">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <div>
                    <p className="text-xs font-black uppercase tracking-widest text-teal-400">Unified Campaign Experience</p>
                    <p className="text-xs text-slate-500">Legacy marketing composer now routes through the main campaign builder.</p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        onCreated();
                        onClose();
                    }}
                    className="rounded-full bg-slate-800 p-2 text-slate-300 transition-colors hover:bg-slate-700"
                    aria-label="Close campaign builder"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="min-h-0 flex-1">
                <CampaignBuilderShell userId={user.id} />
            </div>
        </div>
    );
}
