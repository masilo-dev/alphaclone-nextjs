import React, { useState, useEffect } from 'react';
import { Search, Loader2, UserPlus, X, Filter, CheckSquare, Square } from 'lucide-react';
import { Button, Modal, Input } from '../../ui/UIComponents';
import { toast } from 'react-hot-toast';
import { useTenant } from '@/contexts/TenantContext';
import { leadService, Lead } from '../../../services/leadService';
import { businessClientService } from '../../../services/businessClientService';

interface LeadImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: () => void;
}

export const LeadImportModal: React.FC<LeadImportModalProps> = ({ isOpen, onClose, onImportComplete }) => {
    const { currentTenant: tenant } = useTenant();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadLeads();
        }
    }, [isOpen]);

    const loadLeads = async () => {
        setLoading(true);
        try {
            const { leads: allLeads, error } = await leadService.getLeads();
            if (error) throw new Error(error);
            // Only show leads that are NOT already in CRM
            setLeads(allLeads.filter(l => !l.client_id));
        } catch (err: any) {
            toast.error(err.message || "Failed to load leads");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredLeads.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredLeads.map(l => l.id)));
        }
    };

    const handleImport = async () => {
        if (selectedIds.size === 0 || !tenant?.id) return;

        setIsSubmitting(true);
        try {
            const leadsToImport = leads.filter(l => selectedIds.has(l.id));
            let successCount = 0;

            for (const lead of leadsToImport) {
                const { client, error: clientError } = await businessClientService.createClient(tenant.id, {
                    name: lead.businessName,
                    email: lead.email,
                    phone: lead.phone,
                    value: lead.value || 0,
                    salesStage: 'customer',
                    industry: lead.industry,
                    location: lead.location,
                    description: lead.notes,
                    website: lead.website || lead.fb
                });

                if (client && !clientError) {
                    await leadService.updateLead(lead.id, {
                        client_id: client.id,
                        stage: 'qualified'
                    });
                    successCount++;
                }
            }

            toast.success(`Successfully imported ${successCount} leads to CRM`);
            onImportComplete();
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Error importing leads");
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredLeads = leads.filter(l =>
        l.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.industry?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (l.location?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (l.pmein?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import from Growth Agent (Leads)" maxWidth="max-w-3xl">
            <div className="space-y-4">
                <div className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search growth leads..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-teal-500"
                        />
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={toggleSelectAll}
                        icon={selectedIds.size === filteredLeads.length && filteredLeads.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    >
                        {selectedIds.size === filteredLeads.length && filteredLeads.length > 0 ? 'Deselect All' : 'Select All'}
                    </Button>
                </div>

                <div className="max-h-96 overflow-y-auto custom-scrollbar border border-white/5 rounded-xl">
                    {loading ? (
                        <div className="p-12 flex justify-center">
                            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                        </div>
                    ) : filteredLeads.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            {searchTerm ? 'No leads match your search.' : 'No unlinked leads found.'}
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-slate-950 z-10 border-b border-white/5">
                                <tr>
                                    <th className="p-4 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500"
                                        />
                                    </th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Business Name</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Industry</th>
                                    <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Location</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLeads.map((lead) => (
                                    <tr
                                        key={lead.id}
                                        onClick={() => toggleSelect(lead.id)}
                                        className={`border-b border-white/5 cursor-pointer transition-colors ${selectedIds.has(lead.id) ? 'bg-teal-500/10' : 'hover:bg-white/5'}`}
                                    >
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(lead.id)}
                                                onChange={() => { }} // Controlled by row click
                                                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-white">{lead.businessName}</div>
                                            <div className="text-xs text-slate-500">{lead.email || 'No email'}</div>
                                        </td>
                                        <td className="p-4 text-sm text-slate-400">{lead.industry || '-'}</td>
                                        <td className="p-4 text-sm text-slate-400">{lead.location || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="flex justify-between items-center pt-2">
                    <div className="text-xs text-slate-500">
                        {selectedIds.size} leads selected for import
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button
                            variant="primary"
                            onClick={handleImport}
                            disabled={selectedIds.size === 0 || isSubmitting}
                            isLoading={isSubmitting}
                            icon={<UserPlus className="w-4 h-4" />}
                        >
                            Import to CRM
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
