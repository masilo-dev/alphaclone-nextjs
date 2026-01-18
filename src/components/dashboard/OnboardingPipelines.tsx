import React, { useState, useEffect } from 'react';
import { Plus, MoreVertical, Mail, Phone, Calendar, DollarSign, Edit, Trash2, X, Loader2 } from 'lucide-react';
import { Button, Card, Modal, Input } from '../ui/UIComponents';
import { User } from '../../types';
import { leadService, Lead } from '../../services/leadService';
import toast from 'react-hot-toast';

interface OnboardingPipelinesProps {
    user: User;
}

/**
 * FULLY FUNCTIONAL Onboarding Pipelines with:
 * - Drag and drop between stages
 * - Add/Edit/Delete leads
 * - Real-time updates
 * - Proper error handling
 */
const OnboardingPipelines: React.FC<OnboardingPipelinesProps> = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        businessName: '',
        industry: '',
        email: '',
        phone: '',
        value: '',
        notes: '',
        stage: 'lead' as Lead['stage']
    });

    useEffect(() => {
        loadLeads();
    }, []);

    const loadLeads = async () => {
        setLoading(true);
        try {
            const { leads: data } = await leadService.getLeads();
            setLeads(data || []);
        } catch (err) {
            console.error('Failed to load leads:', err);
            toast.error('Failed to load leads');
        } finally {
            setLoading(false);
        }
    };

    const handleAddLead = () => {
        setEditingLead(null);
        setFormData({
            businessName: '',
            industry: '',
            email: '',
            phone: '',
            value: '',
            notes: '',
            stage: 'lead'
        });
        setIsModalOpen(true);
    };

    const handleEditLead = (lead: Lead) => {
        setEditingLead(lead);
        setFormData({
            businessName: lead.businessName,
            industry: lead.industry || '',
            email: lead.email || '',
            phone: lead.phone || '',
            value: lead.value?.toString() || '',
            notes: lead.notes || '',
            stage: lead.stage
        });
        setIsModalOpen(true);
    };

    const handleDeleteLead = async (lead: Lead) => {
        if (!confirm(`Delete lead "${lead.businessName}"?`)) return;

        toast.promise(
            leadService.deleteLead(lead.id),
            {
                loading: 'Deleting lead...',
                success: () => {
                    loadLeads();
                    return 'Lead deleted successfully!';
                },
                error: 'Failed to delete lead'
            }
        );
    };

    const handleSaveLead = async () => {
        if (!formData.businessName.trim()) {
            toast.error('Business name is required');
            return;
        }

        setIsSaving(true);

        try {
            const leadData = {
                businessName: formData.businessName,
                industry: formData.industry,
                email: formData.email,
                phone: formData.phone,
                value: formData.value ? parseFloat(formData.value) : undefined,
                notes: formData.notes,
                stage: formData.stage
            };

            if (editingLead) {
                await toast.promise(
                    leadService.updateLead(editingLead.id, leadData),
                    {
                        loading: 'Updating lead...',
                        success: 'Lead updated successfully!',
                        error: 'Failed to update lead'
                    }
                );
            } else {
                await toast.promise(
                    leadService.addLead(leadData),
                    {
                        loading: 'Creating lead...',
                        success: 'Lead created successfully!',
                        error: 'Failed to create lead'
                    }
                );
            }

            loadLeads();
            setIsModalOpen(false);
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setIsSaving(false);
        }
    };

    // Drag and Drop handlers
    const handleDragStart = (lead: Lead) => {
        setDraggedLead(lead);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (stageId: string) => {
        if (!draggedLead || draggedLead.stage === stageId) {
            setDraggedLead(null);
            return;
        }

        const oldStage = draggedLead.stage;
        const newStage = stageId as Lead['stage'];

        // Optimistic update
        setLeads(prev => prev.map(l =>
            l.id === draggedLead.id ? { ...l, stage: newStage } : l
        ));

        try {
            await leadService.updateLead(draggedLead.id, { stage: newStage });
            toast.success(`Moved to ${stageId}`);
        } catch (err) {
            // Rollback on error
            setLeads(prev => prev.map(l =>
                l.id === draggedLead.id ? { ...l, stage: oldStage } : l
            ));
            toast.error('Failed to move lead');
        } finally {
            setDraggedLead(null);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-teal-500 animate-spin mb-4" />
                <p className="text-slate-400">Loading pipelines...</p>
            </div>
        );
    }

    const stages = [
        { id: 'lead', label: 'Lead', color: 'bg-slate-600', count: leads.filter(l => l.stage === 'lead').length },
        { id: 'qualified', label: 'Qualified', color: 'bg-blue-600', count: leads.filter(l => l.stage === 'qualified').length },
        { id: 'proposal', label: 'Proposal', color: 'bg-purple-600', count: leads.filter(l => l.stage === 'proposal').length },
        { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-600', count: leads.filter(l => l.stage === 'negotiation').length },
        { id: 'won', label: 'Won', color: 'bg-green-600', count: leads.filter(l => l.stage === 'won').length },
        { id: 'lost', label: 'Lost', color: 'bg-red-600', count: leads.filter(l => l.stage === 'lost').length },
    ];

    const totalValue = leads
        .filter(l => l.stage !== 'lost')
        .reduce((sum, lead) => sum + (lead.value || 0), 0);

    const wonValue = leads
        .filter(l => l.stage === 'won')
        .reduce((sum, lead) => sum + (lead.value || 0), 0);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-white">Onboarding Pipelines</h2>
                    <p className="text-slate-400 mt-1">Manage leads and track conversion progress</p>
                </div>
                <Button onClick={handleAddLead} className="bg-teal-600 hover:bg-teal-500">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Lead
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                    <div className="text-sm text-slate-400 mb-1">Total Leads</div>
                    <div className="text-2xl font-bold text-white">{leads.length}</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-slate-400 mb-1">Pipeline Value</div>
                    <div className="text-2xl font-bold text-white">${(totalValue / 1000).toFixed(1)}k</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-slate-400 mb-1">Won Deals</div>
                    <div className="text-2xl font-bold text-green-400">${(wonValue / 1000).toFixed(1)}k</div>
                </Card>
                <Card className="p-4">
                    <div className="text-sm text-slate-400 mb-1">Conversion Rate</div>
                    <div className="text-2xl font-bold text-white">
                        {leads.length > 0 ? ((leads.filter(l => l.stage === 'won').length / leads.length) * 100).toFixed(0) : 0}%
                    </div>
                </Card>
            </div>

            {/* Kanban Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 overflow-x-auto pb-4">
                {stages.map((stage) => (
                    <div
                        key={stage.id}
                        className="min-w-[280px]"
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(stage.id)}
                    >
                        {/* Column Header */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                                    <h3 className="font-semibold text-white">{stage.label}</h3>
                                    <span className="text-xs text-slate-500">({stage.count})</span>
                                </div>
                            </div>
                        </div>

                        {/* Cards */}
                        <div className="space-y-3 min-h-[200px]">
                            {leads
                                .filter((lead) => lead.stage === stage.id)
                                .map((lead) => (
                                    <Card
                                        key={lead.id}
                                        draggable
                                        onDragStart={() => handleDragStart(lead)}
                                        className="p-4 hover:border-teal-500/50 transition-all cursor-move group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-white text-sm mb-1 group-hover:text-teal-400 transition-colors">
                                                    {lead.businessName}
                                                </h4>
                                                <p className="text-xs text-slate-500">{lead.industry}</p>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEditLead(lead)}
                                                    className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                                                    title="Edit lead"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteLead(lead)}
                                                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                                                    title="Delete lead"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2 mb-3">
                                            {lead.email && (
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <Mail className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">{lead.email}</span>
                                                </div>
                                            )}
                                            {lead.phone && (
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                    <Phone className="w-3 h-3 flex-shrink-0" />
                                                    <span>{lead.phone}</span>
                                                </div>
                                            )}
                                        </div>

                                        {lead.value && (
                                            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                                    <DollarSign className="w-3 h-3" />
                                                    <span className="font-semibold text-white">${(lead.value / 1000).toFixed(1)}k</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>{lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '-'}</span>
                                                </div>
                                            </div>
                                        )}

                                        {lead.notes && (
                                            <div className="mt-2 pt-2 border-t border-slate-800">
                                                <p className="text-xs text-slate-400 line-clamp-2">{lead.notes}</p>
                                            </div>
                                        )}
                                    </Card>
                                ))}

                            {/* Empty State */}
                            {leads.filter((lead) => lead.stage === stage.id).length === 0 && (
                                <div className="p-8 text-center border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/30">
                                    <p className="text-xs text-slate-500">Drag leads here or click + to add</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <Modal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    title={editingLead ? 'Edit Lead' : 'Add New Lead'}
                >
                    <div className="space-y-4">
                        <Input
                            label="Business Name *"
                            value={formData.businessName}
                            onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                            placeholder="e.g., Acme Corp"
                            required
                        />

                        <Input
                            label="Industry"
                            value={formData.industry}
                            onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                            placeholder="e.g., Technology"
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="contact@company.com"
                            />

                            <Input
                                label="Phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+1 234 567 8900"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Deal Value ($)"
                                type="number"
                                value={formData.value}
                                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                placeholder="50000"
                            />

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Stage
                                </label>
                                <select
                                    value={formData.stage}
                                    onChange={(e) => setFormData({ ...formData, stage: e.target.value as Lead['stage'] })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                                >
                                    <option value="lead">Lead</option>
                                    <option value="qualified">Qualified</option>
                                    <option value="proposal">Proposal</option>
                                    <option value="negotiation">Negotiation</option>
                                    <option value="won">Won</option>
                                    <option value="lost">Lost</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Notes
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Add notes about this lead..."
                                rows={4}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 bg-slate-700 hover:bg-slate-600"
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveLead}
                                className="flex-1 bg-teal-600 hover:bg-teal-500"
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                        Saving...
                                    </>
                                ) : (
                                    editingLead ? 'Update Lead' : 'Create Lead'
                                )}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default OnboardingPipelines;
