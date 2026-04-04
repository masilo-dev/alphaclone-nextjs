'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../../../types';
import { SlackIntegration } from '../integrations/SlackIntegration';
import { SendGridIntegration } from '../integrations/SendGridIntegration';
import { ResendIntegration } from '../integrations/ResendIntegration';
import { PlaywrightIntegration } from '../integrations/PlaywrightIntegration';
import { useBackgroundTasks, BackgroundTask } from '@/contexts/BackgroundTaskContext';
import { businessClientService } from '../../../services/businessClientService';
import { dailyService } from '../../../services/dailyService';
import { supabase } from '../../../lib/supabase';
import {
    DollarSign,
    Users,
    Briefcase,
    TrendingUp,
    Clock,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Calendar,
    BarChart2,
    Target,
    Video,
    CheckSquare,
    FileText,
    UserPlus,
    Zap,
    Sun,
    Sunset,
    Moon,
    Star,
    XCircle,
    Loader2,
    Facebook,
    Smartphone,
    MessageSquare,
    Mail,
    Rocket,
    Sparkles,
    Award,
    Gift,
    Heart,
    ThumbsUp,
    Lightbulb,
    Flag,
    Play,
    Plus,
    Settings,
    Bell,
    Flame
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { WrapChart } from '../../../lib/chartWrapper';
import { Button } from '../../ui/UIComponents';
import toast from 'react-hot-toast';

// ─── Greeting Helpers ────────────────────────────────────────────────
function getGreeting(): { text: string; Icon: React.FC<any> } {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return { text: 'Good morning', Icon: Sun };
    if (h >= 12 && h < 17) return { text: 'Good afternoon', Icon: Sun };
    if (h >= 17 && h < 21) return { text: 'Good evening', Icon: Sunset };
    return { text: 'Good night', Icon: Moon };
}

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    icon: React.FC<any>;
    completed: boolean;
    action: string;
    actionUrl?: string;
    reward?: string;
}

interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: React.FC<any>;
    unlocked: boolean;
    progress: number;
    maxProgress: number;
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
    const { currentTenant } = useTenant();
    const [metrics, setMetrics] = useState({
        totalRevenue: stats?.totalRevenue || 0,
        totalClients: stats?.clientCount || 0,
        activeProjects: stats?.activeProjects || 0,
        pendingInvoices: stats?.pendingInvoices || 0,
        overdueInvoices: stats?.overdueInvoices || 0,
        weightedPipeline: stats?.weightedPipeline || 0,
        salesForecast: stats?.salesForecast || 0
    });
    const [revenueData, setRevenueData] = useState<any[]>(stats?.monthlyRevenue || []);
    const [loading, setLoading] = useState(!stats);
    const [showOnboarding, setShowOnboarding] = useState(true);
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStep[]>([]);
    const [progressPercentage, setProgressPercentage] = useState(0);
    const [streak, setStreak] = useState(0);
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const greeting = getGreeting();
    const firstName = (user.name || user.email || 'there').split(' ')[0];

    useEffect(() => {
        loadDashboardData();
        generateWelcomeMessage();
    }, [currentTenant]);

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

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            
            if (!currentTenant?.id) {
                console.log('No tenant ID, using demo data');
                loadDemoData();
                return;
            }

            // Load real data from API
            const response = await fetch(`/api/dashboard/progress?tenantId=${currentTenant.id}`);
            const data = await response.json();

            if (data.success) {
                const progressData = data.data;
                
                setMetrics({
                    totalRevenue: progressData.totalRevenue,
                    totalClients: progressData.clientCount,
                    activeProjects: progressData.activeProjects,
                    pendingInvoices: progressData.pendingInvoices,
                    overdueInvoices: 0, // Calculate from invoices
                    weightedPipeline: 0, // Calculate from leads
                    salesForecast: 0 // Calculate from pipeline
                });

                setRevenueData(progressData.monthlyRevenue || []);
                setProgressPercentage(progressData.progressPercentage);
                setStreak(progressData.streak);
                setAchievements(progressData.achievements || []);

                // Update onboarding steps based on real data
                const steps: OnboardingStep[] = [
                    {
                        id: 'first-client',
                        title: 'Add Your First Client',
                        description: 'Start building your client base',
                        icon: Users,
                        completed: progressData.onboardingProgress?.hasClients || false,
                        action: 'Add Client',
                        actionUrl: '/dashboard/crm',
                        reward: '🎉 Client Master Badge'
                    },
                    {
                        id: 'first-invoice',
                        title: 'Create Your First Invoice',
                        description: 'Start tracking your revenue',
                        icon: FileText,
                        completed: progressData.onboardingProgress?.hasRevenue || false,
                        action: 'Create Invoice',
                        actionUrl: '/dashboard/accounting',
                        reward: '💰 Money Maker Badge'
                    },
                    {
                        id: 'first-project',
                        title: 'Launch Your First Project',
                        description: 'Organize your work effectively',
                        icon: Briefcase,
                        completed: progressData.onboardingProgress?.hasProjects || false,
                        action: 'New Project',
                        actionUrl: '/dashboard/projects',
                        reward: 'Project Pro Badge'
                    },
                    {
                        id: 'setup-integrations',
                        title: 'Connect Your Tools',
                        description: 'Supercharge your workflow',
                        icon: Zap,
                        completed: progressData.onboardingProgress?.hasIntegrations || false,
                        action: 'Setup',
                        actionUrl: '/dashboard/integrations',
                        reward: '⚡ Integration Expert'
                    }
                ];

                setOnboardingSteps(steps);
            } else {
                loadDemoData();
            }

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            loadDemoData();
        } finally {
            setLoading(false);
        }
    };

    const loadDemoData = () => {
        // Fallback demo data for development
        const demoSteps: OnboardingStep[] = [
            {
                id: 'first-client',
                title: 'Add Your First Client',
                description: 'Start building your client base',
                icon: Users,
                completed: false,
                action: 'Add Client',
                actionUrl: '/dashboard/crm',
                reward: '🎉 Client Master Badge'
            },
            {
                id: 'first-invoice',
                title: 'Create Your First Invoice',
                description: 'Start tracking your revenue',
                icon: FileText,
                completed: false,
                action: 'Create Invoice',
                actionUrl: '/dashboard/accounting',
                reward: '💰 Money Maker Badge'
            },
            {
                id: 'first-project',
                title: 'Launch Your First Project',
                description: 'Organize your work effectively',
                icon: Briefcase,
                completed: false,
                action: 'New Project',
                actionUrl: '/dashboard/projects',
                reward: 'Project Pro Badge'
            },
            {
                id: 'setup-integrations',
                title: 'Connect Your Tools',
                description: 'Supercharge your workflow',
                icon: Zap,
                completed: false,
                action: 'Setup',
                actionUrl: '/dashboard/integrations',
                reward: '⚡ Integration Expert'
            }
        ];

        setOnboardingSteps(demoSteps);
        setProgressPercentage(0);
        setStreak(1);

        const demoAchievements: Achievement[] = [
            {
                id: 'client-collector',
                title: 'Client Collector',
                description: 'Add 10 clients',
                icon: Users,
                unlocked: false,
                progress: 0,
                maxProgress: 10
            },
            {
                id: 'revenue-generator',
                title: 'Revenue Generator',
                description: 'Earn $10,000',
                icon: DollarSign,
                unlocked: false,
                progress: 0,
                maxProgress: 10000
            },
            {
                id: 'project-master',
                title: 'Project Master',
                description: 'Complete 5 projects',
                icon: Briefcase,
                unlocked: false,
                progress: 0,
                maxProgress: 5
            }
        ];

        setAchievements(demoAchievements);
    };

    const quickActions: QuickAction[] = [
        {
            id: 'new-client',
            title: 'Add Client',
            description: 'Grow your network',
            icon: UserPlus,
            color: 'bg-blue-500',
            action: () => window.location.href = '/dashboard/crm'
        },
        {
            id: 'new-invoice',
            title: 'Create Invoice',
            description: 'Get paid faster',
            icon: FileText,
            color: 'bg-green-500',
            action: () => window.location.href = '/dashboard/accounting'
        },
        {
            id: 'schedule-meeting',
            title: 'Schedule Meeting',
            description: 'Connect with clients',
            icon: Calendar,
            color: 'bg-purple-500',
            action: () => window.location.href = '/dashboard/calendar'
        },
        {
            id: 'view-reports',
            title: 'View Reports',
            description: 'Track your progress',
            icon: BarChart2,
            color: 'bg-orange-500',
            action: () => window.location.href = '/dashboard/reports'
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
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Professional Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Good {greeting}, {firstName}
                    </h1>
                    <p className="text-slate-600 mt-1">{welcomeMessage}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                        Quick Add
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                        New Project
                    </button>
                </div>
            </div>

            {/* Onboarding Progress */}
            {progressPercentage < 100 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-slate-800 rounded-2xl p-6 border border-slate-700"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                            <Rocket className="w-5 h-5 text-blue-400" />
                            Quick Start Guide
                        </h2>
                        <button
                            onClick={() => setShowOnboarding(!showOnboarding)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            {showOnboarding ? 'Hide' : 'Show'}
                        </button>
                    </div>

                    <AnimatePresence>
                        {showOnboarding && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="space-y-3"
                            >
                                {onboardingSteps.map((step, index) => (
                                    <motion.div
                                        key={step.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className={`flex items-center justify-between p-4 rounded-lg border ${
                                            step.completed 
                                                ? 'bg-green-500/10 border-green-500/30' 
                                                : 'bg-slate-700/50 border-slate-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                                step.completed ? 'bg-green-500' : 'bg-slate-600'
                                            }`}>
                                                <step.icon className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-white">{step.title}</h3>
                                                <p className="text-sm text-slate-400">{step.description}</p>
                                                {step.completed && step.reward && (
                                                    <p className="text-xs text-green-400 mt-1">🎁 {step.reward}</p>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {!step.completed && step.actionUrl && (
                                            <Button
                                                onClick={() => window.location.href = step.actionUrl}
                                                className="bg-blue-500 hover:bg-blue-600"
                                            >
                                                {step.action}
                                            </Button>
                                        )}
                                        
                                        {step.completed && (
                                            <CheckCircle className="w-6 h-6 text-green-400" />
                                        )}
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* Lead Discovery Integration */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <PlaywrightIntegration />
            </motion.div>

            {/* Email Integrations */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
                <SendGridIntegration />
                <ResendIntegration />
            </motion.div>

            {/* Slack Integration */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <SlackIntegration />
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
                    {quickActions.filter(action => action && action.icon).map((action, index) => (
                        <motion.button
                            key={action.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 + index * 0.05 }}
                            onClick={action.action}
                            className="bg-gradient-to-r from-teal-500/20 to-orange-500/20 hover:from-teal-500/30 hover:to-orange-500/30 border border-teal-500/30 hover:border-orange-500/50 p-2 rounded-lg text-white transition-all transform hover:scale-105"
                        >
                            <action.icon className="w-4 h-4 mb-1 text-teal-400 group-hover:text-orange-400 transition-colors" />
                            <div className="text-xs font-medium">{action.title}</div>
                        </motion.button>
                    ))}
                </div>
            </motion.div>

            {/* Stats with Emotional Context */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    {
                        label: 'Total Revenue',
                        value: `$${metrics.totalRevenue.toLocaleString()}`,
                        icon: DollarSign,
                        color: 'text-green-400',
                        bgColor: 'bg-green-500/10',
                        borderColor: 'border-green-500/30',
                        emotion: metrics.totalRevenue > 0 ? '🎉 Killing it!' : '💰 Time to earn!',
                        trend: '+12%'
                    },
                    {
                        label: 'Active Clients',
                        value: metrics.totalClients.toString(),
                        icon: Users,
                        color: 'text-blue-400',
                        bgColor: 'bg-blue-500/10',
                        borderColor: 'border-blue-500/30',
                        emotion: metrics.totalClients > 5 ? '🌟 Network growing!' : '🤝 Start connecting!',
                        trend: '+3'
                    },
                    {
                        label: 'Active Projects',
                        value: metrics.activeProjects.toString(),
                        icon: Briefcase,
                        color: 'text-purple-400',
                        bgColor: 'bg-purple-500/10',
                        borderColor: 'border-purple-500/30',
                        emotion: metrics.activeProjects > 0 ? 'Building momentum!' : 'Time to build!',
                        trend: '+2'
                    },
                    {
                        label: 'Pending Invoices',
                        value: metrics.pendingInvoices.toString(),
                        icon: FileText,
                        color: 'text-orange-400',
                        bgColor: 'bg-orange-500/10',
                        borderColor: 'border-orange-500/30',
                        emotion: metrics.pendingInvoices > 0 ? '💸 Get paid!' : '✅ All caught up!',
                        trend: metrics.pendingInvoices > 0 ? '-1' : '0'
                    }
                ].map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + index * 0.1 }}
                        className={`bg-slate-800 rounded-xl p-6 border ${stat.borderColor}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                            <span className="text-xs text-green-400 font-medium">{stat.trend}</span>
                        </div>
                        <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                        <div className="text-sm text-slate-400 mb-2">{stat.label}</div>
                        <div className="text-xs text-slate-500">{stat.emotion}</div>
                    </motion.div>
                ))}
            </div>

            {/* Achievements */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-slate-800 rounded-2xl p-6 border border-slate-700"
            >
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-400" />
                    Achievements
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {achievements.map((achievement, index) => (
                        <motion.div
                            key={achievement.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.7 + index * 0.1 }}
                            className={`p-4 rounded-lg border ${
                                achievement.unlocked 
                                    ? 'bg-yellow-500/10 border-yellow-500/30' 
                                    : 'bg-slate-700/50 border-slate-600'
                            }`}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    achievement.unlocked ? 'bg-yellow-500' : 'bg-slate-600'
                                }`}>
                                    <achievement.icon className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-medium text-white">{achievement.title}</h3>
                                    <p className="text-xs text-slate-400">{achievement.description}</p>
                                </div>
                                {achievement.unlocked && (
                                    <Star className="w-5 h-5 text-yellow-400" />
                                )}
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-400">
                                    <span>Progress</span>
                                    <span>{achievement.progress}/{achievement.maxProgress}</span>
                                </div>
                                <div className="w-full bg-slate-600 rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full transition-all ${
                                            achievement.unlocked ? 'bg-yellow-400' : 'bg-blue-400'
                                        }`}
                                        style={{ width: `${(achievement.progress / achievement.maxProgress) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* Motivational Message */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white text-center"
            >
                <div className="text-4xl mb-2">💪</div>
                <h3 className="text-xl font-bold mb-2">You're Doing Amazing!</h3>
                <p className="text-purple-100">
                    {progressPercentage === 100 
                        ? "You've mastered the basics! Keep pushing forward and building your empire."
                        : "Every step counts! You're building something incredible, one action at a time."
                    }
                </p>
                <div className="mt-4 flex justify-center gap-4">
                    <Button
                        onClick={() => window.location.href = '/dashboard/integrations'}
                        className="bg-white text-purple-600 hover:bg-purple-50"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Unlock More Features
                    </Button>
                    <Button
                        onClick={() => window.location.href = '/dashboard/settings'}
                        variant="outline"
                        className="border-white text-white hover:bg-white/10"
                    >
                        <Settings className="w-4 h-4 mr-2" />
                        Customize Experience
                    </Button>
                </div>
            </motion.div>
        </div>
    );
};

export default EngagingDashboard;
