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
        { id: 'nav-home', title: 'Home', description: 'Attention and next actions', icon: Layout, category: 'Navigate', action: () => go('/dashboard') },
        { id: 'nav-crm', title: 'CRM workspace', description: 'Customers and pipeline work', icon: Users, category: 'Navigate', action: () => go('/dashboard/crm/workspace') },
        { id: 'nav-leads', title: 'Leads board', description: 'Qualify and convert prospects', icon: Users, category: 'CRM', action: () => go('/dashboard/leads') },
        { id: 'nav-deals', title: 'Deals', description: 'Opportunities and stages', icon: DollarSign, category: 'CRM', action: () => go('/dashboard/deals') },
        { id: 'nav-contacts', title: 'Contacts', description: 'People directory', icon: Users, category: 'CRM', action: () => go('/dashboard/contacts') },
        { id: 'nav-inbox', title: 'Unified Inbox', description: 'Email, tickets, and channels', icon: Mail, category: 'Navigate', action: () => go('/dashboard/comms') },
        { id: 'nav-messages', title: 'Team messages', description: 'Internal chat', icon: MessageSquare, category: 'Navigate', action: () => go('/dashboard/messages') },
        { id: 'nav-email', title: 'Email', description: 'Mailbox and compose', icon: Mail, category: 'Navigate', action: () => go('/dashboard/mail') },
        { id: 'nav-calendar', title: 'Calendar', description: 'Schedule and meetings', icon: Calendar, category: 'Navigate', action: () => go('/dashboard/calendar') },
        { id: 'nav-projects', title: 'Projects', description: 'Delivery workspaces', icon: Briefcase, category: 'Navigate', action: () => go('/dashboard/projects/manage') },
        { id: 'nav-tasks', title: 'Tasks', description: 'Work to complete', icon: PieChart, category: 'Navigate', action: () => go('/dashboard/tasks') },
        { id: 'nav-analytics', title: 'Analytics', description: 'Performance and metrics', icon: BarChart3, category: 'Navigate', action: () => go('/dashboard/analytics') },
        { id: 'nav-accounting', title: 'Accounting', description: 'Ledgers and banking', icon: CreditCard, category: 'Finance', action: () => go('/dashboard/accounting') },
        { id: 'nav-expenses', title: 'Expenses', description: 'Track spend and receipts', icon: CreditCard, category: 'Finance', action: () => go('/dashboard/business/expenses') },
        { id: 'nav-invoices', title: 'Invoices', description: 'Create and send invoices', icon: FileText, category: 'Finance', action: () => go('/dashboard/business/billing/manage') },
        { id: 'nav-quotes', title: 'Quotes', description: 'Proposals and quotes', icon: FileText, category: 'Finance', action: () => go('/dashboard/business/quotes') },
        { id: 'nav-campaigns', title: 'Campaigns', description: 'Email marketing', icon: Mail, category: 'Navigate', action: () => go('/dashboard/business/campaigns') },
        { id: 'nav-social', title: 'Social', description: 'Posts and scheduling', icon: Globe, category: 'Navigate', action: () => go('/dashboard/business/social') },
        { id: 'nav-contracts', title: 'Contracts', description: 'Agreements and signatures', icon: FileText, category: 'Navigate', action: () => go('/dashboard/business/contracts') },
        { id: 'nav-documents', title: 'Documents', description: 'Files and vault', icon: Database, category: 'Navigate', action: () => go('/dashboard/business/documents') },
        { id: 'nav-workflows', title: 'Workflows', description: 'Automations', icon: Zap, category: 'Navigate', action: () => go('/dashboard/business/workflows') },
        { id: 'nav-bonnie', title: 'Bonnie', description: 'AI assistant', icon: Sparkles, category: 'Navigate', action: () => go('/dashboard/bonnie') },
        { id: 'nav-marketplace', title: 'Integrations', description: 'Connect apps', icon: Globe, category: 'Navigate', action: () => go('/dashboard/marketplace') },
        { id: 'fin-overview', title: 'Billing overview', description: 'Revenue snapshots', icon: CreditCard, category: 'Finance', action: () => go('/dashboard/business/billing') },
        { id: 'fin-forecast', title: 'Sales Forecast', description: 'Projected revenue', icon: TrendingUp, category: 'Finance', action: () => go('/dashboard/forecast') },
        {
            id: 'act-invoice',
            title: 'Create invoice',
            description: 'Draft a new invoice',
            icon: Plus,
            category: 'Actions',
            shortcut: 'I',
            action: () => onCreateInvoice ? onCreateInvoice() : go('/dashboard/business/billing/manage?create=true'),
        },
        {
            id: 'act-task',
            title: 'Create task',
            description: 'Capture work quickly',
            icon: Plus,
            category: 'Actions',
            shortcut: 'T',
            action: () => onCreateTask ? onCreateTask() : go('/dashboard/tasks'),
        },
        {
            id: 'act-project',
            title: 'Create project',
            description: 'Start delivery work',
            icon: Plus,
            category: 'Actions',
            shortcut: 'P',
            action: () => onCreateProject ? onCreateProject() : go('/dashboard/projects/manage?create=true'),
        },
        { id: 'act-lead', title: 'Add lead', description: 'Open CRM to add a prospect', icon: Plus, category: 'Actions', shortcut: 'L', action: () => go('/dashboard/crm/workspace?quickAdd=true') },
        { id: 'int-settings', title: 'Settings', description: 'Workspace and account', icon: Settings, category: 'Internal', action: () => go('/dashboard/settings') },
        { id: 'int-help', title: 'Platform guide', description: 'Glossary and how-to', icon: FileText, category: 'Internal', action: () => go('/dashboard/help') },
        ];

        if (canAccessSecurityDashboard(userRole)) {
            list.push({
                id: 'int-security',
                title: 'Security Dashboard',
                description: 'Access and logs',
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
        if (externalIsOpen !== undefined) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [externalIsOpen, isOpen]); // Standalone instances own their shortcut; controlled shells do not.

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
        if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % Math.max(filteredCommands.length, 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(filteredCommands.length, 1));
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
                        className="fixed inset-0 bg-[rgba(13,15,24,0.72)] backdrop-blur-sm"
                        aria-hidden="true"
                    />

                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Command palette"
                        initial={{ opacity: 0, scale: 0.99, y: -12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.99, y: -12 }}
                        data-backlight-tone="teal"
                        data-backlight-intensity="focus"
                        className="ac-backlit-surface w-full max-w-2xl bg-[var(--surface-elevated)] border border-[var(--border-default)] rounded-2xl shadow-2xl overflow-hidden relative"
                    >
                        <div className="p-4 border-b border-[var(--border-default)] flex items-center gap-4">
                            <Search className="w-5 h-5 text-[var(--interactive-secondary)]" aria-hidden="true" />
                            <input
                                autoFocus
                                role="combobox"
                                aria-expanded={true}
                                aria-controls="command-palette-list"
                                aria-activedescendant={
                                  filteredCommands[selectedIndex]
                                    ? `command-option-${filteredCommands[selectedIndex].id}`
                                    : undefined
                                }
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search commands, tools, and sections..."
                                className="w-full bg-transparent border-none focus:ring-0 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] text-lg font-medium"
                            />
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 rounded-lg border border-slate-700">
                                <span className="text-xs font-black text-slate-400">ESC</span>
                            </div>
                        </div>

                        <div id="command-palette-list" role="listbox" className="max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
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
                                                            id={`command-option-${cmd.id}`}
                                                            role="option"
                                                            aria-selected={isSelected}
                                                            type="button"
                                                            onClick={() => handleAction(cmd)}
                                                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                                                            className={`w-full text-left p-3 rounded-lg transition-all flex items-center gap-4 group ${isSelected
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
