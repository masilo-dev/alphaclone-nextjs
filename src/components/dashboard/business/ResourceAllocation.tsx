import React, { useState, useEffect } from 'react';
import { Users, Calendar, DollarSign, TrendingUp, Plus, Edit3, Trash2, Clock, CheckCircle, FileText } from 'lucide-react';
import { Button } from '../../ui/UIComponents';
import ComingSoonOverlay from '../ComingSoonOverlay';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  skills: string[];
  availability: number; // percentage (0-100)
  hourlyRate: number;
  currentProjects: string[];
  maxProjects: number;
  status: 'available' | 'busy' | 'unavailable';
  lastActive: string;
}

interface Resource {
  id: string;
  name: string;
  type: 'human' | 'equipment' | 'software' | 'budget';
  description: string;
  capacity: number;
  used: number;
  unit: 'hours' | 'days' | 'percentage' | 'currency';
  costPerUnit: number;
  availability: 'available' | 'limited' | 'unavailable';
}

interface Project {
  id: string;
  name: string;
  client: string;
  budget: number;
  deadline: string;
  status: 'planning' | 'active' | 'completed' | 'on_hold';
  assignedResources: string[];
  progress: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface ResourceAllocationProps {
  onResourceUpdate?: (resources: Resource[]) => void;
  onTeamUpdate?: (team: TeamMember[]) => void;
}

const ResourceAllocation: React.FC<ResourceAllocationProps> = ({
  onResourceUpdate,
  onTeamUpdate
}) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddResource, setShowAddResource] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  // Sample data - replace with actual data from your backend
  useEffect(() => {
    // Load initial data
    const sampleTeam: TeamMember[] = [
      {
        id: '1',
        name: 'John Doe',
        role: 'Senior Developer',
        email: 'john@alphaclone.com',
        skills: ['React', 'Node.js', 'TypeScript'],
        availability: 80,
        hourlyRate: 75,
        currentProjects: ['Project Alpha', 'Project Beta'],
        maxProjects: 3,
        status: 'available',
        lastActive: '2024-01-15T10:30:00Z'
      },
      {
        id: '2',
        name: 'Jane Smith',
        role: 'UI/UX Designer',
        email: 'jane@alphaclone.com',
        skills: ['Figma', 'Adobe XD', 'Prototyping'],
        availability: 60,
        hourlyRate: 65,
        currentProjects: ['Project Gamma'],
        maxProjects: 2,
        status: 'available',
        lastActive: '2024-01-15T09:15:00Z'
      },
      {
        id: '3',
        name: 'Mike Johnson',
        role: 'Project Manager',
        email: 'mike@alphaclone.com',
        skills: ['Agile', 'Scrum', 'Team Leadership'],
        availability: 90,
        hourlyRate: 85,
        currentProjects: ['Project Alpha', 'Project Gamma', 'Project Delta'],
        maxProjects: 4,
        status: 'busy',
        lastActive: '2024-01-15T11:45:00Z'
      }
    ];

    const sampleResources: Resource[] = [
      {
        id: '1',
        name: 'Development Hours',
        type: 'human',
        description: 'Available development hours per week',
        capacity: 120,
        used: 85,
        unit: 'hours',
        costPerUnit: 75,
        availability: 'available'
      },
      {
        id: '2',
        name: 'Design Hours',
        type: 'human',
        description: 'Available design hours per week',
        capacity: 40,
        used: 24,
        unit: 'hours',
        costPerUnit: 65,
        availability: 'available'
      },
      {
        id: '3',
        name: 'Project Budget Q1',
        type: 'budget',
        description: 'Q1 project budget allocation',
        capacity: 50000,
        used: 32500,
        unit: 'currency',
        costPerUnit: 1,
        availability: 'limited'
      },
      {
        id: '4',
        name: 'AWS Credits',
        type: 'software',
        description: 'Available AWS credits for hosting',
        capacity: 1000,
        used: 650,
        unit: 'currency',
        costPerUnit: 1,
        availability: 'available'
      }
    ];

    const sampleProjects: Project[] = [
      {
        id: '1',
        name: 'Project Alpha',
        client: 'TechCorp Inc.',
        budget: 25000,
        deadline: '2024-02-15',
        status: 'active',
        assignedResources: ['1', '3'],
        progress: 65,
        priority: 'high'
      },
      {
        id: '2',
        name: 'Project Beta',
        client: 'StartupXYZ',
        budget: 15000,
        deadline: '2024-03-01',
        status: 'planning',
        assignedResources: ['1'],
        progress: 25,
        priority: 'medium'
      },
      {
        id: '3',
        name: 'Project Gamma',
        client: 'RetailChain Co.',
        budget: 35000,
        deadline: '2024-01-30',
        status: 'active',
        assignedResources: ['2', '3'],
        progress: 80,
        priority: 'urgent'
      }
    ];

    setTeamMembers(sampleTeam);
    setResources(sampleResources);
    setProjects(sampleProjects);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'text-green-400 bg-green-500/20';
      case 'busy': return 'text-yellow-400 bg-yellow-500/20';
      case 'unavailable': return 'text-red-400 bg-red-500/20';
      case 'limited': return 'text-orange-400 bg-orange-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400 bg-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-green-400 bg-green-500/20';
      default: return 'text-slate-400 bg-slate-500/20';
    }
  };

  const getResourceTypeIcon = (type: string) => {
    switch (type) {
      case 'human': return <Users className="w-4 h-4" />;
      case 'equipment': return <Calendar className="w-4 h-4" />;
      case 'software': return <FileText className="w-4 h-4" />;
      case 'budget': return <DollarSign className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const calculateUtilization = (used: number, capacity: number): number => {
    return capacity > 0 ? Math.round((used / capacity) * 100) : 0;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const TeamMemberCard: React.FC<{ member: TeamMember }> = ({ member }) => {
    const utilization = calculateUtilization(member.currentProjects.length, member.maxProjects);

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-semibold text-white">{member.name}</h4>
            <p className="text-sm text-slate-400">{member.role}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(member.status)}`}>
              {member.status}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingMember(member)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <Edit3 className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Remove ${member.name} from team?`)) {
                    setTeamMembers(prev => prev.filter(m => m.id !== member.id));
                  }
                }}
                className="p-1 text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Availability</span>
            <span className="text-white">{member.availability}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-teal-500 h-2 rounded-full transition-all"
              style={{ width: `${member.availability}%` }}
            />
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Project Load</span>
            <span className="text-white">{member.currentProjects.length}/{member.maxProjects}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${utilization > 80 ? 'bg-red-500' :
                  utilization > 60 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
              style={{ width: `${utilization}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {member.skills.slice(0, 3).map(skill => (
            <span key={skill} className="px-2 py-1 bg-slate-700 text-xs text-slate-300 rounded">
              {skill}
            </span>
          ))}
          {member.skills.length > 3 && (
            <span className="px-2 py-1 bg-slate-700 text-xs text-slate-400 rounded">
              +{member.skills.length - 3}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{formatCurrency(member.hourlyRate)}/hr</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {getTimeAgo(member.lastActive)}
          </span>
        </div>
      </div>
    );
  };

  const ResourceCard: React.FC<{ resource: Resource }> = ({ resource }) => {
    const utilization = calculateUtilization(resource.used, resource.capacity);

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="text-teal-400">
              {getResourceTypeIcon(resource.type)}
            </div>
            <div>
              <h4 className="font-semibold text-white">{resource.name}</h4>
              <p className="text-sm text-slate-400">{resource.description}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditingResource(resource)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <Edit3 className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm(`Remove ${resource.name} from resources?`)) {
                  setResources(prev => prev.filter(r => r.id !== resource.id));
                }
              }}
              className="p-1 text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Utilization</span>
            <span className="text-white">{utilization}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${utilization > 90 ? 'bg-red-500' :
                  utilization > 75 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
              style={{ width: `${utilization}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
          <div>
            <div className="text-slate-400">Used</div>
            <div className="text-white font-medium">
              {resource.used} {resource.unit}
            </div>
          </div>
          <div>
            <div className="text-slate-400">Available</div>
            <div className="text-white font-medium">
              {resource.capacity - resource.used} {resource.unit}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            {formatCurrency(resource.costPerUnit)}/{resource.unit}
          </span>
          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(resource.availability)}`}>
            {resource.availability}
          </span>
        </div>
      </div>
    );
  };

  const ProjectCard: React.FC<{ project: Project }> = ({ project }) => {
    const assignedTeam = teamMembers.filter(member =>
      project.assignedResources.includes(member.id)
    );

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h4 className="font-semibold text-white">{project.name}</h4>
            <p className="text-sm text-slate-400">{project.client}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(project.priority)}`}>
              {project.priority}
            </span>
            <span className={`px-2 py-1 text-xs rounded-full ${project.status === 'active' ? 'text-green-400 bg-green-500/20' :
                project.status === 'completed' ? 'text-blue-400 bg-blue-500/20' :
                  project.status === 'on_hold' ? 'text-yellow-400 bg-yellow-500/20' :
                    'text-slate-400 bg-slate-500/20'
              }`}>
              {project.status}
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Budget</span>
            <span className="text-white">{formatCurrency(project.budget)}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Deadline</span>
            <span className="text-white">{formatDate(project.deadline)}</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Progress</span>
              <span className="text-white">{project.progress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-teal-500 h-2 rounded-full transition-all"
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        </div>

        {assignedTeam.length > 0 && (
          <div className="mb-3">
            <div className="text-sm text-slate-400 mb-2">Team ({assignedTeam.length})</div>
            <div className="flex flex-wrap gap-1">
              {assignedTeam.map(member => (
                <span key={member.id} className="px-2 py-1 bg-slate-700 text-xs text-slate-300 rounded">
                  {member.name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Resources: {project.assignedResources.length}</span>
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {project.progress}% complete
          </span>
        </div>
      </div>
    );
  };

  return (
    <ComingSoonOverlay
      title="Strategic Asset Management"
      description="AlphaClone's enterprise resource and equipment allocation suite is entering final deployment. The visual structure below demonstrates the core allocation algorithms and data visualization."
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Resource Allocation</h3>
            <p className="text-slate-400">Manage your team and resources efficiently</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowAddMember(true)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Team Member
            </Button>
            <Button
              onClick={() => setShowAddResource(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Resource
            </Button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-teal-400" />
              <h4 className="font-semibold text-white">Team Size</h4>
            </div>
            <div className="text-2xl font-bold text-teal-400">{teamMembers.length}</div>
            <div className="text-sm text-slate-400">active members</div>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h4 className="font-semibold text-white">Available</h4>
            </div>
            <div className="text-2xl font-bold text-green-400">
              {teamMembers.filter(m => m.status === 'available').length}
            </div>
            <div className="text-sm text-slate-400">team members</div>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <h4 className="font-semibold text-white">Active Projects</h4>
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {projects.filter(p => p.status === 'active').length}
            </div>
            <div className="text-sm text-slate-400">in progress</div>
          </div>

          <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-yellow-400" />
              <h4 className="font-semibold text-white">Budget Used</h4>
            </div>
            <div className="text-2xl font-bold text-yellow-400">
              {formatCurrency(resources.reduce((sum, r) => sum + r.used * r.costPerUnit, 0))}
            </div>
            <div className="text-sm text-slate-400">total spent</div>
          </div>
        </div>

        {/* Team Members Section */}
        <div>
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-400" />
            Team Members
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map(member => (
              <TeamMemberCard key={member.id} member={member} />
            ))}
          </div>
        </div>

        {/* Resources Section */}
        <div>
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Resources
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map(resource => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>
        </div>

        {/* Projects Section */}
        <div>
          <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-400" />
            Active Projects
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>

        {/* Add/Edit Modals would go here */}
        {/* Implementation of modals for adding/editing team members and resources */}
      </div>
    </ComingSoonOverlay>
  );
};

export default ResourceAllocation;