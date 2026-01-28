import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, XCircle, MessageSquare, Phone, Clock, DollarSign, FileText, Calendar, TrendingUp, Plus, Filter, Heart, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Project, User } from '../../types';
import { userService } from '../../services/userService';
import { clientActivityService, ClientTimeline } from '../../services/clientActivityService';
import { Button, Badge } from '../ui/UIComponents';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';

interface CRMTabProps {
    projects: Project[];
    declineProject: (p: Project) => void;
    openContractGenerator: (p: Project) => void;
    openVideoCall: (clientId: string) => void;
    onNavigateToMessages?: (clientId: string) => void;
}

type ActivityFilter = 'all' | 'message' | 'call' | 'meeting' | 'contract' | 'payment' | 'project_update' | 'file_upload' | 'note';

const CRMTab: React.FC<CRMTabProps> = ({ projects, declineProject, openVideoCall, onNavigateToMessages }) => {
    const router = useRouter();
    const [clients, setClients] = useState<User[]>([]);
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

    useEffect(() => {
        const loadClients = async () => {
            const { users } = await userService.getUsers();
            // Filter to show only clients (assuming role 'client')
            setClients(users.filter(u => u.role === 'client'));
            setLoading(false);
        };
        loadClients();
    }, []);

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

    const filteredActivities = useMemo(() => {
        if (!clientTimeline) return [];
        if (activityFilter === 'all') return clientTimeline.activities;
        return clientTimeline.activities.filter(a => a.activity_type === activityFilter);
    }, [clientTimeline, activityFilter]);

    const handleAddClient = async () => {
        if (!newClient.name || !newClient.email) {
            import('react-hot-toast').then(({ toast }) => toast.error('Name and Email are required'));
            return;
        }

        setIsCreatingClient(true);
        try {
            const { client, error } = await userService.createClient(newClient);
            if (error) throw new Error(error);

            if (client) {
                setClients(prev => [client, ...prev]);
                setShowAddClient(false);
                setNewClient({ name: '', email: '', company: '' });
                import('react-hot-toast').then(({ toast }) => toast.success('Client added successfully!'));
            }
        } catch (err: any) {
            import('react-hot-toast').then(({ toast }) => toast.error(`Failed to add client: ${err.message}`));
        } finally {
            setIsCreatingClient(false);
        }
    };

    const handleAddNote = async () => {
        if (!selectedClient || !noteTitle.trim()) return;

        const currentUser = await userService.getCurrentUser();
        if (!currentUser) return;

        const { activity } = await clientActivityService.addClientNote(
            selectedClient,
            noteTitle,
            noteDescription,
            currentUser.id
        );

        if (activity) {
            // Reload timeline
            loadClientTimeline(selectedClient);
            setShowAddNote(false);
            setNoteTitle('');
            setNoteDescription('');
        }
    };

    // Combine Clients with their projects
    const clientCards = clients.map(client => {
        // Find active project for client
        const clientProject = projects.find(p => p.ownerId === client.id);

        return {
            id: client.id,
            name: client.name,
            email: client.email,
            avatar: client.avatar,
            project: clientProject,
            status: clientProject ? clientProject.status : 'No Active Project',
            value: clientProject ? `$${(clientProject.budget || 0).toLocaleString()}` : '$0'
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
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-violet-500 flex items-center gap-3">
                        <Users className="w-6 h-6 sm:w-8 sm:h-8 text-teal-400" /> CRM Directory
                    </h2>
                    <p className="text-slate-400 mt-1 text-xs sm:text-sm">Manage {clients.length} registered clients</p>
                </div>
                <button
                    onClick={() => setShowAddClient(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-all active:scale-95 shadow-lg shadow-teal-900/20"
                >
                    <Plus className="w-4 h-4" /> Add Client
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
                    title="No Clients Yet"
                    description="Clients will appear here once they register and create projects."
                />
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Client Cards - Left Side */}
                    <div className="xl:col-span-1 space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
                        {clientCards.map((client) => (
                            <div
                                key={client.id}
                                className={`glass-panel p-4 rounded-xl border cursor-pointer transition-all ${selectedClient === client.id
                                    ? 'border-teal-500 bg-teal-500/5'
                                    : 'border-white/5 hover:border-teal-500/30'
                                    }`}
                                onClick={() => setSelectedClient(client.id)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <img src={client.avatar} alt={client.name} className="w-10 h-10 rounded-full border border-white/10" />
                                        <div>
                                            <h3 className="font-bold text-white text-sm">{client.name}</h3>
                                            <p className="text-xs text-slate-400">{client.email}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-[10px] rounded-full font-bold uppercase ${client.status === 'Active' ? 'bg-green-500/10 text-green-400' :
                                        client.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-400' :
                                            'bg-slate-800 text-slate-500'
                                        }`}>
                                        {client.status}
                                    </span>
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
                                    <Filter className="w-4 h-4 text-slate-500 mr-2 flex-shrink-0" />
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
                                    ) : filteredActivities.length === 0 ? (
                                        <div className="text-center py-12 text-slate-500">
                                            <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No activity matches the selected filter.</p>
                                        </div>
                                    ) : (
                                        <div className="relative pl-6 border-l border-slate-800 space-y-6">
                                            {filteredActivities.map((activity) => (
                                                <div key={activity.id} className="relative group">
                                                    {/* Timeline Dot */}
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
                                            ))}
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
            {/* Add Client Modal */}
            {showAddClient && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Add New Client</h3>
                            <button onClick={() => setShowAddClient(false)} className="text-slate-400 hover:text-white transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</label>
                                <input
                                    type="text"
                                    value={newClient.name}
                                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-all"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                                <input
                                    type="email"
                                    value={newClient.email}
                                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-all"
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Company (Optional)</label>
                                <input
                                    type="text"
                                    value={newClient.company}
                                    onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500 transition-all"
                                    placeholder="Company Name"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-800 flex gap-3">
                            <button
                                onClick={() => setShowAddClient(false)}
                                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddClient}
                                disabled={isCreatingClient}
                                className="flex-2 px-6 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-teal-900/20"
                            >
                                {isCreatingClient ? 'Adding...' : 'Add Client'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CRMTab;
