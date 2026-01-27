import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, XCircle, MessageSquare, Phone, Clock, DollarSign, FileText, Calendar, TrendingUp, Plus } from 'lucide-react';
import { Project, User } from '../../types';
import { userService } from '../../services/userService';
import { clientActivityService, ClientTimeline } from '../../services/clientActivityService';
import { Button } from '../ui/UIComponents';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';

interface CRMTabProps {
    projects: Project[];
    declineProject: (p: Project) => void;
    openContractGenerator: (p: Project) => void;
    openVideoCall: (clientId: string) => void;
    onNavigateToMessages?: (clientId: string) => void;
}

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
                            <div className="glass-panel p-6 rounded-2xl border border-white/5">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">
                                            {clientTimeline.client_name}
                                        </h3>
                                        <p className="text-sm text-slate-400">Complete Activity Timeline</p>
                                    </div>
                                    <button
                                        onClick={() => setShowAddNote(!showAddNote)}
                                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <Plus className="w-4 h-4" /> Add Note
                                    </button>
                                </div>

                                {/* Stats Dashboard */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <MessageSquare className="w-4 h-4 text-blue-400" />
                                            <span className="text-xs text-blue-400">Messages</span>
                                        </div>
                                        <div className="text-2xl font-bold text-white">{clientTimeline.stats.total_messages}</div>
                                    </div>
                                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Phone className="w-4 h-4 text-green-400" />
                                            <span className="text-xs text-green-400">Calls</span>
                                        </div>
                                        <div className="text-2xl font-bold text-white">{clientTimeline.stats.total_calls}</div>
                                    </div>
                                    <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Calendar className="w-4 h-4 text-purple-400" />
                                            <span className="text-xs text-purple-400">Meetings</span>
                                        </div>
                                        <div className="text-2xl font-bold text-white">{clientTimeline.stats.total_meetings}</div>
                                    </div>
                                    <div className="bg-teal-500/10 border border-teal-500/20 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <DollarSign className="w-4 h-4 text-teal-400" />
                                            <span className="text-xs text-teal-400">Payments</span>
                                        </div>
                                        <div className="text-2xl font-bold text-white">{clientTimeline.stats.total_payments}</div>
                                    </div>
                                </div>

                                {/* Add Note Form */}
                                {showAddNote && (
                                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
                                        <h4 className="text-sm font-semibold text-white mb-3">Add Client Note</h4>
                                        <input
                                            type="text"
                                            placeholder="Note title..."
                                            value={noteTitle}
                                            onChange={(e) => setNoteTitle(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-teal-500"
                                        />
                                        <textarea
                                            placeholder="Note description..."
                                            value={noteDescription}
                                            onChange={(e) => setNoteDescription(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-teal-500 min-h-[80px]"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleAddNote}
                                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-lg transition-colors"
                                            >
                                                Save Note
                                            </button>
                                            <button
                                                onClick={() => setShowAddNote(false)}
                                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Activity Timeline */}
                                <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                                    {loadingTimeline ? (
                                        <div className="text-center py-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
                                        </div>
                                    ) : clientTimeline.activities.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400">
                                            No activity yet
                                        </div>
                                    ) : (
                                        clientTimeline.activities.map((activity) => (
                                            <div key={activity.id} className="flex gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border flex-shrink-0 ${getActivityColor(activity.activity_type)}`}>
                                                    {getActivityIcon(activity.activity_type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <h4 className="text-sm font-semibold text-white">{activity.title}</h4>
                                                        <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                                                            {new Date(activity.created_at).toLocaleDateString()} {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    {activity.description && (
                                                        <p className="text-xs text-slate-400 line-clamp-2">{activity.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="glass-panel p-12 rounded-2xl border border-white/5 text-center">
                                <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-white mb-2">Select a Client</h3>
                                <p className="text-sm text-slate-400">
                                    Click on a client to view their complete activity timeline and communication history
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
