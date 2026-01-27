import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, Clock, Calendar, Save, X } from 'lucide-react';
import { milestoneService, Milestone } from '../../../services/milestoneService';
import { toast } from 'react-hot-toast';

interface MilestoneManagerProps {
    projectId: string;
    onClose?: () => void;
}

export default function MilestoneManager({ projectId, onClose }: MilestoneManagerProps) {
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newMilestone, setNewMilestone] = useState({ name: '', description: '', dueDate: '' });

    useEffect(() => {
        loadMilestones();
    }, [projectId]);

    const loadMilestones = async () => {
        setIsLoading(true);
        const { milestones, error } = await milestoneService.getMilestones(projectId);
        if (error) {
            toast.error('Failed to load milestones');
        } else {
            setMilestones(milestones);
        }
        setIsLoading(false);
    };

    const handleCreate = async () => {
        if (!newMilestone.name.trim()) return;

        const { milestone, error } = await milestoneService.createMilestone(projectId, {
            name: newMilestone.name,
            description: newMilestone.description,
            dueDate: newMilestone.dueDate || undefined,
            status: 'pending'
        });

        if (error) {
            toast.error('Failed to create milestone');
        } else if (milestone) {
            setMilestones([...milestones, milestone]);
            setNewMilestone({ name: '', description: '', dueDate: '' });
            setIsAdding(false);
            toast.success('Milestone added');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this milestone?')) return;

        const { error } = await milestoneService.deleteMilestone(id);
        if (error) {
            toast.error('Failed to delete milestone');
        } else {
            setMilestones(milestones.filter(m => m.id !== id));
            toast.success('Milestone deleted');
        }
    };

    const toggleStatus = async (milestone: Milestone) => {
        const newStatus = milestone.status === 'completed' ? 'pending' : 'completed';
        const { error } = await milestoneService.updateMilestone(milestone.id, { status: newStatus });

        if (error) {
            toast.error('Failed to update status');
        } else {
            setMilestones(milestones.map(m => m.id === milestone.id ? { ...m, status: newStatus } : m));
            toast.success(`Milestone marked as ${newStatus}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Project Phases</h3>
                <button
                    onClick={() => setIsAdding(true)}
                    disabled={isAdding}
                    className="flex items-center gap-2 px-3 py-1.5 bg-teal-500/10 text-teal-400 rounded-lg hover:bg-teal-500/20 transition-colors text-sm disabled:opacity-50"
                >
                    <Plus className="w-4 h-4" />
                    Add Phase
                </button>
            </div>

            {isAdding && (
                <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3 animate-fade-in">
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Phase Name</label>
                        <input
                            type="text"
                            value={newMilestone.name}
                            onChange={(e) => setNewMilestone({ ...newMilestone, name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-teal-500 outline-none"
                            placeholder="e.g. Design Approval"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Description (Optional)</label>
                        <input
                            type="text"
                            value={newMilestone.description}
                            onChange={(e) => setNewMilestone({ ...newMilestone, description: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-teal-500 outline-none"
                            placeholder="Details about this phase..."
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Due Date (Optional)</label>
                        <input
                            type="date"
                            value={newMilestone.dueDate}
                            onChange={(e) => setNewMilestone({ ...newMilestone, dueDate: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-teal-500 outline-none"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={() => setIsAdding(false)}
                            className="px-3 py-1.5 text-slate-400 hover:text-white text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!newMilestone.name.trim()}
                            className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm disabled:opacity-50"
                        >
                            <Save className="w-3 h-3" />
                            Save Phase
                        </button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="text-center py-8 text-slate-500">Loading phases...</div>
            ) : milestones.length === 0 ? (
                <div className="text-center py-8 text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    No phases defined. Add one to get started.
                </div>
            ) : (
                <div className="space-y-3">
                    {milestones.map((milestone) => (
                        <div
                            key={milestone.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${milestone.status === 'completed'
                                    ? 'bg-slate-900/50 border-slate-800 opacity-75'
                                    : 'bg-slate-900 border-slate-700'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => toggleStatus(milestone)}
                                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${milestone.status === 'completed'
                                            ? 'bg-teal-500 text-white'
                                            : 'bg-slate-800 border border-slate-600 hover:border-teal-500'
                                        }`}
                                >
                                    {milestone.status === 'completed' && <CheckCircle className="w-3 h-3" />}
                                </button>
                                <div>
                                    <div className={`font-medium ${milestone.status === 'completed' ? 'text-slate-400 line-through' : 'text-white'}`}>
                                        {milestone.name}
                                    </div>
                                    {(milestone.description || milestone.dueDate) && (
                                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                            {milestone.dueDate && (
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3" />
                                                    {new Date(milestone.dueDate).toLocaleDateString()}
                                                </span>
                                            )}
                                            {milestone.description && <span>{milestone.description}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(milestone.id)}
                                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                title="Delete phase"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
