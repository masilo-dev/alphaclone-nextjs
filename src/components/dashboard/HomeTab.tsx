import React, { useMemo } from 'react';
import { Plus, Briefcase, Clock, Calendar, FileText, AlertCircle, Sun, Moon, Coffee, Zap } from 'lucide-react';
import { Button } from '../ui/UIComponents';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Project, User, DashboardStat } from '../../types';
import { useRouter } from 'next/navigation';
import LoomVideo from '../ui/LoomVideo';

interface HomeTabProps {
    user: User;
    currentStats: DashboardStat[];
    filteredProjects: Project[];
    isLoadingProjects: boolean;
    updateProjectStage: (id: string, stage: any) => void;
    STAGES: string[];
    onProjectClick: (id: string) => void;
}

const getGreeting = (): { text: string; Icon: any } => {
    const hour = new Date().getHours();
    if (hour < 6) return { text: 'Burning the midnight oil', Icon: Moon };
    if (hour < 12) return { text: 'Good morning', Icon: Coffee };
    if (hour < 17) return { text: 'Good afternoon', Icon: Sun };
    if (hour < 21) return { text: 'Good evening', Icon: Zap };
    return { text: 'Working late', Icon: Moon };
};

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
    onProjectClick
}) => {
    const router = useRouter();

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Today's Agenda Card */}
            <TodayAgendaCard projects={filteredProjects} user={user} />

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

            {/* Quick Tour Section */}
            <div className="grid grid-cols-1 gap-6">
                <div className="glass-card p-6 rounded-2xl border border-teal-500/20 overflow-hidden">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-teal-500/10 rounded-lg">
                            <Zap className="w-5 h-5 text-teal-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">Platform Quick Start</h3>
                            <p className="text-xs text-slate-400">Watch early access documentation tour</p>
                        </div>
                    </div>
                    <div className="aspect-video w-full rounded-xl overflow-hidden shadow-2xl border border-white/5">
                        <LoomVideo 
                            videoId="3a7000c925c145b7882089688b0ceb5d" 
                            title="AlphaClone Dashboard Tour"
                        />
                    </div>
                </div>
            </div>

            {/* Projects Table */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">
                        {user.role === 'admin' ? 'Global Project Overview' : 'My Active Projects'}
                    </h3>
                    {user.role === 'client' && (
                        <Button
                            onClick={() => router.push('/dashboard/submit')}
                            className="shadow-teal-900/20"
                            aria-label="Create new project request"
                        >
                            <Plus className="w-4 h-4 mr-2" aria-hidden="true" /> New Request
                        </Button>
                    )}
                </div>

                <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-xl overflow-x-auto">
                    {isLoadingProjects && filteredProjects.length === 0 ? (
                        <div className="p-4 md:p-6">
                            <TableSkeleton rows={5} />
                        </div>
                    ) : filteredProjects.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-400">
                                <thead className="bg-slate-950/50 text-xs uppercase font-semibold text-slate-400">
                                    <tr>
                                        <th className="px-6 py-4">Project Name</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Stage</th>
                                        <th className="px-6 py-4">Completion</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredProjects.map((p) => (
                                        <tr
                                            key={p.id}
                                            className="group hover:bg-slate-900/40 border-b border-slate-900/50 transition-all cursor-pointer"
                                            onClick={() => onProjectClick(p.id)}
                                        >
                                            <td className="px-6 py-4">
                                                <div>
                                                    <div className="text-sm font-bold text-white group-hover:text-teal-400 transition-colors uppercase tracking-tight">{p.name}</div>
                                                    <div className="text-[10px] text-slate-500 uppercase font-mono mt-0.5">{p.category}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 md:px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${p.status === 'Active' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                    p.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                                        p.status === 'Declined' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                                    }`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="px-4 md:px-6 py-4 font-mono text-xs text-white">
                                                {user.role === 'admin' ? (
                                                    <select
                                                        className="bg-transparent border-none text-xs text-white focus:ring-0 cursor-pointer p-0"
                                                        value={p.currentStage || 'Initiation'}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={(e) => updateProjectStage(p.id, e.target.value as any)}
                                                    >
                                                        {STAGES.map(s => <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>)}
                                                    </select>
                                                ) : (
                                                    p.currentStage
                                                )}
                                            </td>
                                            <td className="px-4 md:px-6 py-4">
                                                <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-1000" style={{ width: `${p.progress}%` }} />
                                                </div>
                                                <div className="text-xs mt-1 text-right">{p.progress}%</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState
                            icon={Briefcase}
                            title="No Projects Found"
                            description="Get started by creating your first request."
                            action={<Button onClick={() => router.push('/dashboard/submit')} variant="outline">Create Request</Button>}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default HomeTab;
