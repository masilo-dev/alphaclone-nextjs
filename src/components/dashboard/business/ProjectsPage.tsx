'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { projectService } from '../../../services/projectService';
import { Project as BusinessProject } from '../../../types';
import { contractService } from '../../../services/contractService';
import { businessClientService } from '../../../services/businessClientService';
import {
    Plus,
    X,
    Calendar,
    Users as UsersIcon,
    Trash2,
    TrendingUp,
    BarChart3,
    Briefcase,
    Target,
    CheckCircle2,
    Clock,
    ChevronDown,
    ChevronUp,
    DollarSign,
    AlertCircle,
    Activity,
    Zap,
    LayoutList,
    Download
} from 'lucide-react';
import { exportToCSV } from '../../../utils/exportUtils';
import { TaskCountdown } from '../tasks/TaskCountdown';
import { ProjectStage } from '../../../types';

interface ProjectsPageProps {
    user: User;
}

type ViewMode = 'list' | 'timeline' | 'health';

const PROJECT_STAGES_ORDER: ProjectStage[] = ['Initiation', 'Planning', 'Execution', 'Review', 'Closure'];

// Helper to handle legacy stages since we migrated to 5-stage lifecycle
const getNormalizedStage = (stage: string | undefined): ProjectStage => {
    if (!stage) return 'Initiation';

    // Map legacy stages to new ones
    const legacyMap: Record<string, ProjectStage> = {
        'Discovery': 'Initiation',
        'Design': 'Planning',
        'Development': 'Execution',
        'Testing': 'Review',
        'Deployment': 'Closure',
        'Completed': 'Closure',
        'Maintenance': 'Closure'
    };

    return (legacyMap[stage] || stage) as ProjectStage;
};

const ProjectsPage: React.FC<ProjectsPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [projects, setProjects] = useState<BusinessProject[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [searchQuery, setSearchQuery] = useState('');

    // Deep Linking Support
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

    useEffect(() => {
        if (searchParams?.get('create') === 'true') {
            setShowAddModal(true);
        }
    }, [searchParams]);

    const loadData = useCallback(async () => {
        if (!currentTenant) return;

        // Use cached projects if available before showing full loader to avoid flashing
        if (projects.length === 0) {
            setLoading(true);
        }

        try {
            const [projectRes, clientRes, contractRes] = await Promise.all([
                projectService.getProjects(user.id, user.role),
                businessClientService.getClients(currentTenant.id),
                contractService.getUserContracts(user.id, 'tenant_admin')
            ]);

            setProjects(projectRes.projects || []);
            setClients(clientRes.clients || []);
            setContracts(contractRes.contracts || []);
        } catch (e) {
            console.error('Failed to load mission control data', e);
        } finally {
            setLoading(false);
        }
    }, [currentTenant, user.id, user.role, projects.length]);

    useEffect(() => {
        if (currentTenant) {
            loadData();
        }
    }, [currentTenant, loadData]);

    const [editingProject, setEditingProject] = useState<BusinessProject | null>(null);

    const handleSaveProject = useCallback(async (projectData: Partial<BusinessProject>) => {
        if (!currentTenant) {
            alert("System Error: No active tenant context found. Please refresh.");
            return;
        }

        try {
            if (editingProject) {
                const { error } = await projectService.updateProject(editingProject.id, projectData);
                if (!error) {
                    setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...projectData } : p));
                    setEditingProject(null);
                } else {
                    alert(`Project update failed: ${error}`);
                }
            } else {
                const projectToCreate: any = {
                    ...projectData,
                    ownerId: user.id,
                    ownerName: user.name, // Ensure this exists on User object
                    currentStage: 'Initiation',
                    status: 'Active',
                    // Default missing required fields to avoid DB constraint errors if any
                    progress: 0,
                    team: [],
                    isPublic: false,
                    showInPortfolio: false
                };

                console.log("Creating project:", projectToCreate);
                const { project, error } = await projectService.createProject(projectToCreate);

                if (error) {
                    alert(`Project creation failed: ${error}`);
                    console.error("Creation Error:", error);
                } else if (project) {
                    setProjects(prev => [project, ...prev]);
                    setShowAddModal(false);
                }
            }
        } catch (e) {
            alert(`Critical System Error: ${(e as Error).message}`);
            console.error(e);
        }
    }, [currentTenant, editingProject, user]);

    const handleStageUpdate = useCallback(async (projectId: string, newStage: ProjectStage) => {
        if (!currentTenant) return;

        // Optimistic update
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, currentStage: newStage } : p));

        const { error } = await projectService.updateProject(projectId, { currentStage: newStage });

        if (error) {
            console.error("Failed to update stage:", error);
            // Optionally revert or show toast here
            // For now, silent failure log is acceptable as we might refetch later
        }
    }, [currentTenant]);

    const handleDeleteProject = useCallback(async (projectId: string) => {
        if (!confirm('Delete this project? This action cannot be undone.')) return;
        const { error } = await projectService.deleteProject(projectId);
        if (!error) {
            setProjects(prev => prev.filter(p => p.id !== projectId));
        }
    }, []);

    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const query = searchQuery.toLowerCase();
        return projects.filter(p => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query));
    }, [projects, searchQuery]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
                <div className="text-slate-500 font-black text-xs uppercase tracking-widest animate-pulse">Loading projects...</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-6 p-8 overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-3 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl shadow-xl shadow-violet-500/20">
                            <Briefcase className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
                            Projects <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Overview</span>
                        </h2>
                    </div>
                    <p className="text-slate-500 font-mono text-[10px] uppercase tracking-[0.2em] ml-1 mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        {projects.length} Active Projects
                    </p>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="flex p-1 bg-slate-900 shadow-inner rounded-2xl border border-white/5">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <LayoutList className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-wider">List</span>
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${viewMode === 'timeline' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <BarChart3 className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-wider">Timeline</span>
                        </button>
                        <button
                            onClick={() => setViewMode('health')}
                            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${viewMode === 'health' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Activity className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-wider">Health</span>
                        </button>
                    </div>

                    <button
                        onClick={() => exportToCSV(projects, 'Projects')}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-white/5"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-900 hover:bg-violet-50 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl hover:shadow-white/10 active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        New Project
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
                {viewMode === 'list' ? (
                    <div className="h-full flex flex-col space-y-4">
                        {/* List Header */}
                        <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-900/40 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                            <div className="col-span-5">Project</div>
                            <div className="col-span-2 text-center">Status</div>
                            <div className="col-span-2 text-center">Health & Risk</div>
                            <div className="col-span-2 text-center">Countdown</div>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {filteredProjects.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-500 bg-slate-900/20 rounded-3xl border border-dashed border-white/5">
                                    <Target className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="font-mono text-sm uppercase tracking-widest">No Projects Found</p>
                                </div>
                            ) : (
                                filteredProjects.map((project) => (
                                    <ProjectListRow
                                        key={project.id}
                                        project={project}
                                        onEdit={setEditingProject}
                                        onDelete={handleDeleteProject}
                                        onStageChange={handleStageUpdate}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                ) : viewMode === 'timeline' ? (
                    <ProjectTimeline projects={projects} />
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                        <ProjectHealthDashboard projects={projects} />
                    </div>
                )}
            </div>

            {(showAddModal || editingProject) && (
                <ProjectModal
                    clients={clients}
                    initialData={editingProject}
                    onClose={() => {
                        setShowAddModal(false);
                        setEditingProject(null);
                    }}
                    onSave={handleSaveProject}
                />
            )}
        </div>
    );
};

const ProjectListRow = ({
    project,
    onEdit,
    onDelete,
    onStageChange
}: {
    project: BusinessProject,
    onEdit: any,
    onDelete: any,
    onStageChange: (id: string, stage: ProjectStage) => void
}) => {
    return (
        <div className="group grid grid-cols-1 lg:grid-cols-12 gap-4 items-center px-6 py-4 bg-slate-900/40 hover:bg-slate-800/60 border border-white/5 hover:border-violet-500/30 rounded-2xl transition-all duration-300 relative overflow-hidden">
            {/* Status Indicator Line */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${project.health === 'At Risk' ? 'bg-red-500 animate-pulse' :
                project.health === 'Delayed' ? 'bg-amber-500' :
                    'bg-emerald-500'
                }`} />

            {/* Objective Detail */}
            <div className="col-span-1 lg:col-span-5 flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-slate-950 border border-white/5 shadow-inner`}>
                    <Briefcase className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors truncate">
                        {project.name}
                    </h4>
                    <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider bg-white/5 px-1.5 py-0.5 rounded">
                            {project.category || 'General'}
                        </span>
                        {project.budget && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-400/80 font-mono font-bold">
                                <DollarSign className="w-3 h-3" />
                                {project.budget.toLocaleString()}
                            </span>
                        )}
                        <div className="w-24 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-1000"
                                style={{ width: `${project.progress}%` }}
                            />
                        </div>
                        <span className="text-[9px] font-bold text-slate-500">{project.progress}%</span>
                    </div>
                    {/* Stage Visualizer */}
                    <div className="mt-3">
                        <div className="flex items-center gap-1 mb-1">
                            {PROJECT_STAGES_ORDER.map((stage, index) => {
                                const normalizedStage = getNormalizedStage(project.currentStage);
                                const currentIdx = PROJECT_STAGES_ORDER.indexOf(normalizedStage);
                                const isActive = index <= currentIdx;
                                const isCurrent = index === currentIdx;
                                return (
                                    <div
                                        key={stage}
                                        className={`h-1 flex-1 rounded-full transition-all duration-500 ${isActive ? 'bg-teal-500' : 'bg-slate-700/50'} ${isCurrent ? 'shadow-[0_0_8px_rgba(20,184,166,0.5)]' : ''}`}
                                        title={stage}
                                    />
                                );
                            })}
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                            <select
                                value={getNormalizedStage(project.currentStage)}
                                onChange={(e) => onStageChange(project.id, e.target.value as ProjectStage)}
                                className={`bg-transparent ${project.currentStage ? 'text-teal-400' : ''} font-black hover:text-white cursor-pointer outline-none appearance-none`}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {PROJECT_STAGES_ORDER.map((stage, idx) => {
                                    const currentIdx = PROJECT_STAGES_ORDER.indexOf(getNormalizedStage(project.currentStage));
                                    return (
                                        <option key={stage} value={stage} disabled={idx < currentIdx} className="bg-slate-900 text-slate-300">
                                            {stage}
                                        </option>
                                    );
                                })}
                            </select>
                            <span>Step {PROJECT_STAGES_ORDER.indexOf(getNormalizedStage(project.currentStage)) + 1}/5</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status */}
            <div className="col-span-1 lg:col-span-2 flex justify-center">
                <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${project.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    project.status === 'in_progress' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                        'bg-slate-800 text-slate-400 border-white/5'
                    }`}>
                    {project.status.replace('_', ' ')}
                </span>
            </div>

            {/* Health & Risk */}
            <div className="col-span-1 lg:col-span-2 flex justify-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${project.health === 'At Risk' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                    project.health === 'Delayed' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                    }`}>
                    <Activity className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{project.health || 'Unknown'}</span>
                </div>
            </div>

            {/* Countdown */}
            <div className="col-span-1 lg:col-span-2 flex justify-center">
                {project.dueDate ? (
                    <div className="scale-90 origin-center bg-slate-950/50 px-3 py-1.5 rounded-lg border border-white/5">
                        <TaskCountdown dueDate={project.dueDate} showAlarm={true} />
                    </div>
                ) : (
                    <span className="text-[10px] text-slate-700 font-mono italic">No Deadline</span>
                )}
            </div>

            {/* Ops */}
            <div className="col-span-1 lg:col-span-1 flex justify-end gap-1">
                <button
                    onClick={() => onEdit(project)}
                    className="p-2 hover:bg-violet-500/10 text-slate-500 hover:text-violet-400 rounded-lg transition-all"
                    title="Edit project"
                >
                    <Activity className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(project.id)}
                    className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-all"
                    title="Delete project"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

const ProjectHealthDashboard = ({ projects }: { projects: BusinessProject[] }) => {
    const stats = useMemo(() => {
        const total = projects.length;
        const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0);
        const atRiskCount = projects.filter(p => p.health === 'At Risk' || p.risk === 'High').length;
        const delayedCount = projects.filter(p => p.health === 'Delayed').length;

        return { total, totalBudget, atRiskCount, delayedCount };
    }, [projects]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <HealthStatCard
                    label="Total Projects"
                    value={stats.total}
                    icon={Briefcase}
                    color="text-violet-400"
                    bg="bg-violet-500/10"
                />
                <HealthStatCard
                    label="Portfolio Value"
                    value={`$${stats.totalBudget.toLocaleString()}`}
                    icon={DollarSign}
                    color="text-emerald-400"
                    bg="bg-emerald-500/10"
                />
                <HealthStatCard
                    label="Critical / At Risk"
                    value={stats.atRiskCount}
                    icon={AlertCircle}
                    color="text-red-400"
                    bg="bg-red-500/10"
                    warning={stats.atRiskCount > 0}
                />
                <HealthStatCard
                    label="Delayed Ops"
                    value={stats.delayedCount}
                    icon={Clock}
                    color="text-amber-400"
                    bg="bg-amber-500/10"
                    warning={stats.delayedCount > 0}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Health Distribution Panel could go here */}
                <div className="p-6 bg-slate-900/40 border border-white/5 rounded-3xl">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> System Health Status
                    </h3>
                    <div className="space-y-4">
                        {['On Track', 'At Risk', 'Delayed'].map(status => {
                            const count = projects.filter(p => p.health === status).length;
                            const color = status === 'On Track' ? 'bg-emerald-500' : status === 'At Risk' ? 'bg-red-500' : 'bg-amber-500';
                            return (
                                <div key={status} className="flex items-center gap-4">
                                    <span className="text-xs font-bold text-white w-20">{status}</span>
                                    <div className="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                                        <div className={`h-full ${color} rounded-full transition-all duration-1000`} style={{ width: `${(count / projects.length) * 100}%` }} />
                                    </div>
                                    <span className="text-xs font-mono text-slate-500">{count}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

const HealthStatCard = ({ label, value, icon: Icon, color, bg, warning }: any) => (
    <div className={`p-6 rounded-3xl border transition-all duration-500 group hover:scale-[1.02] ${warning ? 'bg-red-500/5 border-red-500/20' : 'bg-slate-900/40 border-white/5 hover:border-white/10'}`}>
        <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-2xl ${bg} ${warning ? 'animate-pulse' : ''}`}>
                <Icon className={`w-5 h-5 ${color}`} />
            </div>
            {warning && <span className="flex h-2 w-2 rounded-full bg-red-500" />}
        </div>
        <div>
            <div className="text-2xl font-black text-white tracking-tight mb-1">{value}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
        </div>
    </div>
);

const ProjectModal = ({ clients, onClose, onSave, initialData }: any) => {
    const [formData, setFormData] = useState({
        name: '', description: '', status: 'backlog', category: 'General',
        startDate: new Date().toISOString().split('T')[0], dueDate: '',
        progress: 0, clientId: (initialData?.clientId) || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('clientId') : '') || '',
        budget: 0, risk: 'Low', health: 'On Track', resources: [] as string[], currentStage: 'Initiation' as ProjectStage
    });

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                name: initialData.name,
                description: initialData.description || '',
                status: initialData.status,
                startDate: initialData.startDate ? new Date(initialData.startDate).toISOString().split('T')[0] : '',
                dueDate: initialData.dueDate ? new Date(initialData.dueDate).toISOString().split('T')[0] : '',
                progress: initialData.progress || 0,
                clientId: initialData.clientId || '',
                category: initialData.category || 'General',
                budget: initialData.budget || 0,
                risk: initialData.risk || 'Low',
                health: initialData.health || 'On Track',
                resources: initialData.resources || [],
                currentStage: getNormalizedStage(initialData.currentStage)
            }));
        }
    }, [initialData]);

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full shadow-2xl shadow-violet-500/10 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-white">{initialData ? 'Edit Project' : 'New Project'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-300 ml-1">Project Name *</label>
                        <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-5 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-medium focus:border-violet-400 outline-none transition-all shadow-inner" placeholder="Website Redesign..." />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-300 ml-1">Briefing</label>
                        <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3}
                            className="w-full px-5 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-normal focus:border-violet-400 outline-none transition-all resize-none shadow-inner" placeholder="Project details..." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Due Date</label>
                            <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-bold focus:border-violet-400 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Client</label>
                            <select value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-bold focus:border-violet-400 outline-none appearance-none">
                                <option value="">Internal</option>
                                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Live Stage</label>
                            <select
                                value={formData.currentStage}
                                onChange={(e) => setFormData({ ...formData, currentStage: e.target.value as any })}
                                className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-bold focus:border-violet-400 outline-none appearance-none"
                            >
                                {PROJECT_STAGES_ORDER.map((stage, idx) => {
                                    const currentIdx = initialData ? PROJECT_STAGES_ORDER.indexOf(getNormalizedStage(initialData.currentStage)) : 0;
                                    return (
                                        <option key={stage} value={stage} disabled={idx < currentIdx}>{stage}</option>
                                    );
                                })}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Health Status</label>
                            <select
                                value={formData.health}
                                onChange={(e) => setFormData({ ...formData, health: e.target.value as any })}
                                className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-bold focus:border-violet-400 outline-none appearance-none"
                            >
                                <option value="On Track">On Track</option>
                                <option value="At Risk">At Risk</option>
                                <option value="Delayed">Delayed</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-300 ml-1">Budget</label>
                        <input
                            type="number"
                            value={formData.budget}
                            onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                            className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-bold focus:border-violet-400 outline-none shadow-inner"
                            placeholder="0.00"
                        />
                    </div>

                    <div className="flex gap-4 pt-6">
                        <button type="button" onClick={onClose} className="flex-1 px-6 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold text-sm text-slate-300 transition-all">Cancel</button>
                        <button type="submit" className="flex-1 px-6 py-4 bg-violet-600 hover:bg-violet-500 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-violet-500/20 active:scale-95">{initialData ? 'Save Changes' : 'Create Project'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ProjectTimeline = ({ projects }: { projects: BusinessProject[] }) => {
    // Reusing existing timeline logic for now, but enabling it within the new layout
    const sorted = [...projects].sort((a, b) => new Date(a.startDate || a.createdAt || 0).getTime() - new Date(b.startDate || b.createdAt || 0).getTime());
    const timelineStart = new Date();
    timelineStart.setDate(1);
    const timelineEnd = new Date(timelineStart);
    timelineEnd.setMonth(timelineEnd.getMonth() + 6);
    const months = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(timelineStart);
        d.setMonth(d.getMonth() + i);
        return d;
    });

    const getPosition = (dateStr: string | undefined, fallback: Date) => {
        const date = dateStr ? new Date(dateStr) : fallback;
        const totalMs = timelineEnd.getTime() - timelineStart.getTime();
        const startMs = date.getTime() - timelineStart.getTime();
        return Math.max(0, Math.min(100, (startMs / totalMs) * 100));
    };

    return (
        <div className="glass-panel overflow-hidden rounded-3xl border border-white/5 flex flex-col h-full min-h-[500px] backdrop-blur-xl bg-slate-950/20">
            <div className="flex border-b border-white/10 bg-slate-900/40 sticky top-0 z-20">
                <div className="w-64 min-w-[16rem] p-4 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] border-r border-white/5">Project Timeline</div>
                <div className="flex-1 relative h-12 flex">
                    {months.map((m, i) => (
                        <div key={i} className="flex-1 border-r border-white/5 last:border-0 p-3 text-center flex flex-col justify-center">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{m.toLocaleDateString('default', { month: 'short' })}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-white/5">
                {sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-30">
                        <BarChart3 className="w-12 h-12 mb-4" />
                        <p className="text-sm font-black uppercase tracking-widest">No Active Timelines</p>
                    </div>
                ) : sorted.map(proj => {
                    const startPos = getPosition(proj.startDate || proj.createdAt, new Date());
                    const endPos = getPosition(proj.dueDate, new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000));
                    const width = Math.max(2, endPos - startPos);

                    return (
                        <div key={proj.id} className="flex hover:bg-white/[0.02] group transition-all duration-300 border-l-2 border-transparent hover:border-violet-500/30">
                            <div className="w-64 min-w-[16rem] p-4 flex flex-col gap-1 border-r border-white/5 bg-slate-900/20 backdrop-blur-sm">
                                <h4 className="text-xs font-bold text-slate-200 group-hover:text-violet-400 transition-colors truncate">{proj.name}</h4>
                            </div>
                            <div className="flex-1 relative h-14 flex items-center px-2">
                                <div className="absolute inset-0 flex divide-x divide-white/5 pointer-events-none">
                                    {months.map((_, i) => <div key={i} className="flex-1 h-full"></div>)}
                                </div>
                                <div
                                    className="absolute h-6 rounded-lg group-hover:h-7 transition-all duration-300 flex items-center shadow-lg hover:shadow-violet-500/10 overflow-hidden cursor-pointer bg-gradient-to-r from-violet-500/20 to-indigo-500/20 border border-violet-500/30"
                                    style={{ left: `${startPos}%`, width: `${width}%` }}
                                >
                                    <div className="absolute top-0 bottom-0 left-0 bg-violet-500/20" style={{ width: `${proj.progress}%` }}></div>
                                    <span className="relative px-3 text-[9px] font-black text-white uppercase tracking-wider truncate drop-shadow-md">{proj.name}</span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

export default ProjectsPage;
