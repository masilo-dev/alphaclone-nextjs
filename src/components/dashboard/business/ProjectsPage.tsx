import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessProjectService, BusinessProject } from '../../../services/businessProjectService';
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
    Lock
} from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

interface ProjectsPageProps {
    user: User;
}

const ProjectsPage: React.FC<ProjectsPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [projects, setProjects] = useState<BusinessProject[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const columns = [
        { id: 'backlog', title: 'Backlog', color: 'slate' },
        { id: 'todo', title: 'To Do', color: 'blue' },
        { id: 'in_progress', title: 'In Progress', color: 'violet' },
        { id: 'review', title: 'Review', color: 'orange' },
        { id: 'done', title: 'Done', color: 'teal' }
    ];

    useEffect(() => {
        if (currentTenant) {
            loadData();
        }
    }, [currentTenant]);

    const loadData = async () => {
        if (!currentTenant) return;

        setLoading(true);
        const { projects: projectData } = await businessProjectService.getProjects(currentTenant.id);
        const { clients: clientData } = await businessClientService.getClients(currentTenant.id);

        setProjects(projectData);
        setClients(clientData);
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

        // Update project status
        await businessProjectService.updateProject(projectId, { status: newStatus as any });

        // Update local state
        setProjects(projects.map(p =>
            p.id === projectId ? { ...p, status: newStatus as any } : p
        ));

        setActiveId(null);
    };

    const handleAddProject = async (projectData: Partial<BusinessProject>) => {
        if (!currentTenant) return;

        const { project, error } = await businessProjectService.createProject(currentTenant.id, projectData);
        if (!error && project) {
            setProjects([project, ...projects]);
            setShowAddModal(false);
        }
    };

    const handleDeleteProject = async (projectId: string) => {
        if (!confirm('Are you sure you want to delete this project?')) return;

        const { error } = await businessProjectService.deleteProject(projectId);
        if (!error) {
            setProjects(projects.filter(p => p.id !== projectId));
        }
    };

    const getProjectsByStatus = (status: string) => {
        return projects.filter(p => p.status === status);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="text-slate-400">Loading projects...</div></div>;
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold">Projects</h2>
                    <p className="text-slate-400 mt-1">{projects.length} total projects</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Project
                </button>
            </div>

            {/* Kanban Board */}
            <DndContext
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                collisionDetection={closestCorners}
            >
                <div className="flex-1 overflow-x-auto">
                    <div className="flex gap-4 h-full min-w-max pb-4">
                        {columns.map(column => (
                            <KanbanColumn
                                key={column.id}
                                column={column}
                                projects={getProjectsByStatus(column.id)}
                                onDelete={handleDeleteProject}
                            />
                        ))}
                    </div>
                </div>

                <DragOverlay>
                    {activeId ? (
                        <ProjectCard
                            project={projects.find(p => p.id === activeId)!}
                            isDragging
                            onDelete={() => { }}
                        />
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Add Project Modal */}
            {showAddModal && (
                <AddProjectModal
                    clients={clients}
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAddProject}
                />
            )}
        </div>
    );
};

const KanbanColumn = ({ column, projects, onDelete }: any) => {
    const colorClasses = {
        slate: 'border-slate-600',
        blue: 'border-blue-600',
        violet: 'border-violet-600',
        orange: 'border-orange-600',
        teal: 'border-teal-600'
    };

    return (
        <SortableContext
            id={column.id}
            items={projects.map((p: any) => p.id)}
            strategy={verticalListSortingStrategy}
        >
            <div className="flex-shrink-0 w-80 flex flex-col">
                <div className={`border-t-4 ${colorClasses[column.color as keyof typeof colorClasses]} bg-slate-900/50 border border-slate-800 rounded-t-xl px-4 py-3`}>
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{column.title}</h3>
                        <span className="text-sm text-slate-400">{projects.length}</span>
                    </div>
                </div>

                <div
                    className="flex-1 bg-slate-900/30 border-x border-b border-slate-800 rounded-b-xl p-4 space-y-3 overflow-y-auto min-h-[500px]"
                    data-column-id={column.id}
                >
                    {projects.map((project: BusinessProject) => (
                        <ProjectCard
                            key={project.id}
                            project={project}
                            onDelete={onDelete}
                            onUpdate={() => window.location.reload()}
                        />
                    ))}
                    {projects.length === 0 && (
                        <div className="text-center text-slate-500 text-sm py-8">
                            No projects
                        </div>
                    )}
                </div>
            </div>
        </SortableContext>
    );
};

const ProjectCard = ({ project, isDragging, onDelete, onUpdate }: any) => {
    const copyShareLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const url = `${window.location.origin}/bp/${project.id}`;
        navigator.clipboard.writeText(url);
        alert('Public sharing link copied to clipboard!');
    };

    const togglePublic = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await businessProjectService.updateProject(project.id, { isPublic: !project.isPublic });
        if (onUpdate) onUpdate();
    };

    return (
        <div
            className={`bg-slate-800 border border-slate-700 rounded-lg p-4 cursor-move hover:border-teal-500/50 transition-all ${isDragging ? 'opacity-50 rotate-2' : ''
                }`}
        >
            <div className="flex items-start justify-between mb-3">
                <h4 className="font-medium text-sm">{project.name}</h4>
                <div className="flex gap-1">
                    <button
                        onClick={togglePublic}
                        className={`p-1 rounded transition-all ${project.isPublic ? 'text-teal-400 hover:bg-teal-400/10' : 'text-slate-500 hover:bg-slate-500/10'}`}
                        title={project.isPublic ? 'Publicly Shared' : 'Private'}
                    >
                        {project.isPublic ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </button>
                    {project.isPublic && (
                        <button
                            onClick={copyShareLink}
                            className="p-1 hover:bg-teal-500/10 rounded transition-all"
                            title="Copy Public Link"
                        >
                            <Share2 className="w-3.5 h-3.5 text-teal-400" />
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(project.id);
                        }}
                        className="p-1 hover:bg-red-500/10 rounded transition-all"
                    >
                        <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                </div>
            </div>

            {project.description && (
                <p className="text-xs text-slate-400 mb-3 line-clamp-2">
                    {project.description}
                </p>
            )}

            {project.dueDate && (
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(project.dueDate).toLocaleDateString()}</span>
                </div>
            )}

            {project.assignedTo && project.assignedTo.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                    <UsersIcon className="w-3 h-3" />
                    <span>{project.assignedTo.length} assigned</span>
                </div>
            )}

            {/* Progress Bar */}
            <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                        className="bg-teal-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${project.progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

const AddProjectModal = ({ clients, onClose, onAdd }: any) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        status: 'backlog' as any,
        dueDate: '',
        progress: 0,
        clientId: '',
        isPublic: false
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Create New Project</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Project Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Client</label>
                        <select
                            value={formData.clientId}
                            onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        >
                            <option value="">No client</option>
                            {clients.map((client: any) => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Due Date</label>
                        <input
                            type="date"
                            value={formData.dueDate}
                            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        >
                            <option value="backlog">Backlog</option>
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="done">Done</option>
                        </select>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                        >
                            Create Project
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProjectsPage;
