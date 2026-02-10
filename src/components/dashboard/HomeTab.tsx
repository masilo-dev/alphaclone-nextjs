import React from 'react';
import { Plus, Briefcase } from 'lucide-react';
import { Button } from '../ui/UIComponents';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Project, User, DashboardStat } from '../../types';
import { useRouter } from 'next/navigation';

interface HomeTabProps {
    user: User;
    currentStats: DashboardStat[];
    filteredProjects: Project[];
    isLoadingProjects: boolean;
    updateProjectStage: (id: string, stage: any) => void;
    STAGES: string[];
}

const HomeTab: React.FC<HomeTabProps> = ({
    user,
    currentStats,
    filteredProjects,
    isLoadingProjects,
    updateProjectStage,
    STAGES
}) => {
    const router = useRouter();

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
                        {user.role === 'admin' ? 'Command Center' : 'Client Dashboard'}
                    </h1>
                    <p className="text-sm sm:text-base text-slate-400 mt-1">
                        Welcome back, <span className="text-teal-400 font-medium">{user.name}</span>.
                    </p>
                </div>
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

            <div className="grid grid-cols-1 gap-8">
                {/* Main Content Area (Projects) */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">
                            {user.role === 'admin' ? 'Global Project Overview' : 'My Active Projects'}
                        </h3>
                    </div>

                    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-xl overflow-x-auto">
                        {isLoadingProjects ? (
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
                                            <tr key={p.id} className="hover:bg-slate-800/40 transition-colors cursor-pointer group">
                                                <td className="px-4 md:px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-lg bg-slate-800 overflow-hidden border border-slate-600 group-hover:border-teal-500/50 transition-colors">
                                                            {p.image && <img src={p.image} className="w-full h-full object-cover" alt={p.name} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-white group-hover:text-teal-400 transition-colors">{p.name}</div>
                                                            <div className="text-xs text-slate-400">{p.category}</div>
                                                        </div>
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
                                                            value={p.currentStage || 'Discovery'}
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
        </div>
    );
};

export default HomeTab;
