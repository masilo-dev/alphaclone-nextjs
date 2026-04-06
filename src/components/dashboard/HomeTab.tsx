import React, { useMemo, useState, useEffect } from 'react';
import { Plus, Briefcase, Clock, Calendar, FileText, AlertCircle, Sun, Moon, Coffee, Zap, GripVertical } from 'lucide-react';
import { Button } from '../ui/UIComponents';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Project, User, DashboardStat } from '../../types';
import { useRouter } from 'next/navigation';
import { AIPredictiveWidget } from './AIPredictiveWidget';
import { MomentumHUD } from './MomentumHUD';
import { motion } from 'framer-motion';

interface HomeTabProps {
    user: User;
    currentStats: DashboardStat[];
    filteredProjects: Project[];
    isLoadingProjects: boolean;
    updateProjectStage: (id: string, stage: any) => void;
    STAGES: string[];
    onProjectClick: (id: string) => void;
    // Momentum Metrics
    momentumScore?: number;
    loginStreak?: number;
    activity24h?: number;
    newLeads24h?: number;
}

const getGreeting = (): { text: string; Icon: any } => {
    const hour = new Date().getHours();
    if (hour < 6) return { text: 'Burning the midnight oil', Icon: Moon };
    if (hour < 12) return { text: 'Good morning', Icon: Coffee };
    if (hour < 17) return { text: 'Good afternoon', Icon: Sun };
    if (hour < 21) return { text: 'Good evening', Icon: Zap };
    return { text: 'Working late', Icon: Moon };
};

import { CelebrationOverlay } from '../ui/CelebrationOverlay';

const TodayAgendaCard: React.FC<{ projects: Project[]; user: User }> = ({ projects, user }) => {
    const { text: greeting, Icon: GreetIcon } = useMemo(() => getGreeting(), []);

    const overdue = useMemo(() =>
        projects.filter(p => {
            if (!p.dueDate || p.status === 'done') return false;
            return new Date(p.dueDate) < new Date();
        }), [projects]);

    const dueToday = useMemo(() =>
        projects.filter(p => {
            if (!p.dueDate) return false;
            const due = new Date(p.dueDate);
            const now = new Date();
            return due.toDateString() === now.toDateString();
        }), [projects]);

    const inProgress = projects.filter(p => p.status === 'in_progress' || p.status === 'Active');

    const items: { label: string; value: string | number; color: string; icon: any }[] = [
        { label: 'Overdue', value: overdue.length, color: overdue.length > 0 ? 'text-red-400' : 'text-slate-500', icon: AlertCircle },
        { label: 'Due Today', value: dueToday.length, color: dueToday.length > 0 ? 'text-amber-400' : 'text-slate-500', icon: Calendar },
        { label: 'In Progress', value: inProgress.length, color: 'text-teal-400', icon: Clock },
        { label: 'Total Active', value: projects.length, color: 'text-violet-400', icon: Briefcase },
    ];

    return (
        <div className="bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-6">
            {/* Greeting */}
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <GreetIcon className="w-4 h-4 text-teal-400" />
                    <span className="text-xs font-bold text-teal-400 uppercase tracking-widest">{greeting}</span>
                </div>
                <h2 className="text-lg font-black text-white">
                    {user?.name?.split(' ')[0] || 'Member'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Agenda stats */}
            <div className="flex flex-wrap sm:flex-nowrap gap-4 sm:gap-6">
                {items.map(({ label, value, color, icon: Icon }) => (
                    <div key={label} className="flex flex-col items-center">
                        <div className={`text-xl font-black ${color}`}>{value}</div>
                        <div className="flex items-center gap-1 mt-0.5">
                            <Icon className={`w-3 h-3 ${color}`} />
                            <span className="text-[10px] text-slate-600 uppercase tracking-wider font-bold">{label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const HomeTab: React.FC<HomeTabProps> = ({
    user,
    currentStats,
    filteredProjects,
    isLoadingProjects,
    updateProjectStage,
    STAGES,
    onProjectClick,
    momentumScore = 0,
    loginStreak = 0,
    activity24h = 0,
    newLeads24h = 0
}) => {
    const router = useRouter();
    const [celebration, setCelebration] = useState<{ show: boolean, message: string }>({ 
        show: false, 
        message: '' 
    });

    // Widget customization state
    const [widgetOrder, setWidgetOrder] = useState<string[]>(['momentum', 'agenda', 'ai-widget', 'stats']);
    const [draggedItem, setDraggedItem] = useState<string | null>(null);

    // Load widget order from localStorage
    useEffect(() => {
        const savedOrder = localStorage.getItem('widgetOrder');
        if (savedOrder) {
            setWidgetOrder(JSON.parse(savedOrder));
        }
    }, []);

    // Save widget order to localStorage
    useEffect(() => {
        localStorage.setItem('widgetOrder', JSON.stringify(widgetOrder));
    }, [widgetOrder]);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, widgetId: string) => {
        setDraggedItem(widgetId);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetWidgetId: string) => {
        e.preventDefault();
        if (!draggedItem || draggedItem === targetWidgetId) return;

        const newOrder = [...widgetOrder];
        const draggedIndex = newOrder.indexOf(draggedItem);
        const targetIndex = newOrder.indexOf(targetWidgetId);

        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedItem);

        setWidgetOrder(newOrder);
        setDraggedItem(null);
    };

    const handleActionComplete = (message: string) => {
        setCelebration({ show: true, message });
    };

    return (
        <div className="space-y-6 animate-fade-in relative">
            {/* Celebration Overlay */}
            <CelebrationOverlay 
                show={celebration.show} 
                message={celebration.message}
                onComplete={() => setCelebration(prev => ({ ...prev, show: false }))}
            />

            {/* Render widgets in custom order */}
            {widgetOrder.map((widgetId) => {
                const isDragging = draggedItem === widgetId;
                
                return (
                    <div
                        key={widgetId}
                        draggable
                        onDragStart={(e) => handleDragStart(e as React.DragEvent<HTMLDivElement>, widgetId)}
                        onDragOver={(e) => handleDragOver(e as React.DragEvent<HTMLDivElement>)}
                        onDrop={(e) => handleDrop(e as React.DragEvent<HTMLDivElement>, widgetId)}
                        className={`relative group ${isDragging ? 'opacity-50' : ''}`}
                        style={{ cursor: 'move' }}
                    >
                        {/* Drag handle */}
                        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="p-1 bg-slate-800 rounded cursor-grab">
                                <GripVertical className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>

                        {widgetId === 'momentum' && (
                            <motion.div
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                <MomentumHUD 
                                    score={momentumScore}
                                    streak={loginStreak}
                                    activity24h={activity24h}
                                    newLeads={newLeads24h}
                                />
                            </motion.div>
                        )}

                        {widgetId === 'agenda' && (
                            <TodayAgendaCard projects={filteredProjects} user={user} />
                        )}

                        {widgetId === 'ai-widget' && (
                            <AIPredictiveWidget onActionComplete={handleActionComplete} />
                        )}

                        {widgetId === 'stats' && (
                            /* Stats Row */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="dashboard-overview">
                                {currentStats.map((stat, idx) => (
                                    <div key={idx} className="bg-slate-900/60 backdrop-blur border border-slate-700 p-4 md:p-5 rounded-2xl hover:border-teal-500/30 transition-colors group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={`p-2.5 rounded-lg ${stat.color} bg-opacity-10 text-white`}>
                                                {stat.icon && <stat.icon className="w-5 h-5" />}
                                            </div>
                                        </div>
                                        <div className="text-2xl font-bold text-white mb-1 group-hover:text-teal-400 transition-colors">{stat.value}</div>
                                        <div className="text-sm text-slate-500">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}


            {/* Projects Table */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">
                        {user.role === 'admin' ? 'Global Project Overview' : 'My Active Projects'}
                    </h3>
                    {user.role === 'client' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push('/dashboard?tab=projects')}
                            className="text-xs"
                        >
                            View All
                        </Button>
                    )}
                </div>

                {isLoadingProjects ? (
                    <TableSkeleton />
                ) : filteredProjects.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                         {/* ... table content ... */}
                         <div className="bg-slate-900/40 p-4 text-center text-xs text-slate-500">
                             Project list displayed in detail view.
                         </div>
                    </div>
                ) : (
                    <EmptyState
                        icon={Briefcase}
                        title="No active projects"
                        description="Start a new project to track progress."
                        action={
                            <Button 
                                variant="primary" 
                                onClick={() => router.push('/dashboard?tab=projects')}
                                className="bg-teal-600 hover:bg-teal-500"
                            >
                                Start First Project
                            </Button>
                        }
                    />
                )}
            </div>
        </div>
    );
};

export default HomeTab;
