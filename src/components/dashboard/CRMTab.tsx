import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, XCircle, MessageSquare, Phone, Clock, DollarSign, FileText, Calendar, TrendingUp, Plus, Filter, Heart, Activity, AlertCircle, CheckCircle2, Zap, Shield, Bot, Globe } from 'lucide-react';
import { Project, User } from '../../types';
import { userService } from '../../services/userService';
import { businessClientService, BusinessClient } from '../../services/businessClientService';
import { clientActivityService, ClientTimeline } from '../../services/clientActivityService';
import { clientLifecycleService, ClientLifecycleSummary } from '../../services/clientLifecycleService';
import { fileImportService } from '../../services/fileImportService';
import { useTenant } from '../../contexts/TenantContext';
import { Button, Badge, Input } from '../ui/UIComponents';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import { Edit, Trash2, Upload, Search, Filter as FilterIcon, X } from 'lucide-react';

interface CRMTabProps {
    user: User;
    projects: Project[];
    declineProject: (p: Project) => void;
    openContractGenerator: (p: Project) => void;
    openVideoCall: (clientId: string) => void;
    onNavigateToMessages?: (clientId: string) => void;
}

type ActivityFilter = 'all' | 'message' | 'call' | 'meeting' | 'contract' | 'payment' | 'project_update' | 'file_upload' | 'note';

const CRMTab: React.FC<CRMTabProps> = ({ user, projects, declineProject, openVideoCall, onNavigateToMessages }) => {
    const router = useRouter();
    const [clients, setClients] = useState<BusinessClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState<string | null>(null);
    const [clientTimeline, setClientTimeline] = useState<ClientTimeline | null>(null);
    const [loadingTimeline, setLoadingTimeline] = useState(false);
    const [showAddNote, setShowAddNote] = useState(false);
    const [noteTitle, setNoteTitle] = useState('');
    const [noteDescription, setNoteDescription] = useState('');
    const [showAddClient, setShowAddClient] = useState(false);
    const [newClient, setNewClient] = useState({ name: '', email: '', company: '' });
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
    const { currentTenant } = useTenant();
    const [lifecycleSummaries, setLifecycleSummaries] = useState<Record<string, ClientLifecycleSummary>>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingClient, setEditingClient] = useState<BusinessClient | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importedClients, setImportedClients] = useState<any[]>([]);

    useEffect(() => {
        const loadClients = async () => {
            const tenantId = currentTenant?.id;
            if (!tenantId) return;

            setLoading(true);
            const { clients: fetchedClients, error } = await businessClientService.getClients(tenantId);

            if (error) {
                console.error('Error loading CRM clients:', error);
                setLoading(false);
                return;
            }

            setClients(fetchedClients);
            setLoading(false);

            // Fetch lifecycle summaries if tenant exists
            if (fetchedClients.length > 0) {
                const summaries = await clientLifecycleService.bulkGetClientLifecycleSummaries(
                    fetchedClients.map(c => c.id),
                    tenantId
                );
                setLifecycleSummaries(summaries);
            }
        };
        loadClients();
    }, [currentTenant]);

    // Load client timeline when selected
    useEffect(() => {
        if (selectedClient) {
            loadClientTimeline(selectedClient);
        }
    }, [selectedClient]);

    const loadClientTimeline = async (clientId: string) => {
        setLoadingTimeline(true);
        const { timeline } = await clientActivityService.getClientTimeline(clientId);
        setClientTimeline(timeline);
        setLoadingTimeline(false);
    };

    const calculateHealthScore = (timeline: ClientTimeline) => {
        const lastContact = timeline.stats.last_contact;
        if (!lastContact) return 0;

        const lastContactDate = new Date(lastContact);
        const daysSinceLastContact = (new Date().getTime() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24);

        let score = 100;
        // Deduct points for inactivity
        score -= Math.min(daysSinceLastContact * 5, 50);

        // Add points for total activity
        const totalActivity = timeline.activities.length;
        score += Math.min(totalActivity * 2, 30);

        // Penalize poor response time (if over 24 hours)
        if (timeline.stats.response_time_avg > 24) {
            score -= 10;
        }

        return Math.max(0, Math.min(100, score));
    };

    const getHealthColor = (score: number) => {
        if (score >= 80) return 'text-green-400 bg-green-500/10 border-green-500/20';
        if (score >= 50) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
        return 'text-red-400 bg-red-500/10 border-red-500/20';
    };

    const handleEditClient = async (clientId: string, updates: Partial<BusinessClient>) => {
        const { error } = await businessClientService.updateClient(clientId, updates);
        if (!error) {
            setClients(clients.map(c => c.id === clientId ? { ...c, ...updates } : c));
            setShowEditModal(false);
            setEditingClient(null);
            toast.success('Client updated successfully!');
        } else {
            toast.error('Failed to update client');
        }
    };

    const handleDeleteClient = async (clientId: string) => {
        if (!confirm('Are you sure you want to delete this client?')) return;

        const { error } = await businessClientService.deleteClient(clientId);
        if (!error) {
            setClients(clients.filter(c => c.id !== clientId));
            if (selectedClient === clientId) setSelectedClient(null);
            toast.success('Client deleted successfully!');
        } else {
            toast.error('Failed to delete client');
        }
    };

    const handleImportClients = async (importedData: Partial<BusinessClient>[]) => {
        if (!currentTenant) return;

        try {
            const { count, error } = await businessClientService.importClients(currentTenant.id, importedData);
            if (!error) {
                // Reload clients
                const { clients: fetchedClients } = await businessClientService.getClients(currentTenant.id);
                setClients(fetchedClients);
                setShowImportModal(false);
                toast.success(`Successfully imported ${count} clients!`);
            } else {
                toast.error(`Error importing clients: ${error}`);
            }
        } catch (err) {
            toast.error('Failed to process import');
        }
    };

    const filteredClientsBySearchAndStage = useMemo(() => {
        return clients.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.company?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStage = selectedStageFilter === 'all' || c.stage === selectedStageFilter;

            return matchesSearch && matchesStage;
        });
    }, [clients, searchTerm, selectedStageFilter]);

    const filteredActivities = useMemo(() => {
        if (!clientTimeline) return [];
        return clientTimeline.activities.filter(a => {
            if (activityFilter === 'all') return true;
            return a.activity_type === activityFilter;
        });
    }, [clientTimeline, activityFilter]);

    const handleAddNote = async () => {
        if (!selectedClient || !noteTitle.trim()) {
            toast.error('Please enter a note title');
            return;
        }

        const { activity, error } = await clientActivityService.addClientNote(
            selectedClient,
            noteTitle,
            noteDescription,
            user.id
        );

        if (!error && activity) {
            // Update local timeline
            if (clientTimeline) {
                setClientTimeline({
                    ...clientTimeline,
                    activities: [activity, ...clientTimeline.activities]
                });
            }
            setNoteTitle('');
            setNoteDescription('');
            setShowAddNote(false);
            toast.success('Note added successfully!');
        } else {
            toast.error(error || 'Failed to add note');
        }
    };

    // Combine Clients with their projects and lifecycle summaries
    const clientCards = filteredClientsBySearchAndStage.map(client => {
        // Find active project for client - use clientId for linking
        const clientProject = projects.find(p => p.clientId === client.id);
        const summary = lifecycleSummaries[client.id];

        return {
            id: client.id,
            name: client.name,
            email: client.email,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name)}&background=random`,
            project: clientProject,
            status: clientProject ? clientProject.status : 'No Active Project',
            value: clientProject ? `$${(clientProject.budget || 0).toLocaleString()}` : `$${(client.value || 0).toLocaleString()}`,
            totalProjects: summary?.totalProjects || 0,
            activeProjects: summary?.activeProjects || 0,
            totalInvoices: summary?.totalInvoices || 0
        };
    });

    const handleMessageClient = (clientId: string) => {
        if (onNavigateToMessages) {
            onNavigateToMessages(clientId);
        } else {
            router.push(`/dashboard/messages?selectedClientId=${clientId}`);
        }
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'message': return <MessageSquare className="w-4 h-4" />;
            case 'call': return <Phone className="w-4 h-4" />;
            case 'meeting': return <Calendar className="w-4 h-4" />;
            case 'contract': return <FileText className="w-4 h-4" />;
            case 'payment': return <DollarSign className="w-4 h-4" />;
            case 'project_update': return <TrendingUp className="w-4 h-4" />;
            case 'file_upload': return <FileText className="w-4 h-4" />;
            case 'note': return <FileText className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    const getActivityColor = (type: string) => {
        switch (type) {
            case 'message': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'call': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'meeting': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'contract': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'payment': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
            case 'project_update': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
            case 'file_upload': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'note': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in h-min-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-violet-500 flex items-center gap-3">
                        <Users className="w-6 h-6 sm:w-8 sm:h-8 text-teal-400" /> CRM Directory
                    </h2>
                    <p className="text-slate-400 mt-1 text-xs sm:text-sm">Manage {clients.length} registered clients</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-all active:scale-95 border border-slate-700"
                    >
                        <Upload className="w-4 h-4" /> Import
                    </button>
                    <button
                        onClick={() => setShowAddClient(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-all active:scale-95 shadow-lg shadow-teal-900/20"
                    >
                        <Plus className="w-4 h-4" /> Add Client
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search by name, email, or company..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <FilterIcon className="w-4 h-4 text-slate-500" />
                    <select
                        value={selectedStageFilter}
                        onChange={(e) => setSelectedStageFilter(e.target.value)}
                        className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-teal-500 transition-all appearance-none cursor-pointer min-w-[140px]"
                    >
                        <option value="all">All Stages</option>
                        <option value="lead">Lead</option>
                        <option value="qualified">Qualified</option>
                        <option value="customer">Customer</option>
                        <option value="churned">Churned</option>
                    </select>
                </div>
            </div>

            {/* VIP Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                    onClick={() => router.push('/dashboard/sales-agent')}
                    className="glass-panel p-4 rounded-2xl border border-teal-500/20 bg-teal-500/5 hover:bg-teal-500/10 transition-all flex items-center gap-4 group"
                >
                    <div className="p-3 bg-teal-500/20 rounded-xl group-hover:scale-110 transition-transform">
                        <Bot className="w-5 h-5 text-teal-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-white text-sm">Initialize Growth Agent</h3>
                        <p className="text-[10px] text-slate-400 font-medium">AI-powered lead discovery & outreach</p>
                    </div>
                    <Zap className="w-4 h-4 text-teal-400 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
                </button>

                <button
                    onClick={() => router.push('/dashboard/business/contracts')}
                    className="glass-panel p-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 transition-all flex items-center gap-4 group"
                >
                    <div className="p-3 bg-violet-500/20 rounded-xl group-hover:scale-110 transition-transform">
                        <Shield className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-white text-sm">Draft Global Proposal</h3>
                        <p className="text-[10px] text-slate-400 font-medium">Generate professional legal contracts</p>
                    </div>
                    <FileText className="w-4 h-4 text-violet-400 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
                </button>

                <button
                    onClick={() => router.push('/dashboard/business/projects')}
                    className="glass-panel p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all flex items-center gap-4 group"
                >
                    <div className="p-3 bg-blue-500/20 rounded-xl group-hover:scale-110 transition-transform">
                        <Globe className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-white text-sm">Command Center Dispatch</h3>
                        <p className="text-[10px] text-slate-400 font-medium">Global task & project orchestration</p>
                    </div>
                    <TrendingUp className="w-4 h-4 text-blue-400 ml-auto opacity-40 group-hover:opacity-100 transition-opacity" />
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            ) : clientCards.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No Clients Found"
                    description={searchTerm ? "Try broadening your search criteria." : "Clients will appear here once they register and create projects."}
                />
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* Client Cards - Left Side */}
                    <div className="xl:col-span-1 space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto custom-scrollbar pr-2">
                        {clientCards.map((client) => (
                            <div
                                key={client.id}
                                className={`glass-panel p-4 rounded-xl border cursor-pointer transition-all ${selectedClient === client.id
                                    ? 'border-teal-500 bg-teal-500/5 shadow-lg shadow-teal-500/5'
                                    : 'border-white/5 hover:border-teal-500/30'
                                    }`}
                                onClick={() => setSelectedClient(client.id)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <img src={client.avatar} alt={client.name} className="w-10 h-10 rounded-full border border-white/10" />
                                        <div>
                                            <h3 className="font-bold text-white text-sm">{client.name}</h3>
                                            <p className="text-xs text-slate-400 truncate max-w-[120px]">{client.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className={`px-2 py-1 text-[10px] rounded-full font-bold uppercase ${client.status === 'Active' ? 'bg-green-500/10 text-green-400' :
                                            client.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400' :
                                                'bg-slate-800 text-slate-500'
                                            }`}>
                                            {client.status}
                                        </span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setEditingClient(clients.find(c => c.id === client.id) || null); setShowEditModal(true); }}
                                                className="p-1 hover:bg-slate-700 rounded transition-colors"
                                            >
                                                <Edit className="w-3 h-3 text-slate-400 hover:text-white" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id); }}
                                                className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {client.project && (
                                    <div className="p-2 bg-slate-800/50 rounded-lg border border-white/5 text-xs">
                                        <p className="text-teal-200 font-medium truncate">{client.project.name}</p>
                                        <div className="flex justify-between text-slate-400 mt-1">
                                            <span>{client.project.currentStage}</span>
                                            <span>{client.project.progress}%</span>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between text-[10px] text-slate-400">
                                            <span>Projects:</span>
                                            <span className="text-teal-400 font-bold">{client.activeProjects} / {client.totalProjects}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] text-slate-400">
                                            <span>Invoices:</span>
                                            <span className="text-violet-400 font-bold">{client.totalInvoices}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleMessageClient(client.id); }}
                                            className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs rounded-lg border border-blue-500/20 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <MessageSquare className="w-3 h-3" /> Message
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openVideoCall(client.id); }}
                                            className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs rounded-lg border border-green-500/20 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Phone className="w-3 h-3" /> Call
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Activity Timeline - Right Side */}
                    <div className="xl:col-span-2">
                        {selectedClient && clientTimeline ? (
                            <div className="glass-panel p-6 rounded-2xl border border-white/5 h-full flex flex-col">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-white mb-1">
                                                {clientTimeline.client_name}
                                            </h3>
                                            <p className="text-sm text-slate-400">Activity Timeline & Engagement</p>
                                        </div>
                                        <div className={`flex flex-col items-center px-4 py-2 rounded-xl border ${getHealthColor(calculateHealthScore(clientTimeline))}`}>
                                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Health</span>
                                            <div className="flex items-center gap-1 font-bold text-lg">
                                                <Heart className="w-4 h-4 fill-current" />
                                                {calculateHealthScore(clientTimeline)}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowAddNote(!showAddNote)}
                                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" /> Add Note
                                    </button>
                                </div>

                                {/* Quick Stats Section */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                    <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
                                        <div className="text-xs text-slate-500 mb-1">Messages</div>
                                        <div className="text-lg font-bold text-white">{clientTimeline.stats.total_messages}</div>
                                    </div>
                                    <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
                                        <div className="text-xs text-slate-500 mb-1">Calls</div>
                                        <div className="text-lg font-bold text-white">{clientTimeline.stats.total_calls}</div>
                                    </div>
                                    <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
                                        <div className="text-xs text-slate-500 mb-1">Last Contact</div>
                                        <div className="text-xs font-bold text-teal-400 truncate">
                                            {clientTimeline.stats.last_contact ? new Date(clientTimeline.stats.last_contact).toLocaleDateString() : 'Never'}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-800/40 rounded-xl border border-white/5">
                                        <div className="text-xs text-slate-500 mb-1">Avg. Resp</div>
                                        <div className="text-lg font-bold text-white">{clientTimeline.stats.response_time_avg.toFixed(1)}h</div>
                                    </div>
                                </div>

                                {/* Activity Filters */}
                                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
                                    <FilterIcon className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
                                    {(['all', 'message', 'call', 'meeting', 'contract', 'payment', 'project_update', 'file_upload', 'note'] as ActivityFilter[]).map((filter) => (
                                        <button
                                            key={filter}
                                            onClick={() => setActivityFilter(filter)}
                                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all whitespace-nowrap border ${activityFilter === filter
                                                ? 'bg-teal-500 text-white border-teal-400 shadow-lg shadow-teal-500/20'
                                                : 'bg-slate-800 text-slate-400 border-white/5 hover:border-white/10'
                                                }`}
                                        >
                                            {filter}
                                        </button>
                                    ))}
                                </div>

                                {/* Timeline Content */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                                    {showAddNote && (
                                        <div className="bg-slate-800/80 border border-teal-500/30 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-200">
                                            <h4 className="text-sm font-semibold text-white mb-3">New Client Note</h4>
                                            <input
                                                type="text"
                                                placeholder="Title of your note..."
                                                value={noteTitle}
                                                onChange={(e) => setNoteTitle(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-teal-500"
                                            />
                                            <textarea
                                                placeholder="Write detailed observations..."
                                                value={noteDescription}
                                                onChange={(e) => setNoteDescription(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-teal-500 min-h-[100px]"
                                            />
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={handleAddNote}>Save Note</Button>
                                                <Button size="sm" variant="outline" onClick={() => setShowAddNote(false)}>Cancel</Button>
                                            </div>
                                        </div>
                                    )}

                                    {loadingTimeline ? (
                                        <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                                            <Activity className="w-8 h-8 text-teal-500 animate-pulse" />
                                            <span className="text-sm">Fetching timeline...</span>
                                        </div>
                                    ) : (
                                        <div className="relative pl-6 border-l border-slate-800 space-y-6">
                                            {filteredActivities.length === 0 ? (
                                                <div className="text-center py-12 text-slate-500">
                                                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                    <p>No activity matches the selected filter.</p>
                                                </div>
                                            ) : (
                                                filteredActivities.map((activity) => (
                                                    <div key={activity.id} className="relative group">
                                                        <div className={`absolute -left-[31px] w-2.5 h-2.5 rounded-full border-2 border-slate-950 z-10 ${getActivityColor(activity.activity_type).split(' ')[1].replace('text-', 'bg-')}`} />

                                                        <div className="glass-panel p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all bg-slate-800/20">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`p-1.5 rounded-lg ${getActivityColor(activity.activity_type)}`}>
                                                                        {getActivityIcon(activity.activity_type)}
                                                                    </span>
                                                                    <div>
                                                                        <h4 className="text-sm font-bold text-white leading-tight">{activity.title}</h4>
                                                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{activity.activity_type}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 font-mono text-right">
                                                                    <div>{new Date(activity.created_at).toLocaleDateString()}</div>
                                                                    <div>{new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                                </div>
                                                            </div>
                                                            {activity.description && (
                                                                <p className="text-xs text-slate-400 pl-8 border-l border-slate-700/50 mt-2 py-1 italic line-clamp-3 group-hover:line-clamp-none transition-all cursor-default">
                                                                    "{activity.description}"
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="glass-panel p-12 rounded-2xl border border-white/5 text-center flex flex-col items-center justify-center h-full">
                                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 border border-white/5 group-hover:scale-110 transition-transform">
                                    <Users className="w-10 h-10 text-teal-500 opacity-40" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">AlphaClone CRM Intel</h3>
                                <p className="text-sm text-slate-400 max-w-xs mx-auto">
                                    Selecting a client reveals their full engagement history, health score, and predicted performance indicators.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            <AddClientModal
                isOpen={showAddClient}
                onClose={() => setShowAddClient(false)}
                onAdd={async (clientData) => {
                    if (!currentTenant) return;
                    setIsCreatingClient(true);
                    const { client, error } = await businessClientService.createClient(currentTenant.id, clientData);
                    if (!error && client) {
                        setClients([client, ...clients]);
                        setShowAddClient(false);
                        toast.success('Client added successfully!');
                    } else {
                        toast.error(error || 'Failed to add client');
                    }
                    setIsCreatingClient(false);
                }}
                loading={isCreatingClient}
            />

            {editingClient && (
                <EditClientModal
                    isOpen={showEditModal}
                    onClose={() => { setShowEditModal(false); setEditingClient(null); }}
                    client={editingClient}
                    onUpdate={(updates) => handleEditClient(editingClient.id, updates)}
                />
            )}

            <ImportClientsModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={handleImportClients}
            />
        </div>
    );
};

// --- Sub-components (Modals) ---

const AddClientModal: React.FC<{ isOpen: boolean; onClose: () => void; onAdd: (data: any) => Promise<void>; loading: boolean }> = ({ isOpen, onClose, onAdd, loading }) => {
    const [data, setData] = useState({ name: '', email: '', company: '', phone: '', stage: 'customer' });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Add New Client</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <Input label="Full Name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} placeholder="John Doe" />
                    <Input label="Email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="john@example.com" />
                    <Input label="Company" value={data.company} onChange={(e) => setData({ ...data, company: e.target.value })} placeholder="Company name" />
                    <Input label="Phone" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} placeholder="+1..." />
                </div>
                <div className="p-6 border-t border-slate-800 flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button
                        className="flex-1 bg-teal-600 hover:bg-teal-500"
                        onClick={() => onAdd(data)}
                        disabled={loading}
                    >
                        {loading ? 'Adding...' : 'Add Client'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const EditClientModal: React.FC<{ isOpen: boolean; onClose: () => void; client: BusinessClient; onUpdate: (updates: any) => Promise<void> }> = ({ isOpen, onClose, client, onUpdate }) => {
    const [data, setData] = useState({ ...client });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Edit Client</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <Input label="Full Name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
                    <Input label="Email" value={data.email || ''} onChange={(e) => setData({ ...data, email: e.target.value })} />
                    <Input label="Company" value={data.company || ''} onChange={(e) => setData({ ...data, company: e.target.value })} />
                    <Input label="Phone" value={data.phone || ''} onChange={(e) => setData({ ...data, phone: e.target.value })} />
                </div>
                <div className="p-6 border-t border-slate-800 flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button
                        className="flex-1 bg-teal-600 hover:bg-teal-500"
                        onClick={async () => {
                            setLoading(true);
                            await onUpdate(data);
                            setLoading(false);
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const ImportClientsModal: React.FC<{ isOpen: boolean; onClose: () => void; onImport: (data: any[]) => Promise<void> }> = ({ isOpen, onClose, onImport }) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);

    const onDrop = async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        setFile(file);
        setLoading(true);
        try {
            const { contacts, error } = await fileImportService.importFromExcel(file);
            if (error) {
                toast.error(error);
            } else {
                setPreviewData(contacts);
            }
        } catch (err) {
            toast.error('Failed to parse file');
        }
        setLoading(false);
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/pdf': ['.pdf']
        },
        multiple: false
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white">Import Clients</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-6">
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${isDragActive ? 'border-teal-500 bg-teal-500/10' : 'border-slate-800 hover:border-slate-700'
                            }`}
                    >
                        <input {...getInputProps()} />
                        <Upload className="w-10 h-10 text-slate-500 mx-auto mb-4" />
                        <p className="text-slate-300 font-medium">Click or drag file to upload</p>
                        <p className="text-slate-500 text-xs mt-2">Supports CSV, Excel, Word, and PDF</p>
                    </div>

                    {previewData.length > 0 && (
                        <div className="mt-6">
                            <h4 className="text-sm font-bold text-white mb-3 flex justify-between items-center">
                                Preview ({previewData.length} records)
                                <button onClick={() => setPreviewData([])} className="text-[10px] text-red-400 hover:underline">Clear</button>
                            </h4>
                            <div className="max-h-[200px] overflow-y-auto border border-slate-800 rounded-xl">
                                <table className="w-full text-left text-xs text-slate-400">
                                    <thead className="bg-slate-950 text-slate-500 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2">Name</th>
                                            <th className="px-4 py-2">Email</th>
                                            <th className="px-4 py-2">Company</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {previewData.slice(0, 10).map((row, i) => (
                                            <tr key={i}>
                                                <td className="px-4 py-2 text-white">{row.name}</td>
                                                <td className="px-4 py-2">{row.email}</td>
                                                <td className="px-4 py-2">{row.company}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {previewData.length > 10 && (
                                    <div className="p-2 text-center text-[10px] text-slate-600">
                                        + {previewData.length - 10} more records...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-6 border-t border-slate-800 flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button
                        className="flex-1 bg-teal-600 hover:bg-teal-500"
                        disabled={loading || previewData.length === 0}
                        onClick={async () => {
                            setLoading(true);
                            await onImport(previewData);
                            setLoading(false);
                        }}
                    >
                        {loading ? 'Importing...' : 'Confirm Import'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CRMTab;
