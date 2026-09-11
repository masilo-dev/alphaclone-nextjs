import React, { useEffect, useState } from 'react';
import { Card, Button, Modal } from '../ui/UIComponents';
import { teamService } from '../../services/teamService';
import { projectService } from '../../services/projectService';
import { useTenant } from '../../contexts/TenantContext';
import { TableSkeleton } from '../ui/Skeleton';
import { User, Project } from '../../types';
import { Edit, Briefcase, Users, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import toast from 'react-hot-toast';

interface TeamMember {
    id: string;
    name: string;
    role: string;
    skills: string[];
    status: string;
    avatar: string;
    capacity: number;
}

interface ResourceAllocationViewProps {
    user: User;
    initialProjects?: Project[];
}

const ResourceAllocationView: React.FC<ResourceAllocationViewProps> = ({ user, initialProjects }) => {
    const { currentTenant } = useTenant();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [projects, setProjects] = useState<Project[]>(initialProjects || []);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);

    useEffect(() => {
        fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialProjects]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const teamResult = await teamService.getTeamMembers(currentTenant?.id);

            let activeProjects = initialProjects || [];

            if (!initialProjects) {
                const projectsResult = await projectService.getProjects(user.id, user.role);
                if (projectsResult.error) {
                    console.error('Failed to load projects:', projectsResult.error);
                } else {
                    activeProjects = projectsResult.projects || [];
                }
            }

            if (teamResult.error) {
                setError(teamResult.error);
            } else {
                const membersWithCapacity = teamResult.team.map(member => {
                    const assignedProjects = activeProjects.filter(p =>
                        p.team && p.team.includes(member.id)
                    );
                    const calculatedCapacity = Math.min(assignedProjects.length * 20, 100);
                    return {
                        ...member,
                        capacity: calculatedCapacity
                    };
                });
                setMembers(membersWithCapacity);
            }

            setProjects(activeProjects.filter(p => p.status === 'Active'));
        } catch {
            setError('Failed to load team data');
        } finally {
            setIsLoading(false);
        }
    };

    const getProjectsForMember = (memberId: string): Project[] => {
        return projects.filter(p => p.team && p.team.includes(memberId));
    };

    const handleManageAssignment = (member: TeamMember) => {
        setSelectedMember(member);
        const memberProjects = getProjectsForMember(member.id);
        setSelectedProjects(memberProjects.map(p => p.id));
        setIsAssignModalOpen(true);
    };

    const handleToggleProject = (projectId: string) => {
        setSelectedProjects(prev => {
            if (prev.includes(projectId)) {
                return prev.filter(id => id !== projectId);
            }
            return [...prev, projectId];
        });
    };

    const handleSaveAssignments = async () => {
        if (!selectedMember) return;

        setIsAssigning(true);

        try {
            const currentProjects = getProjectsForMember(selectedMember.id);
            const currentProjectIds = currentProjects.map(p => p.id);
            const projectsToAdd = selectedProjects.filter(id => !currentProjectIds.includes(id));
            const projectsToRemove = currentProjectIds.filter(id => !selectedProjects.includes(id));

            for (const projectId of projectsToAdd) {
                const project = projects.find(p => p.id === projectId);
                if (project) {
                    const updatedTeam = [...(project.team || []), selectedMember.id];
                    await projectService.updateProject(projectId, { team: updatedTeam });
                }
            }

            for (const projectId of projectsToRemove) {
                const project = projects.find(p => p.id === projectId);
                if (project) {
                    const updatedTeam = (project.team || []).filter(id => id !== selectedMember.id);
                    await projectService.updateProject(projectId, { team: updatedTeam });
                }
            }

            toast.success('Assignments updated successfully!');
            setIsAssignModalOpen(false);
            fetchData();
        } catch (err) {
            console.error('Failed to update assignments:', err);
            toast.error('Failed to update assignments');
        } finally {
            setIsAssigning(false);
        }
    };

    const handleQuickStatusToggle = async (member: TeamMember) => {
        const newStatus = member.status === 'Available' ? 'Busy' : 'Available';

        setMembers(prev => prev.map(m =>
            m.id === member.id ? { ...m, status: newStatus } : m
        ));

        teamService.updateMemberStatus(member.id, newStatus).then(({ error }) => {
            if (error) {
                toast.error('Failed to update status');
            }
        });

        toast.success(`${member.name} marked as ${newStatus}`);
    };

    if (isLoading) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Studio Talent & Resource Allocation</h2>
                        <p className="text-slate-400 mt-1">Manage team assignments and workload</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <TableSkeleton rows={3} />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6 animate-fade-in">
                <h2 className="text-2xl font-bold text-white">Studio Talent & Resource Allocation</h2>
                <Card className="p-8 text-center">
                    <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <p className="text-slate-300 mb-4">{error}</p>
                    <Button onClick={fetchData}>Retry</Button>
                </Card>
            </div>
        );
    }

    if (members.length === 0) {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Studio Talent & Resource Allocation</h2>
                        <p className="text-slate-400 mt-1">Manage team assignments and workload</p>
                    </div>
                </div>
                <Card className="p-12 text-center">
                    <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">No Team Members Yet</h3>
                    <p className="text-slate-400">Add profiles with 'admin' or 'employee' role to get started.</p>
                </Card>
            </div>
        );
    }

    const totalMembers = members.length;
    const availableMembers = members.filter(m => m.status === 'Available').length;
    const totalCapacity = members.reduce((sum: number, m: TeamMember) => sum + m.capacity, 0);
    const avgCapacity = totalMembers > 0 ? Math.round(totalCapacity / totalMembers) : 0;

    return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-start gap-3 flex-wrap">
                    <div>
                        <h2 className="text-2xl font-bold text-white">Studio Talent & Resource Allocation</h2>
                        <p className="text-slate-400 mt-1">Manage team assignments and workload</p>
                    </div>
                    <Button onClick={fetchData} variant="outline" className="flex items-center gap-2 min-h-11">
                        <Loader2 className="w-4 h-4" />
                        Refresh
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-teal-500/10 rounded-lg">
                                <Users className="w-5 h-5 text-teal-400" />
                            </div>
                            <div>
                                <div className="text-sm text-slate-400">Total Team</div>
                                <div className="text-2xl font-bold text-white">{totalMembers}</div>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 rounded-lg">
                                <CheckCircle className="w-5 h-5 text-green-400" />
                            </div>
                            <div>
                                <div className="text-sm text-slate-400">Available</div>
                                <div className="text-2xl font-bold text-white">{availableMembers}</div>
                            </div>
                        </div>
                    </Card>
                    <Card className="p-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500/10 rounded-lg">
                                <Briefcase className="w-5 h-5 text-orange-400" />
                            </div>
                            <div>
                                <div className="text-sm text-slate-400">Avg Capacity</div>
                                <div className="text-2xl font-bold text-white">{avgCapacity}%</div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {members.map((member) => {
                        const assignedProjects = getProjectsForMember(member.id);
                        return (
                            <Card key={member.id} className="flex flex-col gap-4 p-4 hover:border-teal-500/50 transition-all">
                                <div className="flex items-center gap-4">
                                    <Avatar
                                        src={member.avatar}
                                        name={member.name}
                                        size={48}
                                        className="flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white truncate">{member.name}</h3>
                                        <p className="text-xs text-slate-400 truncate">{member.role}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleQuickStatusToggle(member)}
                                        className={`min-h-11 px-2 py-0.5 text-xs rounded-full transition-colors ${member.status === 'Available'
                                            ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                            : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                            }`}
                                    >
                                        {member.status}
                                    </button>
                                </div>

                                <div className="mt-2">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-400">Workload</span>
                                        <span className={
                                            member.capacity > 80 ? 'text-orange-400' :
                                                member.capacity > 50 ? 'text-yellow-400' :
                                                    'text-teal-400'
                                        }>
                                            {member.capacity}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${member.capacity > 90 ? 'bg-red-500' :
                                                member.capacity > 75 ? 'bg-orange-500' :
                                                    member.capacity > 50 ? 'bg-yellow-500' :
                                                        'bg-teal-500'
                                                }`}
                                            style={{ width: `${member.capacity}%` }}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                                        <Briefcase className="w-3 h-3" />
                                        <span>Assigned Projects ({assignedProjects.length})</span>
                                    </div>
                                    {assignedProjects.length > 0 ? (
                                        <div className="space-y-1">
                                            {assignedProjects.slice(0, 3).map(project => (
                                                <div
                                                    key={project.id}
                                                    className="text-xs bg-slate-800/50 px-2 py-1 rounded border border-slate-700/50"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-300 truncate">{project.name}</span>
                                                        <span className="text-slate-500 text-xs ml-2">{project.progress}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {assignedProjects.length > 3 && (
                                                <div className="text-xs text-slate-500 text-center">
                                                    +{assignedProjects.length - 3} more
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-500 text-center py-2 bg-slate-900/30 rounded border border-dashed border-slate-800">
                                            No assignments
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 flex-wrap">
                                    {member.skills.slice(0, 3).map(skill => (
                                        <span
                                            key={skill}
                                            className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-auto text-xs min-h-11"
                                    onClick={() => handleManageAssignment(member)}
                                >
                                    <Edit className="w-3 h-3 mr-2" />
                                    Manage Assignments
                                </Button>
                            </Card>
                        );
                    })}
                </div>

                {isAssignModalOpen && selectedMember && (
                    <Modal
                        isOpen={isAssignModalOpen}
                        onClose={() => setIsAssignModalOpen(false)}
                        title={`Manage Assignments - ${selectedMember.name}`}
                    >
                        <div className="space-y-4">
                            <p className="text-sm text-slate-400">
                                Select projects to assign to {selectedMember.name}. Each project adds ~20% to workload.
                            </p>

                            {projects.length === 0 ? (
                                <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg">
                                    <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-400 text-sm">No active projects available</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {projects.map(project => {
                                        const isAssigned = selectedProjects.includes(project.id);
                                        return (
                                            <button
                                                key={project.id}
                                                type="button"
                                                onClick={() => handleToggleProject(project.id)}
                                                className={`w-full p-3 rounded-lg border transition-all text-left min-h-11 ${isAssigned
                                                    ? 'border-teal-500 bg-teal-500/10'
                                                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-semibold text-white text-sm">{project.name}</h4>
                                                            {isAssigned && (
                                                                <CheckCircle className="w-4 h-4 text-teal-400" />
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-400">{project.category} • {project.currentStage}</p>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            <div className="flex-1 bg-slate-900 h-1 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-teal-500 rounded-full"
                                                                    style={{ width: `${project.progress}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-slate-500">{project.progress}%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-800">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm text-slate-400">Estimated Workload:</span>
                                    <span className={`text-sm font-semibold ${selectedProjects.length * 20 > 100 ? 'text-red-400' :
                                        selectedProjects.length * 20 > 80 ? 'text-orange-400' :
                                            'text-teal-400'
                                        }`}>
                                        {Math.min(selectedProjects.length * 20, 100)}%
                                    </span>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => setIsAssignModalOpen(false)}
                                        className="flex-1 bg-slate-700 hover:bg-slate-600 min-h-11"
                                        disabled={isAssigning}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={handleSaveAssignments}
                                        className="flex-1 bg-teal-600 hover:bg-teal-500 min-h-11"
                                        disabled={isAssigning}
                                    >
                                        {isAssigning ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                Saving...
                                            </>
                                        ) : (
                                            'Save Assignments'
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
    );
};

export default ResourceAllocationView;
