'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../../../types';
import {
    ArrowRight,
    Calendar,
    BarChart2,
    FileText,
    UserPlus,
    Zap,
    Sun,
    Sunset,
    Moon,
    Rocket,
    Globe,
    Linkedin,
    Loader2
} from 'lucide-react';
import { Button } from '../../ui/UIComponents';
import toast from 'react-hot-toast';
import DailySummarySystem from './DailySummarySystem';

// ─── Greeting Helpers ────────────────────────────────────────────────
function getGreeting(): { text: string; Icon: React.FC<any> } {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return { text: 'Good morning', Icon: Sun };
    if (h >= 12 && h < 17) return { text: 'Good afternoon', Icon: Sun };
    if (h >= 17 && h < 21) return { text: 'Good evening', Icon: Sunset };
    return { text: 'Good night', Icon: Moon };
}

interface QuickAction {
    id: string;
    title: string;
    description: string;
    icon: React.FC<any>;
    color: string;
    action: () => void;
}

const EngagingDashboard: React.FC<{ user: User; stats?: any }> = ({ user, stats }) => {
    const [loading, setLoading] = useState(false);
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const greeting = getGreeting();
    const firstName = (user.name || user.email || 'there').split(' ')[0];

    useEffect(() => {
        generateWelcomeMessage();
    }, [user.name, user.email]);

    const generateWelcomeMessage = () => {
        const messages = [
            `Welcome back, ${firstName}.`,
            `Ready to build today, ${firstName}?`,
            `${firstName}, let's make progress.`,
            `Time to grow your business, ${firstName}.`,
            `Let's achieve your goals, ${firstName}.`,
        ];
        setWelcomeMessage(messages[Math.floor(Math.random() * messages.length)]);
    };

    const router = useRouter();

    const quickActions: QuickAction[] = [
        {
            id: 'new-client',
            title: 'Add Client',
            description: 'Grow your network',
            icon: UserPlus,
            color: 'bg-blue-500',
            action: () => router.push('/dashboard/crm?quickAdd=true')
        },
        {
            id: 'new-invoice',
            title: 'Create Invoice',
            description: 'Get paid faster',
            icon: FileText,
            color: 'bg-green-500',
            action: () => router.push('/dashboard/accounting')
        },
        {
            id: 'schedule-meeting',
            title: 'Schedule Meeting',
            description: 'Connect with clients',
            icon: Calendar,
            color: 'bg-indigo-500',
            action: () => router.push('/dashboard/business/calendar')
        },
        {
            id: 'view-reports',
            title: 'View Reports',
            description: 'Track your progress',
            icon: BarChart2,
            color: 'bg-orange-500',
            action: () => router.push('/dashboard/business/reports')
        },
        {
            id: 'social-media-manager',
            title: 'Social Manager',
            description: 'Create and schedule posts',
            icon: Globe,
            color: 'bg-cyan-500',
            action: () => router.push('/dashboard/business/social')
        },
        {
            id: 'linkedin-manager',
            title: 'LinkedIn Manager',
            description: 'Manage LinkedIn posting',
            icon: Linkedin,
            color: 'bg-sky-500',
            action: () => router.push('/dashboard/business/linkedin')
        }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 truncate">
                        {greeting?.text || 'Hello'}, {firstName}
                    </h1>
                    <p className="text-slate-600 mt-1 text-sm sm:text-base">{welcomeMessage}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <button 
                        onClick={() => router.push('/dashboard/crm?quickAdd=true')}
                        className="px-3 py-2 sm:px-4 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm active:scale-95"
                    >
                        Quick Add
                    </button>
                    <button 
                        onClick={() => router.push('/dashboard/business/projects?new=true')}
                        className="px-3 py-2 sm:px-4 bg-teal-600 text-white rounded-lg text-xs sm:text-sm font-medium hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20 active:scale-95"
                    >
                        New Project
                    </button>
                </div>
            </div>

            {/* Onboarding Guide Link */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-800 rounded-2xl p-6 border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4"
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <Rocket className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Platform Onboarding Guide</h2>
                        <p className="text-sm text-slate-400">Learn how to configure your workspace and start building.</p>
                    </div>
                </div>
                <Button
                    onClick={() => router.push('/guide')}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500"
                >
                    Open Guide
                    <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </motion.div>

            {/* Daily Summary System */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden"
            >
                <DailySummarySystem />
            </motion.div>

            {/* Quick Actions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-slate-800 rounded-2xl p-6 border border-slate-700"
            >
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    Quick Actions
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {quickActions.filter(action => action.id && action.title).map((action, index) => (
                        <motion.button
                            key={action.id || `action-${index}`}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 + index * 0.05 }}
                            onClick={action.action}
                            className="bg-gradient-to-r from-teal-500/20 to-blue-500/20 hover:from-teal-500/30 hover:to-blue-500/30 border border-teal-500/30 hover:border-blue-500/50 p-2 rounded-lg text-white transition-all transform"
                        >
                            {action.icon && <action.icon className="w-4 h-4 mb-1 text-teal-400 group-hover:text-orange-400 transition-colors" />}
                            <div className="text-xs font-medium">{action.title || 'Action'}</div>
                        </motion.button>
                    ))}
                </div>
            </motion.div>

        </div>
    );
};

export default EngagingDashboard;
