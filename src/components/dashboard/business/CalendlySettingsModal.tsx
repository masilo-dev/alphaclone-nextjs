import React, { useEffect } from 'react';
import { X, Settings, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/UIComponents';
import CalendlySettings from './CalendlySettings';

interface CalendlySettingsModalProps {
    onClose: () => void;
}

export const CalendlySettingsModal: React.FC<CalendlySettingsModalProps> = ({ onClose }) => {
    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-300">
            <div
                className="absolute inset-0 bg-transparent"
                onClick={onClose}
            />
            <Card className="relative bg-[#0a0a0a] border border-slate-800/50 sm:rounded-3xl p-0 flex flex-col w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
                {/* Header */}
                <div className="flex items-start sm:items-center justify-between p-4 sm:p-6 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-xl shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 sm:p-3 bg-teal-500/10 rounded-xl">
                            <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold">Booking & Calendly</h2>
                            <p className="text-slate-400 text-xs sm:text-sm">Configure your automated booking system</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg -mr-2 sm:mr-0">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 overscroll-contain">
                    <CalendlySettings />
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-xl flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all active:scale-95"
                    >
                        CLOSE
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default CalendlySettingsModal;
