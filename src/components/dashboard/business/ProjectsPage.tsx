'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
    MoreVertical,
    Trash2,
    Share2,
    Globe,
    Lock,
    Trello,
    BarChart3,
    Briefcase,
    Target,
    CheckCircle2,
    Clock,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MilestoneManager from '../projects/MilestoneManager';

interface ProjectsPageProps {
    user: User;
}

type ViewMode = 'kanban' | 'timeline';

const ProjectsPage: React.FC<ProjectsPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [projects, setProjects] = useState<BusinessProject[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('kanban');
    const [selectedProjectForMilestones, setSelectedProjectForMilestones] = useState<BusinessProject | null>(null);

    // Deep Linking Support
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    useEffect(() => {
        if (searchParams?.get('create') === 'true') {
            setShowAddModal(true);
        }
    }, [searchParams]);

    // Pass clientId if present in URL
    const defaultClientId = searchParams?.get('clientId') || '';

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

    const columns = [
        { id: 'backlog', title: 'Ideas', color: 'border-slate-500', bg: 'bg-slate-500/10' },
        { id: 'todo', title: 'To Do', color: 'border-blue-500', bg: 'bg-blue-500/10' },
        { id: 'in_progress', title: 'In Progress', color: 'border-violet-500', bg: 'bg-violet-500/10' },
        { id: 'review', title: 'Review', color: 'border-orange-500', bg: 'bg-orange-500/10' },
        { id: 'done', title: 'Done', color: 'border-teal-500', bg: 'bg-teal-500/10' }
    ];

    useEffect(() => {
        if (currentTenant) {
            loadData();
        }
    }, [currentTenant]);

    const loadData = async () => {
        if (!currentTenant) return;
        setLoading(true);
        const { projects: projectData } = await projectService.getProjects(user.id, user.role);
        const { clients: clientData } = await businessClientService.getClients(currentTenant.id);
        const { contracts: contractData } = await contractService.getUserContracts(user.id, 'tenant_admin');
        setProjects(projectData || []);
        setClients(clientData || []);
        setContracts(contractData || []);
        setLoading(false);
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;
        const projectId = active.id as string;
        const newStatus = over.id as string;

        const activeProject = projects.find(p => p.id === projectId);
        if (activeProject && activeProject.status !== newStatus) {

            // ENFORCEMENT: Block progress if no signed contract for client projects
            if (activeProject.clientId) {
                const hasContract = contracts.some(c =>
                    c.client_id === activeProject.clientId &&
                    (c.status === 'fully_signed' || c.status === 'client_signed')
                );

                if (!hasContract) {
                    alert('Action Blocked: A signed contract is required before moving this project forward.');
                    setActiveId(null);
                    return;
                }
            }

            await projectService.updateProject(projectId, { status: newStatus as any });
            setProjects(projects.map(p => p.id === projectId ? { ...p, status: newStatus as any } : p));
        }
        setActiveId(null);
    };

    const [editingProject, setEditingProject] = useState<BusinessProject | null>(null);

    const handleSaveProject = async (projectData: Partial<BusinessProject>) => {
        if (!currentTenant) return;

        if (editingProject) {
            // Update existing
            const { error } = await projectService.updateProject(editingProject.id, projectData);
            if (!error) {
                setProjects(projects.map(p => p.id === editingProject.id ? { ...p, ...projectData } : p));
                setEditingProject(null);
            }
        } else {
            // Create new
            const projectToCreate: any = {
                ...projectData,
                ownerId: user.id,
                ownerName: user.name,
                currentStage: 'Discovery',
                status: 'Active'
            };
            const { project, error } = await projectService.createProject(projectToCreate);
            if (!error && project) {
                setProjects([project, ...projects]);
                setShowAddModal(false);
            }
        }
    };

    const handleDeleteProject = async (projectId: string) => {
        if (!confirm('Delete this project? This action cannot be undone.')) return;
        const { error } = await projectService.deleteProject(projectId);
        if (!error) {
            setProjects(projects.filter(p => p.id !== projectId));
        }
    };

    const getProjectsByStatus = (status: string) => projects.filter(p => p.status === status);

    const ProjectTimeline = () => {
        const sorted = [...projects].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
        const timelineStart = new Date();
        timelineStart.setMonth(timelineStart.getMonth() - 1);
        const months = Array.from({ length: 6 }).map((_, i) => {
            const d = new Date(timelineStart);
            d.setMonth(d.getMonth() + i);
            return d;
        });

        return (
            <div className="glass-panel overflow-hidden rounded-3xl border border-white/5 flex flex-col h-full min-h-[500px] backdrop-blur-xl bg-slate-900/40">
                <div className="flex border-b border-white/10 divide-x divide-white/5 bg-slate-950/60 sticky top-0 z-20">
                    <div className="w-80 min-w-80 p-5 font-black text-slate-400 text-xs uppercase tracking-[0.2em]">Project Roadmap</div>
                    <div className="flex-1 overflow-x-auto flex divide-x divide-white/5 scrollbar-hide">
                        {months.map((m, i) => (
                            <div key={i} className="min-w-[200px] p-4 text-center">
                                <span className="text-xs font-black text-slate-300 uppercase tracking-widest">{m.toLocaleDateString('default', { month: 'long', year: 'numeric' })}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                    {sorted.map(proj => {
                        const start = proj.startDate ? new Date(proj.startDate) : new Date(proj.createdAt || new Date().toISOString());
                        const end = proj.dueDate ? new Date(proj.dueDate) : new Date(start);
                        if (end < start) end.setMonth(start.getMonth() + 1);

                        const totalDays = (months[5].getTime() - months[0].getTime()) / (1000 * 60 * 60 * 24);
                        const startPos = ((start.getTime() - months[0].getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;
                        const duration = ((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) / totalDays) * 100;

                        return (
                            <div key={proj.id} className="flex divide-x divide-white/5 hover:bg-white/5 group transition-all duration-300">
                                <div className="w-80 min-w-80 p-5 flex flex-col gap-1 sticky left-0 z-10 bg-slate-900/90 backdrop-blur-xl border-r border-white/5">
                                    <h4 className="text-sm font-semibold text-slate-100 group-hover:text-teal-400 transition-colors uppercase tracking-tight">{proj.name}</h4>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-black text-slate-500 uppercase flex items-center gap-1">
                                            <Target className="w-3 h-3" /> {proj.status.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs font-black text-teal-500 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> {proj.progress}%
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 relative h-16 flex items-center min-w-[1200px]">
                                    <div
                                        className="absolute h-8 rounded-2xl bg-gradient-to-r from-teal-500/20 to-violet-500/20 border border-white/10 group-hover:border-teal-500/30 group-hover:shadow-[0_0_20px_rgba(45,212,191,0.1)] transition-all flex items-center px-4 overflow-hidden"
                                        style={{ left: `${Math.max(0, startPos)}%`, width: `${Math.max(1, duration)}%` }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/40 to-violet-500/40 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <span className="text-xs font-black text-white uppercase tracking-tighter truncate z-10">{proj.name}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="w-12 h-12 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
                <div className="text-slate-500 font-black text-xs uppercase tracking-widest animate-pulse">Syncing Projects...</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-6 bg-slate-950/20 p-4 lg:p-6 rounded-[2.5rem] border border-white/5 backdrop-blur-sm">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-3 bg-gradient-to-br from-teal-500 to-violet-600 rounded-2xl shadow-xl shadow-teal-500/20">
                            <Briefcase className="w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
                            Projects <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-violet-400">Hub</span>
                        </h2>
                    </div>
                    <p className="text-slate-500 font-medium text-sm ml-1">{projects.length} Active Projects</p>
                </div>

                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="flex p-1 bg-slate-900 shadow-inner rounded-2xl border border-white/5">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${viewMode === 'kanban' ? 'bg-gradient-to-r from-teal-500 to-teal-400 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <Trello className="w-4 h-4" />
                            <span className="text-xs font-bold">Board</span>
                        </button>
                        <button
                            onClick={() => setViewMode('timeline')}
                            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${viewMode === 'timeline' ? 'bg-gradient-to-r from-teal-500 to-teal-400 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                        >
                            <BarChart3 className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-wider">Timeline</span>
                        </button>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-900 hover:bg-teal-50 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl hover:shadow-white/10 active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        New Project
                    </button>
                </div>
            </div>

            <div className="hidden lg:block flex-1 overflow-hidden">
                {viewMode === 'kanban' ? (
                    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} collisionDetection={closestCorners} sensors={sensors}>
                        <div className="flex-1 overflow-x-auto scrollbar-hide h-full">
                            <div className="flex gap-6 h-full min-w-max pb-4">
                                {columns.map(column => (
                                    <KanbanColumn
                                        key={column.id}
                                        column={column}
                                        projects={getProjectsByStatus(column.id)}
                                        onDelete={handleDeleteProject}
                                        onEdit={setEditingProject}
                                        onManageMilestones={setSelectedProjectForMilestones}
                                    />
                                ))}
                            </div>
                        </div>
                        <DragOverlay>
                            {activeId ? <ProjectCard project={projects.find(p => p.id === activeId)!} isDragging onDelete={() => { }} onEdit={() => { }} /> : null}
                        </DragOverlay>
                    </DndContext>
                ) : (
                    <div className="flex-1">
                        <ProjectTimeline />
                    </div>
                )}
            </div>

            <div className="lg:hidden flex-1 overflow-y-auto">
                <MobileProjectList projects={projects} onDelete={handleDeleteProject} onEdit={setEditingProject} />
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

const MobileProjectList = ({ projects, onDelete, onEdit, onManageMilestones }: any) => {
    const [expanded, setExpanded] = useState<string | null>(null);

    if (projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 opacity-50">
                <Briefcase className="w-12 h-12 text-slate-500 mb-4" />
                <p className="text-sm font-medium text-slate-400">No Active Projects</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 pb-20">
            {projects.map((project: BusinessProject) => (
                <div key={project.id} className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
                    <div
                        onClick={() => setExpanded(expanded === project.id ? null : project.id)}
                        className="p-4 flex items-center justify-between cursor-pointer active:bg-white/5 transition-colors"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`w-1.5 h-10 rounded-full ${project.status === 'done' ? 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.5)]' :
                                project.status === 'in_progress' ? 'bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]' :
                                    project.status === 'review' ? 'bg-orange-500' :
                                        project.status === 'todo' ? 'bg-blue-500' : 'bg-slate-500'
                                }`} />
                            <div>
                                <h4 className="font-semibold text-white text-base">{project.name}</h4>
                                <span className="text-xs text-slate-500 font-medium flex items-center gap-2">
                                    {project.status.replace('_', ' ')}
                                    <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                    <span className={`${project.progress === 100 ? 'text-teal-400' : 'text-slate-400'}`}>{project.progress}% Complete</span>
                                </span>
                            </div>
                        </div>
                        {expanded === project.id ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                    </div>

                    {expanded === project.id && (
                        <div className="px-4 pb-5 pt-0 border-t border-white/5 space-y-5 animate-in slide-in-from-top-2 duration-200">
                            {project.description && (
                                <p className="text-xs text-slate-400 mt-4 leading-relaxed italic border-l-2 border-slate-800 pl-3">"{project.description}"</p>
                            )}

                            <div className="space-y-2">
                                <div className="w-full bg-slate-950 rounded-full h-2 shadow-inner border border-white/5">
                                    <div className="bg-gradient-to-r from-teal-500 to-violet-500 h-full rounded-full transition-all duration-1000" style={{ width: `${project.progress}%` }} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-slate-950/30 p-3 rounded-xl border border-white/5">
                                {project.startDate && (
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1">Start Date</div>
                                        <div className="text-sm font-semibold text-white flex items-center gap-2">
                                            <Calendar className="w-3 h-3 text-slate-400" />
                                            {new Date(project.startDate).toLocaleDateString()}
                                        </div>
                                    </div>
                                )}
                                {project.dueDate && (
                                    <div>
                                        <div className="text-xs text-slate-500 font-medium mb-1">Due Date</div>
                                        <div className="text-sm font-semibold text-white flex items-center gap-2">
                                            <Target className="w-3 h-3 text-slate-400" />
                                            {new Date(project.dueDate).toLocaleDateString()}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(project); }}
                                    className="flex-1 py-3 bg-slate-800 text-slate-300 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-slate-700 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                    Modify
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onManageMilestones(project); }}
                                    className="flex-1 py-3 bg-teal-500/10 text-teal-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-teal-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                    <Target className="w-4 h-4" /> Phases
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                                    className="px-4 py-3 bg-red-500/10 text-red-500 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const KanbanColumn = ({ column, projects, onDelete, onEdit, onManageMilestones }: any) => {
    return (
        <div className="flex flex-col w-80 group/col">
            <div className={`border-t-4 ${column.color} ${column.bg} border-x border-white/5 rounded-t-3xl px-5 py-4 flex items-center justify-between backdrop-blur-md`}>
                <h3 className="font-black text-white text-xs uppercase tracking-[0.1em]">{column.title}</h3>
                <span className="text-xs font-black text-slate-500 bg-white/5 px-2.5 py-1 rounded-full">{projects.length}</span>
            </div>
            <SortableContext id={column.id} items={projects.map((p: any) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="flex-1 bg-slate-900/20 border-x border-b border-white/5 rounded-b-3xl p-4 space-y-4 overflow-y-auto min-h-[500px] scrollbar-hide">
                    {projects.map((project: BusinessProject) => (
                        <ProjectCard key={project.id} project={project} onDelete={onDelete} onEdit={onEdit} onManageMilestones={onManageMilestones} />
                    ))}
                    {projects.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 opacity-20">
                            <Plus className="w-8 h-8 text-slate-500 mb-2" />
                            <span className="text-xs font-medium text-slate-500">Empty</span>
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    );
};

const ProjectCard = ({ project, isDragging, onDelete, onEdit, onManageMilestones }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: project.id });
    const style = { transform: CSS.Translate.toString(transform), transition };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => onEdit && onEdit(project)}
            className={`glass-panel p-5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing group/card ${isDragging ? 'opacity-50 scale-105 z-50 border-teal-500 shadow-2xl shadow-teal-500/20' : 'border-white/5 bg-slate-900/60 hover:border-white/20'
                }`}
        >
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h4 className="font-black text-white text-sm uppercase tracking-tight leading-tight group-hover/card:text-teal-400 transition-colors">{project.name}</h4>
                    {project.category && (
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 block">{project.category}</span>
                    )}
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); onManageMilestones(project); }}
                        className="p-1.5 opacity-0 group-hover/card:opacity-100 bg-teal-500/10 hover:bg-teal-500 text-teal-500 hover:text-white rounded-lg transition-all"
                        title="Manage Phases"
                    >
                        <Target className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                        className="p-1.5 opacity-0 group-hover/card:opacity-100 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {project.description && (
                <p className="text-xs text-slate-400 mb-5 line-clamp-2 leading-relaxed italic">"{project.description}"</p>
            )}

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {project.dueDate && (
                            <div className="flex items-center gap-1.5 text-xs font-black text-slate-500 uppercase">
                                <Calendar className="w-3 h-3" />
                                {new Date(project.dueDate).toLocaleDateString()}
                            </div>
                        )}
                        <div className="w-px h-3 bg-white/5"></div>
                        <div className="flex -space-x-1.5">
                            {[1, 2].map(i => (
                                <div key={i} className="w-5 h-5 rounded-full bg-slate-800 border border-slate-900 flex items-center justify-center">
                                    <UsersIcon className="w-2.5 h-2.5 text-slate-500" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest">
                        <span className="text-slate-500">Progress</span>
                        <span className="text-teal-400">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-white/5 shadow-inner">
                        <div className="bg-gradient-to-r from-teal-500 to-violet-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(45,212,191,0.3)]" style={{ width: `${project.progress}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProjectModal = ({ clients, onClose, onSave, initialData }: any) => {
    const [formData, setFormData] = useState({
        name: '', description: '', status: 'backlog', category: 'General',
        startDate: new Date().toISOString().split('T')[0], dueDate: '',
        progress: 0, clientId: (initialData?.clientId) || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('clientId') : '') || ''
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
                category: initialData.category || 'General'
            }));
        }
    }, [initialData]);

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full shadow-2xl shadow-teal-500/5 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-white">{initialData ? 'Edit Project' : 'New Project'}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSave(formData); }} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-300 ml-1">Project Name *</label>
                        <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-5 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-medium focus:border-teal-400 outline-none transition-all shadow-inner" placeholder="Website Redesign..." />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-300 ml-1">Description</label>
                        <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3}
                            className="w-full px-5 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-normal focus:border-teal-400 outline-none transition-all resize-none shadow-inner" placeholder="Project details..." />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-300 ml-1">Project Category</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-bold focus:border-teal-400 outline-none appearance-none"
                        >
                            <option value="General">General</option>
                            <option value="Design">Design</option>
                            <option value="Development">Development</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Consulting">Consulting</option>
                            <option value="Operations">Operations</option>
                        </select>
                    </div>
                    {initialData && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Percent Complete ({formData.progress}%)</label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={formData.progress}
                                onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-teal-500"
                            />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-slate-300 ml-1">Client</label>
                        <select value={formData.clientId} onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-bold focus:border-teal-400 outline-none appearance-none">
                            <option value="">Internal</option>
                            {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Start Date</label>
                            <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-bold focus:border-teal-400 outline-none" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Due Date</label>
                            <input type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-950 border border-white/5 rounded-2xl text-white font-bold focus:border-teal-400 outline-none" />
                        </div>
                    </div>
                    <div className="flex gap-4 pt-6">
                        <button type="button" onClick={onClose} className="flex-1 px-6 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-bold text-sm text-slate-300 transition-all">Cancel</button>
                        <button type="submit" className="flex-1 px-6 py-4 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-teal-500/20 active:scale-95">{initialData ? 'Save Changes' : 'Create Project'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProjectsPage;
