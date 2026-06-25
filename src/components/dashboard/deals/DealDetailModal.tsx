import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckSquare, Calendar, Clock, Plus, ArrowRight, DollarSign, TrendingUp, History, MessageSquare, Phone, Mail, User, FileText } from 'lucide-react';
import { Button, Card, Badge } from '../../ui/UIComponents';
import { Deal, DealStage, dealService } from '../../../services/dealService';
import { getForwardDealStages } from '../../../lib/stageProgression';
import { taskService, Task } from '../../../services/taskService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { ModuleIntelligenceCard } from '../ModuleIntelligenceCard';
import { supabase } from '../../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { transitionDealStage } from '@/lib/dealStageActions';
import { DealRevenueTimeline } from './DealRevenueTimeline';

interface DealDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    deal: Deal;
    onDealUpdate?: (deal: Deal) => void;
}

export default function DealDetailModal({ isOpen, onClose, deal, onDealUpdate }: DealDetailModalProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'tasks' | 'notes' | 'products' | 'history'>('overview');
    const [isLoading, setIsLoading] = useState(false);
    const [activities, setActivities] = useState<any[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [products, setProducts] = useState<{ id: string; name: string; quantity: number; unit_price: number }[]>([]);

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
                setActivities(fetchedActivities || []);
            }

            if (activeTab === 'tasks' || activeTab === 'overview') {
                const { tasks: fetchedTasks } = await taskService.getTasks({
                    relatedToDeal: deal.id
                });
                setTasks(fetchedTasks || []);
            }

            if (activeTab === 'products' || activeTab === 'overview') {
                const { data } = await supabase.from('deal_products').select('*').eq('deal_id', deal.id);
                setProducts((data || []) as typeof products);
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
            const result = await transitionDealStage({
                dealId: deal.id,
                fromStage: deal.stage,
                toStage: newStage,
                navigate: (path) => router.push(path),
            });
            if (!result.ok) throw new Error(result.message);

            const updatedDeal = { ...deal, stage: newStage };
            if (onDealUpdate) onDealUpdate(updatedDeal);
            toast.success(`Stage updated to ${stageLabels[newStage]}`);
            fetchDealData();
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
            case 'closed_won': return 'bg-green-500/10 text-green-400 border-green-500/20';
            case 'closed_lost': return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'negotiation': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
            case 'proposal': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'qualified': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-white/5';
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[115]"
                    />

                    {/* Drawer container */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="fixed top-0 right-0 bottom-0 w-full md:max-w-xl bg-slate-950 border-l border-white/10 z-[120] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)]"
                    >
                        {/* Drag Handle for Mobile Indicator */}
                        <div className="w-12 h-1 bg-slate-800 rounded-full mx-auto my-3 md:hidden" />

                        {/* Header */}
                        <div className="px-6 py-4 border-b border-white/5 bg-slate-900/50">
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <div className="flex items-center flex-wrap gap-2 mb-1.5">
                                        <h2 className="text-xl font-bold text-white tracking-tight">{deal.name}</h2>
                                        <Badge className={getStageColor(deal.stage)}>
                                            {stageLabels[deal.stage]}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                            Created: {deal.createdAt ? format(new Date(deal.createdAt), 'MMM d, yyyy') : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="px-6 border-b border-white/5 bg-slate-900/20 flex gap-6 overflow-x-auto scrollbar-hide">
                            {[
                                { id: 'overview', icon: User, label: 'Overview' },
                                { id: 'activity', icon: History, label: 'Activity' },
                                { id: 'products', icon: FileText, label: 'Products' },
                                { id: 'history', icon: TrendingUp, label: 'Stage History' },
                                { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
                                { id: 'notes', icon: MessageSquare, label: 'Notes' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id
                                        ? 'border-teal-500 text-teal-400'
                                        : 'border-transparent text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {activeTab === 'overview' && (
                                <div className="space-y-6">
                                    <DealRevenueTimeline dealId={deal.id} dealStage={deal.stage} />

                                    <ModuleIntelligenceCard moduleKey="aiProposals" title="Proposal and Deal Intelligence" />

                                    {/* Prominent 24px Bold Value Card */}
                                    <div className="bg-gradient-to-r from-teal-500/10 to-violet-500/10 border border-teal-500/20 rounded-2xl p-5 flex flex-col justify-between">
                                        <div className="text-xs uppercase tracking-widest text-teal-400 font-black mb-1">Deal Value</div>
                                        <div className="text-3xl font-extrabold text-white flex items-baseline gap-1" style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                            {deal.value ? `$${deal.value.toLocaleString()}` : '$0'}
                                            <span className="text-xs text-slate-500 font-normal ml-1">{deal.currency || 'USD'}</span>
                                        </div>
                                    </div>

                                    {/* Deal Details Panel */}
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Metadata & Details</h3>
                                        <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-4 space-y-3">
                                            <div className="flex justify-between items-center py-1.5 border-b border-white/5 text-sm">
                                                <span className="text-slate-400">Pipeline Stage</span>
                                                <div className="flex items-center gap-2">
                                                    {user?.role !== 'client' ? (
                                                        <select
                                                            value={deal.stage}
                                                            onChange={(e) => handleStageChange(e.target.value as DealStage)}
                                                            className="bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                                                            title="Pipeline stage"
                                                        >
                                                            {selectableStages.map((value) => (
                                                                <option key={value} value={value}>
                                                                    {stageLabels[value]}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <Badge className={getStageColor(deal.stage)}>
                                                            {stageLabels[deal.stage]}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center py-1.5 border-b border-white/5 text-sm">
                                                <span className="text-slate-400">Probability</span>
                                                <span className="font-semibold text-white">{deal.probability}%</span>
                                            </div>
                                            <div className="flex justify-between items-center py-1.5 border-b border-white/5 text-sm">
                                                <span className="text-slate-400">Expected Close</span>
                                                <span className="font-semibold text-white">{deal.expectedCloseDate ? format(new Date(deal.expectedCloseDate), 'MMM d, yyyy') : 'Not set'}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-1.5 border-b border-white/5 text-sm">
                                                <span className="text-slate-400">Owner</span>
                                                <span className="text-white">{deal.ownerId || 'Unassigned'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'activity' && (
                                <div className="space-y-6">
                                    <div className="relative border-l border-white/10 ml-3 pl-6 space-y-6">
                                        {activities.map((activity) => (
                                            <div key={activity.id} className="relative">
                                                <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-teal-500/50" />
                                                <div className="bg-slate-900/30 border border-white/5 p-4 rounded-xl">
                                                    <div className="flex justify-between items-start gap-4 mb-1">
                                                        <p className="font-semibold text-white text-sm">{activity.description}</p>
                                                        <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(activity.createdAt), 'MMM d, h:mm a')}</span>
                                                    </div>
                                                    {activity.metadata?.old_stage && (
                                                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                                                            <span className="text-slate-500 uppercase font-bold px-1.5 py-0.5 bg-slate-800 rounded">{stageLabels[activity.metadata.old_stage as DealStage]}</span>
                                                            <ArrowRight className="w-3 h-3 text-slate-600" />
                                                            <span className="text-teal-400 uppercase font-bold px-1.5 py-0.5 bg-slate-800 rounded">{stageLabels[activity.metadata.new_stage as DealStage]}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {activities.length === 0 && (
                                            <div className="text-center py-12 text-slate-500 text-sm">
                                                No activity recorded yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'products' && (
                                <div className="space-y-3">
                                    {products.length === 0 ? (
                                        <p className="text-sm text-slate-500 py-8 text-center">No line items on this deal.</p>
                                    ) : (
                                        products.map((p) => (
                                            <div key={p.id} className="flex justify-between p-3 bg-slate-900/30 rounded-xl border border-white/5 text-sm">
                                                <span className="text-white">{p.name}</span>
                                                <span className="text-teal-400">{p.quantity} × ${Number(p.unit_price).toLocaleString()}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="space-y-2">
                                    {activities.filter((a) => a.metadata?.old_stage || a.type === 'stage_change').map((a) => (
                                        <div key={a.id} className="p-3 bg-slate-900/30 rounded-xl border border-white/5 text-sm text-slate-300">
                                            {format(new Date(a.createdAt), 'MMM d, h:mm a')} — stage updated
                                        </div>
                                    ))}
                                    {activities.filter((a) => a.metadata?.old_stage).length === 0 && (
                                        <p className="text-sm text-slate-500 py-8 text-center">No stage changes recorded.</p>
                                    )}
                                </div>
                            )}

                            {activeTab === 'tasks' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        {tasks.length === 0 ? (
                                            <div className="text-center py-12 text-slate-500">
                                                <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                                <p className="text-sm">No tasks found for this deal.</p>
                                            </div>
                                        ) : (
                                            tasks.map((task) => (
                                                <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-900/30 rounded-xl border border-white/5">
                                                    <div className={`w-4 h-4 rounded border ${task.status === 'completed' ? 'bg-teal-500 border-teal-500' : 'border-slate-600'}`} />
                                                    <span className="flex-1 text-slate-200 text-sm">{task.title}</span>
                                                    {task.dueDate && <span className="text-xs text-slate-500">{format(new Date(task.dueDate), 'MMM d')}</span>}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'notes' && (
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <textarea
                                            value={newNote}
                                            onChange={(e) => setNewNote(e.target.value)}
                                            className="w-full h-24 bg-slate-900 border border-white/10 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
                                            placeholder="Write your note here..."
                                        />
                                        <div className="flex justify-end">
                                            <Button
                                                onClick={handleAddNote}
                                                isLoading={isSavingNote}
                                                disabled={!newNote.trim()}
                                                className="bg-teal-500 hover:bg-teal-600 text-white font-bold"
                                            >
                                                Save Note
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-3 border-t border-white/5 pt-4">
                                        {activities.filter(a => a.type === 'note').map((note) => (
                                            <div key={note.id} className="p-4 bg-slate-900/20 rounded-xl border border-white/5">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 uppercase font-bold">
                                                            UN
                                                        </div>
                                                        <span className="text-xs font-semibold text-slate-300">User</span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-500">{format(new Date(note.createdAt), 'MMM d, h:mm a')}</span>
                                                </div>
                                                <p className="text-sm text-slate-300 whitespace-pre-wrap">{note.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
