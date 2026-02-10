'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Command,
    Search,
    Plus,
    FileText,
    MessageSquare,
    DollarSign,
    Zap,
    X,
    ChevronRight,
    LucideIcon
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CommandItem {
    id: string;
    label: string;
    description: string;
    icon: LucideIcon;
    action: () => void;
    category: string;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateInvoice?: () => void;
    onCreateTask?: () => void;
    onCreateProject?: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    onCreateInvoice,
    onCreateTask,
    onCreateProject
}) => {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const commands: CommandItem[] = [
        {
            id: 'new-invoice',
            label: 'Generate New Invoice',
            description: 'Create a direct or project-linked invoice',
            icon: DollarSign,
            action: () => { onCreateInvoice?.(); onClose(); },
            category: 'Actions'
        },
        {
            id: 'new-task',
            label: 'Initialize Task',
            description: 'Define a new operational objective',
            icon: Plus,
            action: () => { onCreateTask?.(); onClose(); },
            category: 'Actions'
        },
        {
            id: 'new-project',
            label: 'Protocol Alpha: New Project',
            description: 'Launch a new client project container',
            icon: Zap,
            action: () => { onCreateProject?.(); onClose(); },
            category: 'Actions'
        },
        {
            id: 'go-messages',
            label: 'Open Secure Comms',
            description: 'Navigate to messaging dashboard',
            icon: MessageSquare,
            action: () => { router.push('/dashboard/messages'); onClose(); },
            category: 'Navigation'
        },
        {
            id: 'go-contracts',
            label: 'Legal Ledger',
            description: 'View and draft contracts',
            icon: FileText,
            action: () => { router.push('/dashboard/contracts'); onClose(); },
            category: 'Navigation'
        },
    ];

    const filteredCommands = commands.filter(c =>
        c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!isOpen) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            filteredCommands[selectedIndex]?.action();
        } else if (e.key === 'Escape') {
            onClose();
        }
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setSelectedIndex(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4">
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-slate-900/95 border border-teal-500/30 rounded-2xl sm:rounded-3xl shadow-[0_0_80px_-20px_rgba(20,184,166,0.5)] overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Search Header */}
                <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 border-b border-white/5 bg-slate-950/40">
                    <Command className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400 animate-pulse flex-shrink-0" />
                    <input
                        autoFocus
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Specify protocol..."
                        className="flex-1 bg-transparent border-none text-base sm:text-xl text-white outline-none placeholder-slate-600 font-bold tracking-tight min-w-0"
                    />
                    <div className="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded-lg border border-white/5 flex-shrink-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ESC</span>
                    </div>
                </div>

                {/* Command List */}
                <div className="max-h-[60vh] overflow-y-auto p-3 sm:p-4 custom-scrollbar">
                    {filteredCommands.length > 0 ? (
                        <div className="space-y-1">
                            {filteredCommands.map((cmd, idx) => {
                                const isSelected = idx === selectedIndex;
                                return (
                                    <button
                                        key={cmd.id}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        onClick={cmd.action}
                                        className={`w-full flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-200 group ${isSelected
                                                ? 'bg-gradient-to-r from-teal-500/20 to-teal-500/5 border border-teal-500/30 shadow-lg shadow-teal-500/10'
                                                : 'border border-transparent hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                                            <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all flex-shrink-0 ${isSelected ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/40 translate-x-1' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                                                }`}>
                                                <cmd.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                                            </div>
                                            <div className="text-left min-w-0 flex-1">
                                                <div className={`text-xs sm:text-sm font-black uppercase tracking-wider sm:tracking-widest ${isSelected ? 'text-white' : 'text-slate-200'} truncate`}>
                                                    {cmd.label}
                                                </div>
                                                <div className={`text-[10px] sm:text-xs ${isSelected ? 'text-teal-400/80' : 'text-slate-500'} truncate`}>
                                                    {cmd.description}
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 sm:w-5 sm:h-5 transition-all flex-shrink-0 ${isSelected ? 'text-teal-400 translate-x-1 opacity-100' : 'text-slate-700 opacity-0'}`} />
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                            <X className="w-12 h-12 text-red-500/20 mb-4" />
                            <div className="text-slate-300 font-bold uppercase tracking-widest mb-1">Command Restricted or Invalid</div>
                            <div className="text-slate-500 text-xs">No matching protocols found in the central node.</div>
                        </div>
                    )}
                </div>

                {/* Keyboard Footer */}
                <div className="p-3 sm:p-4 bg-slate-950/60 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-2 py-1 bg-slate-800 border border-white/10 rounded-md text-[10px] text-slate-400 font-black">↑↓</kbd>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Navigate</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-2 py-1 bg-slate-800 border border-white/10 rounded-md text-[10px] text-slate-400 font-black">ENTER</kbd>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Execute</span>
                        </div>
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-black text-teal-500/40 uppercase tracking-[0.2em] sm:tracking-[0.3em]">AlphaClone Systems OS</div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
