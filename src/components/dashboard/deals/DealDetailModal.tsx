import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, Clock, Plus, ArrowRight, DollarSign, TrendingUp, History, MessageSquare, Phone, Mail, User, FileText } from 'lucide-react';
import { Modal, Button, Card, Badge } from '../../ui/UIComponents';
import { Deal, DealStage, dealService } from '../../../services/dealService';
import { getForwardDealStages } from '../../../lib/stageProgression';
import { taskService, Task } from '../../../services/taskService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ModuleIntelligenceCard } from '../ModuleIntelligenceCard';

interface DealDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    deal: Deal;
    onDealUpdate?: (deal: Deal) => void;
}

export default function DealDetailModal({ isOpen, onClose, deal, onDealUpdate }: DealDetailModalProps) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'tasks' | 'notes'>('overview');
    const [isLoading, setIsLoading] = useState(false);
    const [activities, setActivities] = useState<any[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);

    // New Note State
    const [newNote, setNewNote] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    useEffect(() => {
        if (isOpen && deal.id) {
            fetchDealData();
        }
    }, [isOpen, deal.id, activeTab]);

    const fetchDealData = async () => {
        setIsLoading(true);
        try {
            if (activeTab === 'activity' || activeTab === 'overview') {
                const { activities: fetchedActivities } = await dealService.getDealActivities(deal.id);
                setActivities(fetchedActivities);
            }

            if (activeTab === 'tasks' || activeTab === 'overview') {
                const { tasks: fetchedTasks } = await taskService.getTasks({
                    relatedToDeal: deal.id
                });
                setTasks(fetchedTasks);
            }
        } catch (error) {
            console.error('Error fetching deal data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim() || !user) return;
        setIsSavingNote(true);
        try {
            const { error } = await dealService.addDealActivity(deal.id, user.id, 'note', newNote);
            if (error) throw new Error(error);
            toast.success('Note added');
            setNewNote('');
            fetchDealData();
        } catch (error) {
            toast.error('Failed to add note');
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleStageChange = async (newStage: DealStage) => {
        try {
            const { error } = await dealService.updateDeal(deal.id, { stage: newStage });
            if (error) throw new Error(error);

            const updatedDeal = { ...deal, stage: newStage };
            if (onDealUpdate) onDealUpdate(updatedDeal);
            toast.success(`Stage updated to ${stageLabels[newStage]}`);
            fetchDealData(); // This will show the new activity log
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update stage');
        }
    };

    const selectableStages = getForwardDealStages(deal.stage) as DealStage[];

    const stageLabels: Record<DealStage, string> = {
        lead: 'Lead',
        qualified: 'Qualified',
        proposal: 'Proposal',
        negotiation: 'Negotiation',
        closed_won: 'Closed Won',
        closed_lost: 'Closed Lost'
    };

    const getStageColor = (stage: DealStage) => {
        switch (stage) {
            case 'closed_won': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'closed_lost': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'negotiation': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title=""
            maxWidth="max-w-4xl"
        >
            <div className="flex flex-col h-[80vh] -m-6">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-900">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-bold text-white">{deal.name}</h2>
                                <Badge className={getStageColor(deal.stage)}>
                                    {stageLabels[deal.stage]}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-400">
                                <span className="flex items-center gap-1">
                                    <DollarSign className="w-4 h-4" />
                                    {deal.value?.toLocaleString()} {deal.currency || 'USD'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <TrendingUp className="w-4 h-4" />
                                    {deal.probability}% Probability
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={deal.stage}
                                onChange={(e) => handleStageChange(e.target.value as DealStage)}
                                className="bg-slate-800 border-slate-700 text-white rounded-lg px-3 py-1.5 text-sm focus:ring-teal-500"
                                title="Pipeline moves forward only; use Closed lost to exit."
                            >
                                {selectableStages.map((value) => (
                                    <option key={value} value={value}>
                                        {stageLabels[value]}
                                    </option>
                                ))}
                            </select>
                            <Button variant="outline" size="sm" onClick={onClose}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b border-slate-800 bg-slate-900/50 flex gap-6">
                    {[
                        { id: 'overview', icon: User, label: 'Overview' },
                        { id: 'activity', icon: History, label: 'Activity & History' },
                        { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
                        { id: 'notes', icon: MessageSquare, label: 'Notes' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === tab.id
                                ? 'border-teal-500 text-white'
                                : 'border-transparent text-slate-400 hover:text-slate-300'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2">
                                <ModuleIntelligenceCard moduleKey="aiProposals" title="Proposal and Deal Intelligence" />
                            </div>
                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Deal Details</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-slate-400">Value</span>
                                        <span className="text-white font-medium">{deal.value?.toLocaleString()} {deal.currency}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-slate-400">Owner</span>
                                        <span className="text-white">{deal.ownerId || 'Unassigned'}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-slate-400">Created</span>
                                        <span className="text-white">{deal.createdAt ? format(new Date(deal.createdAt), 'MMM d, yyyy') : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-slate-400">Expected Close</span>
                                        <span className="text-white">{deal.expectedCloseDate ? format(new Date(deal.expectedCloseDate), 'MMM d, yyyy') : 'Not set'}</span>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                                <div className="space-y-4">
                                    {activities.slice(0, 3).map((activity) => (
                                        <div key={activity.id} className="flex gap-3">
                                            <div className="w-2 h-2 rounded-full bg-teal-500 mt-1.5" />
                                            <div>
                                                <p className="text-sm text-slate-200">{activity.description}</p>
                                                <p className="text-xs text-slate-500">{format(new Date(activity.createdAt), 'MMM d, h:mm a')}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {activities.length === 0 && <p className="text-sm text-slate-500">No recent activity</p>}
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <div className="space-y-6">
                            <div className="relative border-l-2 border-slate-800 ml-4 pl-8 space-y-8">
                                {activities.map((activity) => (
                                    <div key={activity.id} className="relative">
                                        <div className="absolute -left-[41px] top-0 w-5 h-5 rounded-full bg-slate-900 border-2 border-slate-800 flex items-center justify-center">
                                            <div className={`w-2 h-2 rounded-full ${activity.type === 'stage_change' ? 'bg-teal-500' : 'bg-blue-500'}`} />
                                        </div>
                                        <div className="glass-panel p-4 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-medium text-white">{activity.description}</p>
                                                <span className="text-xs text-slate-500">{format(new Date(activity.createdAt), 'MMM d, p')}</span>
                                            </div>
                                            {activity.metadata?.old_stage && (
                                                <div className="flex items-center gap-2 mt-2 text-xs">
                                                    <Badge variant="neutral" className="text-xs opacity-60">{stageLabels[activity.metadata.old_stage as DealStage]}</Badge>
                                                    <ArrowRight className="w-3 h-3 text-slate-600" />
                                                    <Badge variant="blue" className="text-xs text-teal-400 border-teal-500/20">{stageLabels[activity.metadata.new_stage as DealStage]}</Badge>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {activities.length === 0 && (
                                    <div className="text-center py-12 text-slate-500">
                                        <p>No activity recorded yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-white">Tasks</h3>
                                <Button size="sm" className="bg-teal-600">
                                    <Plus className="w-4 h-4 mr-2" /> Add Task
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {tasks.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No tasks found for this deal.</p>
                                    </div>
                                ) : (
                                    tasks.map(task => (
                                        <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                                            <div className={`w-5 h-5 rounded border ${task.status === 'completed' ? 'bg-teal-500 border-teal-500' : 'border-slate-600'}`} />
                                            <span className="flex-1 text-slate-200">{task.title}</span>
                                            {task.dueDate && <span className="text-xs text-slate-500">{format(new Date(task.dueDate), 'MMM d')}</span>}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <textarea
                                    value={newNote}
                                    onChange={(e) => setNewNote(e.target.value)}
                                    className="w-full h-32 bg-slate-900 border border-slate-800 rounded-xl p-4 text-white focus:ring-2 focus:ring-teal-500 outline-none"
                                    placeholder="Add a progress update, note from a call, or internal comment..."
                                />
                                <div className="flex justify-end">
                                    <Button
                                        onClick={handleAddNote}
                                        isLoading={isSavingNote}
                                        disabled={!newNote.trim()}
                                        className="bg-teal-600"
                                    >
                                        Save Note
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-4 border-t border-white/5 pt-6">
                                {activities.filter(a => a.type === 'note').map((note) => (
                                    <div key={note.id} className="p-4 bg-slate-900/40 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400">
                                                    UN
                                                </div>
                                                <span className="text-xs font-medium text-slate-300">User</span>
                                            </div>
                                            <span className="text-xs text-slate-500">{format(new Date(note.createdAt), 'MMM d, yyyy h:mm a')}</span>
                                        </div>
                                        <p className="text-sm text-slate-300 whitespace-pre-wrap">{note.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

