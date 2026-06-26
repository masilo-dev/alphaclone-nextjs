'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Command as CommandIcon, Globe, Settings,
    CreditCard, Users, Briefcase, Calendar, Mail,
    Zap, PieChart, Shield, Lock, FileText, Plus,
    ArrowRight, Sparkles, Layout, Database, MessageSquare,
    DollarSign, TrendingUp, BarChart3, Clock, Bell,
    ArrowUpCircle, CheckCircle, AlertCircle, Circle, Eye
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fetchDashboardPreferences, mergeDashboardPreferences } from '@/services/userDashboardPreferencesService';
import type { UserRole } from '@/types';
import { canAccessSecurityDashboard, resolveDashboardPath } from '@/lib/dashboardNavigate';

interface Command {
    id: string;
    title: string;
    description: string;
    icon: any;
    category: 'Actions' | 'Navigate' | 'Finance' | 'CRM' | 'Internal';
    shortcut?: string;
    action: () => void;
}

interface CommandPaletteProps {
    isOpen?: boolean;
    onClose?: () => void;
    onCreateInvoice?: () => void;
    onCreateTask?: () => void;
    onCreateProject?: () => void;
    userId?: string;
    userRole?: UserRole;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen: externalIsOpen,
    onClose,
    onCreateInvoice,
    onCreateTask,
    onCreateProject,
    userId,
    userRole = 'client',
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [recentCommands, setRecentCommands] = useState<string[]>([]);
    const [commandHistoryReady, setCommandHistoryReady] = useState(() => !userId);
    const recentCommandsRef = useRef(recentCommands);
    const router = useRouter();

    const go = useCallback(
        (path: string) => router.push(resolveDashboardPath(path, userRole)),
        [router, userRole],
    );

    useEffect(() => {
        recentCommandsRef.current = recentCommands;
    }, [recentCommands]);

    const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
    const setIsOpen = (value: boolean | ((prev: boolean) => boolean)) => {
        if (typeof value === 'function') {
            const nextValue = value(isOpen);
            if (onClose && !nextValue) onClose();
            setInternalIsOpen(nextValue);
        } else {
            if (onClose && !value) onClose();
            setInternalIsOpen(value);
        }
    };

    const commands: Command[] = useMemo(() => {
        const list: Command[] = [
        { id: 'nav-home', title: 'Home Dashboard', description: 'Back to overview', icon: Layout, category: 'Navigate', action: () => go('/dashboard') },
        { id: 'nav-analytics', title: 'Analytics Hub', description: 'Performance & metrics', icon: BarChart3, category: 'Navigate', action: () => go('/dashboard/analytics') },
        { id: 'nav-projects', title: 'Project Management', description: 'Active & pending projects', icon: Briefcase, category: 'Navigate', action: () => go('/dashboard/projects/manage') },
        { id: 'nav-crm', title: 'CRM & Pipeline', description: 'Manage leads & clients', icon: Users, category: 'Navigate', action: () => go('/dashboard/crm') },
        { id: 'nav-messages', title: 'Messenger', description: 'Internal communication', icon: MessageSquare, category: 'Navigate', action: () => go('/dashboard/messages') },
        { id: 'nav-mail', title: 'Mail Inbox', description: 'Connect & management', icon: Mail, category: 'Navigate', action: () => go('/dashboard/mail') },
        { id: 'nav-calendar', title: 'Schedule & Booking', description: 'Manage your time', icon: Calendar, category: 'Navigate', action: () => go('/dashboard/calendar') },
        { id: 'fin-overview', title: 'Financial Overview', description: 'P&L, billing, and health', icon: CreditCard, category: 'Finance', action: () => go('/dashboard/finance') },
        { id: 'fin-forecast', title: 'Sales Forecast', description: 'Projected revenue models', icon: TrendingUp, category: 'Finance', action: () => go('/dashboard/forecast') },
        { id: 'fin-quotes', title: 'Quotes & Proposals', description: 'Draft new deals', icon: FileText, category: 'Finance', action: () => go('/dashboard/quotes') },
        { id: 'ops-tasks', title: 'Task Matrix', description: 'Global task management', icon: PieChart, category: 'CRM', action: () => go('/dashboard/tasks') },
        { id: 'ops-deals', title: 'Deals & Opportunities', description: 'High-value pipelines', icon: DollarSign, category: 'CRM', action: () => go('/dashboard/deals') },
        {
            id: 'act-invoice',
            title: 'Create New Invoice',
            description: 'Generate billing fast',
            icon: Plus,
            category: 'Actions',
            shortcut: 'I',
            action: () => onCreateInvoice ? onCreateInvoice() : go('/dashboard/finance/manage?create=true'),
        },
        {
            id: 'act-task',
            title: 'Create New Task',
            description: 'Neural capture engine',
            icon: Plus,
            category: 'Actions',
            shortcut: 'T',
            action: () => onCreateTask ? onCreateTask() : go('/dashboard/tasks'),
        },
        {
            id: 'act-project',
            title: 'Create New Project',
            description: 'Start a new project',
            icon: Plus,
            category: 'Actions',
            shortcut: 'P',
            action: () => onCreateProject ? onCreateProject() : go('/dashboard/projects/manage?create=true'),
        },
        { id: 'act-lead', title: 'Manual Lead Entry', description: 'Add a new prospect', icon: Plus, category: 'Actions', shortcut: 'L', action: () => go('/dashboard/crm') },
        { id: 'task-pri-urgent', title: 'Task: Set Priority to Urgent', description: 'Immediate operational attention', icon: AlertCircle, category: 'Actions', action: () => go('/dashboard/tasks') },
        { id: 'task-pri-high', title: 'Task: Set Priority to High', description: 'Strategic priority', icon: ArrowUpCircle, category: 'Actions', action: () => go('/dashboard/tasks') },
        { id: 'task-status-review', title: 'Task: Move to Review', description: 'Pending quality assurance', icon: Eye, category: 'Actions', action: () => go('/dashboard/tasks') },
        { id: 'task-status-done', title: 'Task: Mark as Completed', description: 'Mission success', icon: CheckCircle, category: 'Actions', action: () => go('/dashboard/tasks') },
        { id: 'int-settings', title: 'Platform Settings', description: 'Identity & profile', icon: Settings, category: 'Internal', action: () => go('/dashboard/settings') },
        ];

        if (canAccessSecurityDashboard(userRole)) {
            list.push({
                id: 'int-security',
                title: 'Security Dashboard',
                description: 'Access & logs',
                icon: Shield,
                category: 'Internal',
                action: () => go('/dashboard/security'),
            });
        }

        return list;
    }, [go, onCreateInvoice, onCreateTask, onCreateProject, userRole]);

    const filteredCommands = commands.filter(cmd =>
        cmd.title.toLowerCase().includes(search.toLowerCase()) ||
        cmd.description.toLowerCase().includes(search.toLowerCase()) ||
        cmd.category.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]); // Added isOpen to dependencies to ensure setIsOpen refers to current state source

    useEffect(() => {
        if (!userId) {
            setCommandHistoryReady(true);
            return;
        }
        let cancelled = false;
        setCommandHistoryReady(false);
        (async () => {
            try {
                const prefs = await fetchDashboardPreferences(userId);
                if (cancelled) return;
                if (prefs.commandHistory?.length) {
                    setRecentCommands(prefs.commandHistory.slice(0, 5));
                } else {
                    setRecentCommands([]);
                }
            } catch (err) {
                console.warn('Failed to fetch dashboard preferences:', err);
                setRecentCommands([]);
            }
            setCommandHistoryReady(true);
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    useEffect(() => {
        if (!userId || !commandHistoryReady) return;
        const t = window.setTimeout(() => {
            void mergeDashboardPreferences(userId, { commandHistory: recentCommandsRef.current });
        }, 500);
        return () => window.clearTimeout(t);
    }, [recentCommands, userId, commandHistoryReady]);

    const handleAction = useCallback((cmd: Command) => {
        cmd.action();
        setRecentCommands((prev) => [cmd.id, ...prev.filter((id) => id !== cmd.id)].slice(0, 5));
        setIsOpen(false);
        setSearch('');
    }, [setIsOpen]);

    useEffect(() => {
        if (isOpen) {
            setSelectedIndex(0);
        }
    }, [isOpen, search]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
            handleAction(filteredCommands[selectedIndex]);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative"
                    >
                        <div className="p-4 border-b border-slate-800 flex items-center gap-4">
                            <Search className="w-5 h-5 text-teal-400" />
                            <input
                                autoFocus
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search commands, tools, and sections..."
                                className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-slate-500 text-lg font-medium"
                            />
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded-lg border border-slate-700">
                                <span className="text-xs font-black text-slate-400">ESC</span>
                            </div>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
                            {filteredCommands.length === 0 ? (
                                <div className="p-8 text-center">
                                    <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
                                        <Sparkles className="w-6 h-6 text-slate-500" />
                                    </div>
                                    <p className="text-slate-400 font-medium">No results found for "{search}"</p>
                                    <p className="text-slate-600 text-xs mt-1 uppercase tracking-widest font-bold">Try searching for finance, crm, or actions</p>
                                </div>
                            ) : (
                                <div className="space-y-4 py-2">
                                    {/* Recent Commands Section - only show when not searching */}
                                    {!search && recentCommands.length > 0 && (
                                        <div className="space-y-1">
                                            <div className="px-3 py-1 text-xs font-black text-teal-500/50 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <Clock className="w-3 h-3" />
                                                Recent
                                            </div>
                                            {recentCommands.map(cmdId => {
                                                const cmd = commands.find(c => c.id === cmdId);
                                                if (!cmd) return null;
                                                const globalIndex = filteredCommands.indexOf(cmd);
                                                const isSelected = selectedIndex === globalIndex;

                                                return (
                                                    <button
                                                        key={cmd.id}
                                                        onClick={() => handleAction(cmd)}
                                                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                                                        className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-4 group ${isSelected
                                                            ? 'bg-teal-500/10 border-teal-500/20'
                                                            : 'hover:bg-slate-800/50 border-transparent'
                                                            } border`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                                                            }`}>
                                                            <cmd.icon className="w-5 h-5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{cmd.title}</span>
                                                                {cmd.shortcut && (
                                                                    <span className="text-xs font-black bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700 uppercase tracking-tighter">
                                                                        {cmd.shortcut}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-slate-500 truncate">{cmd.description}</p>
                                                        </div>
                                                        {isSelected && (
                                                            <ArrowRight className="w-4 h-4 text-teal-400 mr-2" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* All Commands */}
                                    {['Actions', 'Navigate', 'Finance', 'CRM', 'Internal'].map(category => {
                                        const catCmds = filteredCommands.filter(c => c.category === category);
                                        if (catCmds.length === 0) return null;

                                        return (
                                            <div key={category} className="space-y-1">
                                                <div className="px-3 py-1 text-xs font-black text-teal-500/50 uppercase tracking-[0.2em]">
                                                    {category}
                                                </div>
                                                {catCmds.map((cmd) => {
                                                    const globalIndex = filteredCommands.indexOf(cmd);
                                                    const isSelected = selectedIndex === globalIndex;

                                                    return (
                                                        <button
                                                            key={cmd.id}
                                                            onClick={() => handleAction(cmd)}
                                                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                                                            className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-4 group ${isSelected
                                                                ? 'bg-teal-500/10 border-teal-500/20'
                                                                : 'hover:bg-slate-800/50 border-transparent'
                                                                } border`}
                                                        >
                                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                                                                }`}>
                                                                <cmd.icon className="w-5 h-5" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{cmd.title}</span>
                                                                    {cmd.shortcut && (
                                                                        <span className="text-xs font-black bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700 uppercase tracking-tighter">
                                                                            {cmd.shortcut}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-500 truncate">{cmd.description}</p>
                                                            </div>
                                                            {isSelected && (
                                                                <ArrowRight className="w-4 h-4 text-teal-400 mr-2" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-xs font-black text-slate-400">↑↓</div>
                                    <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Navigate</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-xs font-black text-slate-400">ENTER</div>
                                    <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Select</span>
                                </div>
                            </div>
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 bg-gradient-to-r from-teal-500 to-orange-500 text-transparent bg-clip-text" />
                                    Quick Actions
                                </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CommandPalette;

