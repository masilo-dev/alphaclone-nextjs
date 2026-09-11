import React from 'react';
import { Sparkles, X } from 'lucide-react';

interface BatchOutreachFABProps {
    selectedCount: number;
    onOpen: () => void;
    onClear: () => void;
}

export const BatchOutreachFAB: React.FC<BatchOutreachFABProps> = ({ selectedCount, onOpen, onClear }) => {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-2 p-2 bg-slate-900/90 backdrop-blur-xl border border-teal-500/30 rounded-2xl shadow-2xl shadow-teal-500/20">
                <button
                    onClick={onOpen}
                    className="flex items-center gap-3 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                >
                    <Sparkles className="w-5 h-5 animate-pulse" />
                    <span>Launch Outreach ({selectedCount})</span>
                </button>
                
                <div className="w-px h-8 bg-slate-800 mx-1" />
                
                <button
                    onClick={onClear}
                    className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                    title="Clear selection"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};
