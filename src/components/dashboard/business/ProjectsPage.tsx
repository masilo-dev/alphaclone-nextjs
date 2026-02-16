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

    const loadData = useCallback(async () => {
        if (!currentTenant) return;
        setLoading(true);
        const { projects: projectData } = await projectService.getProjects(user.id, user.role);
        const { clients: clientData } = await businessClientService.getClients(currentTenant.id);
        const { contracts: contractData } = await contractService.getUserContracts(user.id, 'tenant_admin');
        setProjects(projectData || []);
        setClients(clientData || []);
        setContracts(contractData || []);
        setLoading(false);
    }, [currentTenant, user.id, user.role]);

    useEffect(() => {
        if (currentTenant) {
            loadData();
        }
    }, [currentTenant, loadData]);

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    }, []);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
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
            setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus as any } : p));
        }
        setActiveId(null);
    }, [projects, contracts]);

    const [editingProject, setEditingProject] = useState<BusinessProject | null>(null);

    const handleSaveProject = useCallback(async (projectData: Partial<BusinessProject>) => {
        if (!currentTenant) return;

        if (editingProject) {
            // Update existing
            const { error } = await projectService.updateProject(editingProject.id, projectData);
            if (!error) {
                setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...projectData } : p));
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
                setProjects(prev => [project, ...prev]);
                setShowAddModal(false);
            }
        }
    }, [currentTenant, editingProject, user.id, user.name, setProjects, setEditingProject]);

    const handleDeleteProject = useCallback(async (projectId: string) => {
        if (!confirm('Delete this project? This action cannot be undone.')) return;
        const { error } = await projectService.deleteProject(projectId);
        if (!error) {
            setProjects(prev => prev.filter(p => p.id !== projectId));
        }
    }, []);

    const getProjectsByStatus = (status: string) => projects.filter(p => p.status === status);


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
                        <div className="flex-1 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent h-full">
                            <div className="flex gap-4 h-full min-w-max">
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
                        <ProjectTimeline projects={projects} />
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
        <div className="flex flex-col w-72 group/col">
            <div className={`border-t-4 ${column.color} ${column.bg} border-x border-white/5 rounded-t-2xl px-4 py-3 flex items-center justify-between backdrop-blur-md`}>
                <h3 className="font-bold text-white text-[10px] uppercase tracking-[0.15em]">{column.title}</h3>
                <span className="text-[10px] font-black text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{projects.length}</span>
            </div>
            <SortableContext id={column.id} items={projects.map((p: any) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="flex-1 bg-slate-900/10 border-x border-b border-white/5 rounded-b-2xl p-3 space-y-3 overflow-y-auto min-h-[500px] scrollbar-thin scrollbar-thumb-slate-800">
                    {projects.map((project: BusinessProject) => (
                        <ProjectCard key={project.id} project={project} onDelete={onDelete} onEdit={onEdit} onManageMilestones={onManageMilestones} />
                    ))}
                    {projects.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 opacity-20">
                            <Plus className="w-6 h-6 text-slate-500 mb-2" />
                            <span className="text-[10px] font-medium text-slate-500">Empty</span>
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
            className={`glass-panel p-4 rounded-xl border transition-all cursor-grab active:cursor-grabbing group/card ${isDragging ? 'opacity-50 scale-105 z-50 border-teal-500 shadow-2xl shadow-teal-500/20' : 'border-white/5 bg-slate-900/40 hover:border-white/20'
                }`}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-white text-xs uppercase tracking-tight leading-tight group-hover/card:text-teal-400 transition-colors truncate">{project.name}</h4>
                    {project.category && (
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 block">{project.category}</span>
                    )}
                </div>
                <div className="flex gap-1 ml-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); onManageMilestones(project); }}
                        className="p-1 opacity-0 group-hover/card:opacity-100 bg-teal-500/10 hover:bg-teal-500 text-teal-500 hover:text-white rounded-md transition-all"
                        title="Phases"
                    >
                        <Target className="w-3 h-3" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
                        className="p-1 opacity-0 group-hover/card:opacity-100 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-md transition-all"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {project.description && (
                <p className="text-[11px] text-slate-400 mb-4 line-clamp-1 leading-relaxed italic opacity-70">"{project.description}"</p>
            )}

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {project.dueDate && (
                            <div className="flex items-center gap-1 text-[10px] font-black text-slate-500 uppercase">
                                <Calendar className="w-2.5 h-2.5" />
                                {new Date(project.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </div>
                        )}
                        <div className="w-px h-2 bg-white/5"></div>
                        <div className="flex -space-x-1">
                            {[1, 2].map(i => (
                                <div key={i} className="w-4 h-4 rounded-full bg-slate-800 border border-slate-900 flex items-center justify-center">
                                    <UsersIcon className="w-2 h-2 text-slate-500" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                        <span className="text-slate-600">Progress</span>
                        <span className="text-teal-400">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden border border-white/5 shadow-inner">
                        <div className="bg-gradient-to-r from-teal-500 to-violet-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(45,212,191,0.3)]" style={{ width: `${project.progress}%` }} />
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

const ProjectTimeline = ({ projects }: { projects: BusinessProject[] }) => {
    const sorted = [...projects].sort((a, b) => new Date(a.startDate || a.createdAt || 0).getTime() - new Date(b.startDate || b.createdAt || 0).getTime());

    // Calculate range: from today to 6 months out
    const timelineStart = new Date();
    timelineStart.setDate(1); // Start of current month
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
            {/* Timeline Header */}
            <div className="flex border-b border-white/10 bg-slate-900/40 sticky top-0 z-20">
                <div className="w-64 min-w-[16rem] p-4 font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] border-r border-white/5">Project Objective</div>
                <div className="flex-1 relative h-12 flex">
                    {months.map((m, i) => (
                        <div
                            key={i}
                            className="flex-1 border-r border-white/5 last:border-0 p-3 text-center flex flex-col justify-center"
                        >
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{m.toLocaleDateString('default', { month: 'short' })}</span>
                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">{m.getFullYear()}</span>
                        </div>
                    ))}
                    {/* Today indicator line */}
                    <div
                        className="absolute top-0 bottom-0 w-px bg-teal-500/40 shadow-[0_0_10px_rgba(20,184,166,0.3)] z-10"
                        style={{ left: `${getPosition(new Date().toISOString(), new Date())}%` }}
                    >
                        <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]"></div>
                    </div>
                </div>
            </div>

            {/* Timeline Rows */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden divide-y divide-white/5">
                {sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-30">
                        <BarChart3 className="w-12 h-12 mb-4" />
                        <p className="text-sm font-black uppercase tracking-widest">No Active Timelines</p>
                    </div>
                ) : sorted.map(proj => {
                    const fallbackDate = new Date().getTime();
                    const startPos = getPosition(proj.startDate || proj.createdAt, new Date());
                    const endPos = getPosition(proj.dueDate, new Date(new Date(proj.startDate || proj.createdAt || fallbackDate).getTime() + 30 * 24 * 60 * 60 * 1000));
                    const width = Math.max(2, endPos - startPos);

                    return (
                        <div key={proj.id} className="flex hover:bg-white/[0.02] group transition-all duration-300 border-l-2 border-transparent hover:border-teal-500/30">
                            <div className="w-64 min-w-[16rem] p-4 flex flex-col gap-1 border-r border-white/5 bg-slate-900/20 backdrop-blur-sm">
                                <h4 className="text-xs font-bold text-slate-200 group-hover:text-teal-400 transition-colors truncate">{proj.name}</h4>
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 uppercase tracking-widest`}>
                                        {proj.status.replace('_', ' ')}
                                    </span>
                                    <span className="text-[9px] font-bold text-teal-500/80">{proj.progress}%</span>
                                </div>
                            </div>
                            <div className="flex-1 relative h-14 flex items-center px-2">
                                {/* Grid lines background */}
                                <div className="absolute inset-0 flex divide-x divide-white/5 pointer-events-none">
                                    {months.map((_, i) => <div key={i} className="flex-1 h-full"></div>)}
                                </div>

                                {/* Project Bar */}
                                <div
                                    className="absolute h-7 rounded-lg group-hover:h-8 transition-all duration-300 flex items-center shadow-lg hover:shadow-teal-500/10 overflow-hidden cursor-pointer"
                                    style={{
                                        left: `${startPos}%`,
                                        width: `${width}%`,
                                        background: 'linear-gradient(90deg, rgba(20,184,166,0.15) 0%, rgba(139,92,246,0.15) 100%)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                    }}
                                >
                                    {/* Progress inner bar */}
                                    <div
                                        className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-teal-500/30 to-violet-500/30 transition-all duration-1000"
                                        style={{ width: `${proj.progress}%` }}
                                    ></div>
                                    <div className="relative px-3 flex items-center justify-between w-full min-w-max">
                                        <span className="text-[9px] font-black text-white uppercase tracking-wider truncate drop-shadow-md">{proj.name}</span>
                                        {width > 10 && (
                                            <span className="text-[8px] font-bold text-slate-400 pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {proj.dueDate ? new Date(proj.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProjectsPage;
