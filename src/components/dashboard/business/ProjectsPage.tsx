'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { projectService } from '../../../services/projectService';
import { supabase } from '../../../lib/supabase';
import { businessClientService } from '../../../services/businessClientService';
import { Project as BusinessProject } from '../../../types';
import { contractService } from '../../../services/contractService';
import { buildMailComposeUrl } from '@/lib/email/composeNavigation';
import { milestoneService } from '../../../services/milestoneService';
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
    Download,
    FileText,
    Share2,
    Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ProjectPortalShareDialog } from './ProjectPortalShareDialog';
import { showActionNextSteps } from '../../common/showActionNextSteps';
import { OperationalWorkflowStrip } from '../OperationalWorkflowStrip';
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
    const router = useRouter();
    const nextSearch = useSearchParams();
    const { currentTenant } = useTenant();
    const [projects, setProjects] = useState<BusinessProject[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewingProject, setViewingProject] = useState<BusinessProject | null>(null);

    useEffect(() => {
        if (!nextSearch) return;
        if (nextSearch.get('create') === 'true' || nextSearch.get('new') === 'true') {
            setShowAddModal(true);
            router.replace('/dashboard/business/projects', { scroll: false });
        }
    }, [nextSearch, router]);

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
            toast.error("System Error: No active tenant context found. Please refresh.");
            return;
        }

        try {
            if (editingProject) {
                const { error } = await projectService.updateProject(editingProject.id, projectData);
                if (!error) {
                    setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...projectData } : p));
                    setEditingProject(null);
                } else {
                    toast.error(`Project update failed: ${error}`);
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

                const { project, error } = await projectService.createProject(projectToCreate);

                if (error) {
                    toast.error(`Project creation failed: ${error}`);
                    console.error("Creation Error:", error);
                } else if (project) {
                    setProjects(prev => [project, ...prev]);
                    setShowAddModal(false);
                    toast.success('Project created');
                    showActionNextSteps('project_created', (path) => router.push(path));
                }
            }
        } catch (e) {
            toast.error(`Critical System Error: ${(e as Error).message}`);
            console.error(e);
        }
    }, [currentTenant, editingProject, user]);

    const handleStageUpdate = useCallback(async (projectId: string, newStage: ProjectStage) => {
        if (!currentTenant) return;

        const previousStage = projects.find((project) => project.id === projectId)?.currentStage;
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, currentStage: newStage } : p));

        const { error } = await projectService.updateProject(projectId, { currentStage: newStage });

        if (error) {
            if (previousStage) setProjects(prev => prev.map(p => p.id === projectId ? { ...p, currentStage: previousStage } : p));
            toast.error(`Project stage was not changed: ${error}`);
        }
    }, [currentTenant, projects]);

    const handleDeleteProject = useCallback(async (projectId: string) => {
        if (!confirm('Delete this project? This action cannot be undone.')) return;
        const { error } = await projectService.deleteProject(projectId);
        if (!error) {
            setProjects(prev => prev.filter(p => p.id !== projectId));
            toast.success('Project deleted');
        } else {
            toast.error(`Project could not be deleted: ${error}`);
        }
    }, []);

    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const query = searchQuery.toLowerCase();
        return projects.filter(p => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query));
    }, [projects, searchQuery]);

    if (loading) {
        return (
            <div className="h-full flex flex-col space-y-3 sm:space-y-5 px-3 py-4 sm:px-5 sm:py-6 md:p-8 overflow-y-auto custom-scrollbar min-w-0">
                <div className="flex flex-1 flex-col items-center justify-center gap-4 min-h-[320px]">
                    <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
                    <div className="text-slate-500 text-sm animate-pulse">Loading projects...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-3 sm:space-y-5 px-3 py-4 sm:px-5 sm:py-6 md:p-8 overflow-y-auto custom-scrollbar min-w-0">
            <OperationalWorkflowStrip moduleId="projects" userRole={user.role} />
            {/* Header */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-5 min-w-0">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-1 min-w-0">
                        <div className="p-2.5 sm:p-3 bg-gradient-to-br from-teal-600 to-cyan-600 rounded-xl sm:rounded-2xl shadow-xl shadow-violet-500/20 shrink-0">
                            <Briefcase className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight break-words">
                            Projects <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-indigo-400">Overview</span>
                        </h2>
                    </div>
                    <p className="text-slate-500 text-sm ml-1 mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        {projects.length} Active Projects
                    </p>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="flex p-1 bg-slate-900 shadow-inner rounded-full border border-white/5">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`h-8 px-3 rounded-full transition-all flex items-center gap-1.5 text-[11px] font-bold ${viewMode === 'list' ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <LayoutList className="w-3.5 h-3.5" />
                            <span>List</span>
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`h-8 px-3 rounded-full transition-all flex items-center gap-1.5 text-[11px] font-bold ${viewMode === 'timeline' ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>Timeline</span>
                        </button>
                        <button
                            onClick={() => setViewMode('health')}
                            className={`h-8 px-3 rounded-full transition-all flex items-center gap-1.5 text-[11px] font-bold ${viewMode === 'health' ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Activity className="w-3.5 h-3.5" />
                            <span>Health</span>
                        </button>
                    </div>

                    <button
                        onClick={() => exportToCSV(projects, 'Projects')}
                        className="flex-1 lg:flex-none inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-white/5 bg-slate-900 px-3 text-[11px] font-bold text-white transition-all hover:bg-slate-800"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex-1 lg:flex-none inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-bold text-slate-900 transition-all hover:bg-violet-50 active:scale-95 shadow-xl hover:shadow-white/10"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        New Project
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
                {viewMode === 'list' ? (
                    <div className="h-full flex flex-col space-y-4">
                        {/* List Header */}
                        <div className="hidden lg:grid grid-cols-12 gap-4 px-5 py-3 bg-slate-900/40 border border-white/5 rounded-full text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                            <div className="col-span-5">Project</div>
                            <div className="col-span-2 text-center">Status</div>
                            <div className="col-span-2 text-center">Health & Risk</div>
                            <div className="col-span-2 text-center">Countdown</div>
                            <div className="col-span-1 text-right">Actions</div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                            {filteredProjects.length === 0 ? (
                                <div className="py-16 flex flex-col items-center justify-center text-slate-500 bg-slate-900/20 rounded-3xl border border-dashed border-white/5">
                                    <Target className="w-12 h-12 mb-3 opacity-20" />
                                    <p className="text-xs text-slate-500">No projects found</p>
                                </div>
                            ) : (
                                filteredProjects.map((project) => (
                                    <ProjectListRow
                                        key={project.id}
                                        project={project}
                                        onEdit={setEditingProject}
                                        onDelete={handleDeleteProject}
                                        onStageChange={handleStageUpdate}
                                        onViewDetails={setViewingProject}
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

            <AnimatePresence>
                {viewingProject && (
                    <ProjectDetailsDrawer
                        project={viewingProject}
                        tenantId={currentTenant?.id || ''}
                        currentUser={user}
                        onClose={() => setViewingProject(null)}
                        onEdit={setEditingProject}
                        onProgressChange={(projectId, progress) => {
                            setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, progress } : p)));
                            setViewingProject((prev) => (prev?.id === projectId ? { ...prev, progress } : prev));
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

const ProjectListRow = ({
    project,
    onEdit,
    onDelete,
    onStageChange,
    onViewDetails
}: {
    project: BusinessProject,
    onEdit: any,
    onDelete: any,
    onStageChange: (id: string, stage: ProjectStage) => void,
    onViewDetails: (project: BusinessProject) => void
}) => {
    return (
        <div 
            onClick={() => onViewDetails(project)}
            className="group grid grid-cols-1 lg:grid-cols-12 gap-4 items-center px-6 py-4 bg-slate-900/40 hover:bg-slate-800/60 border border-white/5 hover:border-violet-500/30 rounded-2xl transition-all duration-300 relative overflow-hidden cursor-pointer"
        >
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
                        <span className="text-xs text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                            {project.category || 'General'}
                        </span>
                        {project.budget && (
                            <span className="flex items-center gap-1 text-xs text-emerald-400/80 font-medium">
                                <DollarSign className="w-3 h-3" />
                                {project.budget.toLocaleString()}
                            </span>
                        )}
                        <div className="w-24 h-1 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                            <div
                                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-1000"
                                style={{ width: `${project.progress}%` }}
                            />
                        </div>
                        <span className="text-xs font-bold text-slate-500">{project.progress}%</span>
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
                        <div className="flex justify-between items-center text-xs text-slate-500">
                            <select
                                value={getNormalizedStage(project.currentStage)}
                                onChange={(e) => onStageChange(project.id, e.target.value as ProjectStage)}
                                className={`bg-transparent ${project.currentStage ? 'text-teal-400' : ''} font-medium hover:text-white cursor-pointer outline-none appearance-none`}
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

            {/* Mobile metadata */}
            <div className="lg:hidden grid grid-cols-2 gap-3 pt-3 mt-1 border-t border-white/5">
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Status</span>
                    <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium border ${project.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        project.status === 'in_progress' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                            'bg-slate-800 text-slate-400 border-white/5'
                        }`}>
                        {project.status.replace('_', ' ')}
                    </span>
                </div>
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Health</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs border ${project.health === 'At Risk' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                        project.health === 'Delayed' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                            'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        }`}>
                        {project.health || 'Unknown'}
                    </span>
                </div>
                <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Due</span>
                    {project.dueDate ? (
                        <TaskCountdown dueDate={project.dueDate} showAlarm={true} />
                    ) : (
                        <span className="text-xs text-slate-600 italic">No deadline</span>
                    )}
                </div>
                <div className="flex items-end justify-end gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(project); }}
                        className="h-8 w-8 p-0.5 hover:bg-violet-500/10 text-slate-500 hover:text-violet-400 rounded-full transition-all"
                        title="Edit project"
                    >
                        <Activity className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                        className="h-8 w-8 p-0.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-full transition-all"
                        title="Delete project"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Status */}
            <div className="hidden lg:flex col-span-1 lg:col-span-2 justify-center">
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${project.status === 'done' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    project.status === 'in_progress' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' :
                        'bg-slate-800 text-slate-400 border-white/5'
                    }`}>
                    {project.status.replace('_', ' ')}
                </span>
            </div>

            {/* Health & Risk */}
            <div className="hidden lg:flex col-span-1 lg:col-span-2 justify-center gap-2">
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${project.health === 'At Risk' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                    project.health === 'Delayed' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                    }`}>
                    <Activity className="w-3 h-3" />
                    <span>{project.health || 'Unknown'}</span>
                </div>
            </div>

            {/* Countdown */}
            <div className="hidden lg:flex col-span-1 lg:col-span-2 justify-center">
                {project.dueDate ? (
                    <div className="scale-90 origin-center bg-slate-950/50 px-2.5 py-1 rounded-full border border-white/5">
                        <TaskCountdown dueDate={project.dueDate} showAlarm={true} />
                    </div>
                ) : (
                    <span className="text-xs text-slate-600 italic">No deadline</span>
                )}
            </div>

            {/* Ops */}
            <div className="hidden lg:flex col-span-1 lg:col-span-1 justify-end gap-1">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(project); }}
                    className="p-2 hover:bg-violet-500/10 text-slate-500 hover:text-violet-400 rounded-lg transition-all"
                    title="Edit project"
                >
                    <Activity className="w-4 h-4" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
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
                    label="Delayed"
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
                    <h3 className="text-sm font-semibold text-slate-400 mb-6 flex items-center gap-2">
                        <Activity className="w-4 h-4" /> Project Health
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
                                    <span className="text-xs text-slate-500">{count}</span>
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
            <div className="text-2xl font-bold text-white mb-1">{value}</div>
            <div className="text-xs font-medium text-slate-500">{label}</div>
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center z-[1100] p-0 sm:p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-white/10 rounded-t-2xl sm:rounded-[2rem] p-5 sm:p-8 max-w-md w-full max-h-[95dvh] sm:max-h-none overflow-y-auto shadow-2xl shadow-violet-500/10 animate-in zoom-in-95 duration-200 my-auto">
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
    // The timeline uses the same project milestone source as the primary layout.
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
                <div className="w-64 min-w-[16rem] p-4 text-xs font-medium text-slate-400 border-r border-white/5">Project Timeline</div>
                <div className="flex-1 relative h-12 flex">
                    {months.map((m, i) => (
                        <div key={i} className="flex-1 border-r border-white/5 last:border-0 p-3 text-center flex flex-col justify-center">
                            <span className="text-xs text-slate-400">{m.toLocaleDateString('default', { month: 'short' })}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-white/5">
                {sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-30">
                        <BarChart3 className="w-12 h-12 mb-4" />
                        <p className="text-sm text-slate-500">No active timelines</p>
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
                                    <span className="relative px-3 text-xs text-white truncate drop-shadow-md">{proj.name}</span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};


interface ProjectDetailsDrawerProps {
    project: BusinessProject;
    tenantId: string;
    currentUser: User;
    onClose: () => void;
    onEdit: (project: BusinessProject) => void;
    onProgressChange?: (projectId: string, progress: number) => void;
}

const DEFAULT_MILESTONE_LABELS = [
    'Kickoff Meeting & Alignment',
    'Project Scope & Requirements Sign-off',
    'UI/UX Prototypes & Wireframes Approval',
    'Core Infrastructure & Database Setup',
    'First Functional Build Delivery',
    'User Acceptance Testing (UAT)',
    'Production Launch & Handover',
];

const ProjectDetailsDrawer: React.FC<ProjectDetailsDrawerProps> = ({ project, tenantId, currentUser, onClose, onEdit, onProgressChange }) => {
    const router = useRouter();
    const [progress, setProgress] = useState(project.progress || 0);
    const [milestones, setMilestones] = useState<{ id: string; label: string; checked: boolean }[]>([]);
    const [milestonesLoading, setMilestonesLoading] = useState(true);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [comments, setComments] = useState<Array<{
        id: string;
        author_name: string;
        author_email?: string | null;
        content: string;
        is_client: boolean;
        created_at: string;
    }>>([]);
    const [commentsLoading, setCommentsLoading] = useState(true);
    const [commentDraft, setCommentDraft] = useState('');
    const [commentAuthorName, setCommentAuthorName] = useState(currentUser.name || '');
    const [commentAuthorEmail, setCommentAuthorEmail] = useState(currentUser.email || '');
    const [postingComment, setPostingComment] = useState(false);
    const [clientEmail, setClientEmail] = useState('');
    const [clientName, setClientName] = useState('');

    useEffect(() => {
        setProgress(project.progress || 0);
    }, [project.id, project.progress]);

    const handleShareWithClient = () => {
        setShareDialogOpen(true);
    };

    useEffect(() => {
        let cancelled = false;
        const loadMilestones = async () => {
            setMilestonesLoading(true);
            const { milestones: rows } = await milestoneService.getMilestones(project.id);
            if (cancelled) return;

            if (rows.length > 0) {
                setMilestones(rows.map(m => ({
                    id: m.id,
                    label: m.name,
                    checked: m.status === 'completed',
                })));
            } else {
                // Seed default milestones for this project once, persisted to the DB.
                const created: { id: string; label: string; checked: boolean }[] = [];
                for (const label of DEFAULT_MILESTONE_LABELS) {
                    const { milestone } = await milestoneService.createMilestone(project.id, {
                        name: label,
                        status: 'pending',
                    });
                    if (milestone) {
                        created.push({ id: milestone.id, label: milestone.name, checked: false });
                    }
                }
                if (!cancelled) setMilestones(created);
            }
            if (!cancelled) {
                const { progress: recalculated } = await projectService.recalculateProjectProgress(project.id);
                setProgress(recalculated);
                onProgressChange?.(project.id, recalculated);
                setMilestonesLoading(false);
            }
        };
        loadMilestones();
        return () => { cancelled = true; };
    }, [project.id]);

    useEffect(() => {
        let cancelled = false;

        const loadComments = async () => {
            setCommentsLoading(true);
            const { data, error } = await supabase
                .from('project_comments')
                .select('id, author_name, author_email, content, is_client, created_at')
                .eq('project_id', project.id)
                .order('created_at', { ascending: true });

            if (!cancelled && !error) {
                setComments((data || []) as any[]);
            }
            if (!cancelled) {
                setCommentsLoading(false);
            }
        };

        loadComments();
        return () => { cancelled = true; };
    }, [project.id]);

    useEffect(() => {
        let cancelled = false;
        const loadClient = async () => {
            if (!project.clientId) {
                setClientEmail('');
                setClientName('');
                return;
            }

            const { client } = await businessClientService.getClient(project.clientId);
            if (cancelled) return;
            setClientEmail(client?.email || '');
            setClientName(client?.name || '');
        };

        loadClient();
        return () => { cancelled = true; };
    }, [project.clientId]);

    const toggleMilestone = async (id: string) => {
        const target = milestones.find(m => m.id === id);
        if (!target) return;
        const nextChecked = !target.checked;
        // Optimistic update
        setMilestones(prev => prev.map(m => m.id === id ? { ...m, checked: nextChecked } : m));
        const { error } = await milestoneService.updateMilestone(id, {
            status: nextChecked ? 'completed' : 'pending',
        });
        if (error) {
            // Revert on failure
            setMilestones(prev => prev.map(m => m.id === id ? { ...m, checked: !nextChecked } : m));
            import('react-hot-toast').then(({ toast }) => toast.error('Failed to update milestone'));
            return;
        }
        const { progress: recalculated } = await projectService.recalculateProjectProgress(project.id);
        setProgress(recalculated);
        onProgressChange?.(project.id, recalculated);
    };

    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - ((progress || 0) / 100) * circumference;

    const teamList = project.team && project.team.length > 0 ? project.team : [];

    const getHealthColor = (health: string | undefined) => {
        if (health === 'At Risk') return 'bg-red-500';
        if (health === 'Delayed') return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId) return;
        const authorName = commentAuthorName.trim();
        const content = commentDraft.trim();
        if (!authorName || !content) return;

        setPostingComment(true);
        try {
            const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/projects/${encodeURIComponent(project.id)}/comments`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Project comment could not be saved');
            const data = payload.comment;
            if (data) {
                setComments((prev) => [...prev, data as any]);
                setCommentDraft('');

                const notifyResult = await projectService.notifyClientProjectNote(
                    project.id,
                    content,
                    authorName
                );
                import('react-hot-toast').then(({ toast }) => {
                    if (notifyResult?.sent) {
                        toast.success('Note saved and emailed to the client');
                    } else if (notifyResult?.skipped === 'no_client_email' && clientEmail) {
                        toast.success('Note saved (client has no email on file)');
                    } else if (notifyResult?.skipped === 'portal_not_enabled') {
                        toast.success('Note saved (enable client portal to auto-email)');
                    } else {
                        toast.success('Note saved');
                    }
                });
            }
        } catch (err: any) {
            import('react-hot-toast').then(({ toast }) => toast.error(err?.message || 'Failed to add note'));
        } finally {
            setPostingComment(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[1100]"
            />

            {/* Sheet */}
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full h-[92vh] md:h-auto md:max-h-[85vh] md:max-w-md rounded-t-3xl md:rounded-2xl bg-slate-950 border-t md:border border-white/10 flex flex-col overflow-hidden z-[1110] shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            >
                {/* Drag Handle Indicator */}
                <div className="w-12 h-1 bg-slate-800 rounded-full mx-auto my-3 md:hidden" />

                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 bg-slate-900/50 flex justify-between items-start gap-4">
                    <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${getHealthColor(project.health)} animate-pulse`} />
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{project.health || 'On Track'}</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
                    <div>
                        <h3 className="text-xl font-bold text-white mb-2">{project.name}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">{project.description || 'No description provided.'}</p>
                    </div>

                    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between gap-6">
                        <div className="relative w-24 h-24 flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="48" cy="48" r={radius} className="stroke-slate-800" strokeWidth="8" fill="transparent" />
                                <circle cx="48" cy="48" r={radius} className="stroke-violet-500 transition-all duration-500" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white font-mono">
                                {progress || 0}%
                            </div>
                        </div>

                        <div className="flex-1 space-y-2">
                            <div className="text-xs text-slate-500 uppercase tracking-wider">Project Progress</div>
                            {project.budget && (
                                <div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wider">Budget</div>
                                    <div className="text-lg font-bold text-teal-400">${project.budget.toLocaleString()}</div>
                                </div>
                            )}
                            <div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider">Target Date</div>
                                <div className="text-sm font-semibold text-white">
                                    {project.dueDate ? new Date(project.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            <span>Completeness</span>
                            <span>{progress || 0}%</span>
                        </div>
                        <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                            <div
                                className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full transition-all duration-1000"
                                style={{ width: `${progress || 0}%` }}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Project Team</span>
                        {teamList.length > 0 ? (
                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-2 overflow-hidden">
                                    {teamList.map((name, i) => (
                                        <div key={i} className="inline-block rounded-full ring-2 ring-slate-950 bg-teal-600 text-[10px] font-bold flex items-center justify-center text-white select-none" style={{ width: '28px', height: '28px' }}>
                                            {name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                        </div>
                                    ))}
                                </div>
                                <span className="text-xs text-slate-500">{teamList.length} members assigned</span>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500">No team members assigned yet.</p>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Milestones Checklist</span>
                            {milestones.length > 0 && (
                                <span className="text-xs font-bold text-teal-400">
                                    {milestones.filter(m => m.checked).length}/{milestones.length} done
                                </span>
                            )}
                        </div>
                        <div className="space-y-2 bg-slate-950/20 rounded-2xl p-3 border border-white/5 max-h-48 overflow-y-auto custom-scrollbar">
                            {milestonesLoading ? (
                                [...Array(4)].map((_, i) => <div key={i} className="h-6 bg-slate-900/60 rounded animate-pulse" />)
                            ) : milestones.length === 0 ? (
                                <p className="text-xs text-slate-500 py-2 text-center">No milestones yet.</p>
                            ) : (
                                milestones.map((m) => (
                                    <div key={m.id} className="flex items-start gap-3 py-1 cursor-pointer select-none" onClick={() => toggleMilestone(m.id)}>
                                        <input
                                            type="checkbox"
                                            checked={m.checked}
                                            onChange={() => {}}
                                            className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500 focus:ring-offset-0 shrink-0"
                                        />
                                        <span className={`text-sm ${m.checked ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                            {m.label}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Documents</span>
                        <a
                            href="/dashboard/business/documents"
                            className="flex items-center gap-2 p-3 bg-slate-950/40 border border-white/5 rounded-xl hover:border-teal-500/30 transition-all cursor-pointer"
                        >
                            <FileText className="w-4 h-4 text-teal-400 flex-shrink-0" />
                            <span className="text-xs text-slate-300 font-medium">Open Document Hub to manage project files</span>
                        </a>
                    </div>

                    {(clientEmail || clientName) && (
                        <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 space-y-1">
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Client Inbox</p>
                            <p className="text-sm text-white font-semibold truncate">{clientName || 'Linked client'}</p>
                            {clientEmail ? (
                                <button
                                    type="button"
                                    onClick={() => router.push(buildMailComposeUrl(clientEmail, `Re: ${clientName || 'project update'}`))}
                                    className="text-xs text-teal-300 hover:text-teal-200 break-all text-left"
                                >
                                    {clientEmail}
                                </button>
                            ) : (
                                <p className="text-xs text-slate-500">No email address on file yet.</p>
                            )}
                            <p className="text-[11px] text-slate-500">
                                Project notes will be emailed here automatically when available.
                            </p>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Project Notes</span>
                            <span className="text-[11px] text-slate-500">{comments.length} messages</span>
                        </div>
                        <div className="space-y-2 bg-slate-950/20 rounded-2xl p-3 border border-white/5 max-h-72 overflow-y-auto custom-scrollbar">
                            {commentsLoading ? (
                                [...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-900/60 rounded-xl animate-pulse" />)
                            ) : comments.length === 0 ? (
                                <p className="text-xs text-slate-500 py-2 text-center">No notes yet. Add the first project update below.</p>
                            ) : (
                                comments.map((comment) => (
                                    <div key={comment.id} className={`rounded-xl border p-3 ${comment.is_client ? 'border-teal-500/20 bg-teal-500/5' : 'border-white/5 bg-slate-900/60'}`}>
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-white truncate">
                                                    {comment.author_name}
                                                    {comment.is_client ? ' (Client)' : ' (Team)'}
                                                </p>
                                                {comment.author_email && (
                                                    <button
                                                        type="button"
                                                        onClick={() => router.push(buildMailComposeUrl(comment.author_email || '', 'Re: project comment'))}
                                                        className="text-[11px] text-slate-500 hover:text-teal-300 break-all text-left"
                                                    >
                                                        {comment.author_email}
                                                    </button>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-slate-500 shrink-0">
                                                {new Date(comment.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                                    </div>
                                ))
                            )}
                        </div>
                        <form onSubmit={handleAddComment} className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    value={commentAuthorName}
                                    onChange={(e) => setCommentAuthorName(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-sm outline-none focus:border-violet-400"
                                    placeholder="Your name"
                                />
                                <input
                                    value={commentAuthorEmail}
                                    onChange={(e) => setCommentAuthorEmail(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-sm outline-none focus:border-violet-400"
                                    placeholder="Your email"
                                    type="email"
                                />
                            </div>
                            <textarea
                                value={commentDraft}
                                onChange={(e) => setCommentDraft(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-white text-sm outline-none focus:border-violet-400 resize-none min-h-[96px]"
                                placeholder="Leave a note, ask a question, or record a client update..."
                            />
                            <button
                                type="submit"
                                disabled={postingComment || !commentDraft.trim() || !commentAuthorName.trim()}
                                className="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all"
                            >
                                {postingComment ? 'Saving...' : 'Add Note'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Sticky Action Footer */}
                <div className="absolute bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-md px-6 py-4 border-t border-white/10 z-10 flex gap-3 items-center justify-end">
                    <button
                        onClick={handleShareWithClient}
                        title="Copy a public link to share this project's progress and milestones with the client"
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 rounded-xl font-bold text-xs transition-all"
                    >
                        <Share2 className="w-3.5 h-3.5" />
                        Share with Client
                    </button>
                    <button
                        onClick={() => { onEdit(project); onClose(); }}
                        className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-xs transition-all text-center"
                    >
                        Edit Properties
                    </button>
                </div>
            </motion.div>
            <ProjectPortalShareDialog
                isOpen={shareDialogOpen}
                onClose={() => setShareDialogOpen(false)}
                projectId={project.id}
                tenantId={tenantId}
                projectName={project.name}
            />
        </>
    );
};

export default ProjectsPage;
