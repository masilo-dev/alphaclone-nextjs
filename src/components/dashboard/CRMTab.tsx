'use client';
// @ts-nocheck

import React, { useState, useMemo } from 'react';
import {
    Briefcase,
    Search,
    Plus,
    Filter,
    MoreVertical,
    Phone,
    Mail,
    Globe,
    Calendar,
    DollarSign,
    Users,
    TrendingUp,
    FileText,
    ArrowRight,
    Loader2,
    X,
    Check,
    Trash2,
    Edit2,
    Upload,
    CheckCircle2
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { businessClientService, BusinessClient } from '../../services/businessClientService';
import { Button, Input, Modal } from '../ui/UIComponents';
import toast from 'react-hot-toast';
import { EmptyState } from '../ui/EmptyState';
import { useClients } from '@/hooks/useClients';
import dynamic from 'next/dynamic';

const FixedSizeList = dynamic(
    () => import('react-window').then((mod: any) => mod.FixedSizeList),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
        )
    }
) as any;

const AutoSizer = dynamic(
    () => import('react-virtualized-auto-sizer').then((mod: any) => mod.default),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
        )
    }
) as any;
import { ClientImportModal } from './crm/ClientImport';

interface CRMTabProps {
    userId: string;
    userRole: string;
}

const CRMTab: React.FC<CRMTabProps> = ({ userId, userRole }) => {
    const { user } = useAuth();
    const { currentTenant: tenant } = useTenant();
    const [searchTerm, setSearchQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState<BusinessClient | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    // React Query Hook
    const {
        clients,
        isLoading: loading,
        fetchNextPage,
        hasNextPage,
        createClient: createClientMutation,
        updateClient: updateClientMutation,
        deleteClient: deleteClientMutation
    } = useClients(tenant?.id, {
        searchTerm,
        limit: 50
    });

    // Form Stats
    const [formData, setFormData] = useState<Partial<BusinessClient>>({
        name: '',
        email: '',
        phone: '',
        company: '',
        stage: 'lead',
        value: 0,
        notes: ''
    });

    const handleCreateClient = async () => {
        if (!formData.name) {
            toast.error('Name is required');
            return;
        }

        setIsSubmitting(true);
        try {
            await createClientMutation.mutateAsync(formData);
            toast.success('Client added successfully');
            setShowAddModal(false);
            setFormData({
                name: '',
                email: '',
                phone: '',
                company: '',
                stage: 'lead',
                value: 0,
                notes: ''
            });
        } catch (err) {
            toast.error('Failed to add client');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteClient = async (id: string) => {
        if (!confirm('Are you sure you want to delete this client?')) return;
        try {
            await deleteClientMutation.mutateAsync(id);
            toast.success('Client deleted');
            if (selectedClient?.id === id) {
                setSelectedClient(null);
            }
        } catch (err) {
            toast.error('Failed to delete client');
        }
    };

    // Virtualized List Row
    const ClientRow = ({ index, style, data }: any) => {
        const client = data.clients[index];
        if (!client) return null;

        const isSelected = selectedClient?.id === client.id;

        return (
            <div style={style} className="px-2 py-1">
                <div
                    onClick={() => setSelectedClient(client)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer group flex items-center justify-between ${isSelected
                        ? 'bg-teal-500/10 border-teal-500/50 shadow-lg shadow-teal-500/10'
                        : 'bg-slate-900/40 border-white/5 hover:border-white/10 hover:bg-slate-800/60'
                        }`}
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${isSelected ? 'bg-teal-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'}`}>
                            {client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>{client.name}</h3>
                            <p className="text-xs text-slate-500 flex items-center gap-2">
                                {client.company && <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> {client.company}</span>}
                                {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {client.email}</span>}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${client.stage === 'lead' ? 'bg-blue-500/10 text-blue-400' :
                            client.stage === 'prospect' ? 'bg-purple-500/10 text-purple-400' :
                                client.stage === 'customer' ? 'bg-green-500/10 text-green-400' :
                                    'bg-red-500/10 text-red-400'
                            }`}>
                            {client.stage}
                        </span>
                        <div className="text-right">
                            <div className="text-xs font-bold text-slate-300">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(client.value)}
                            </div>
                            <div className="text-[10px] text-slate-500">Value</div>
                        </div>
                        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                        <Briefcase className="w-8 h-8 text-violet-400" />
                        Client Relations
                        <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-mono font-normal">
                            {loading ? '...' : clients.length} Records
                        </span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Manage leads, prospects, and customer relationships</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search clients..."
                            value={searchTerm}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-slate-900 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-violet-500 transition-colors w-64"
                        />
                    </div>
                    {/* Import Button */}
                    <Button
                        onClick={() => setShowImportModal(true)}
                        variant="secondary"
                        icon={<Upload className="w-4 h-4" />}
                    >
                        Import
                    </Button>
                    <Button onClick={() => setShowAddModal(true)} icon={<Plus className="w-4 h-4" />} variant="primary">
                        Add Client
                    </Button>
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Client List */}
                <div className="lg:col-span-1 glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-white/5 bg-slate-900/50 flex justify-between items-center">
                        <h2 className="font-bold text-slate-200">Directory</h2>
                        <div className="flex gap-1">
                            <button className="p-1.5 hover:bg-white/5 rounded text-slate-400"><Filter className="w-3 h-3" /></button>
                            <button className="p-1.5 hover:bg-white/5 rounded text-slate-400"><ArrowRight className="w-3 h-3" /></button>
                        </div>
                    </div>

                    <div className="flex-1 relative">
                        {loading && clients.length === 0 ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                            </div>
                        ) : clients.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">No clients found</div>
                        ) : (
                            <AutoSizer>
                                {({ height, width }: { height: number; width: number }) => (
                                    <FixedSizeList
                                        height={height}
                                        width={width}
                                        itemCount={clients.length}
                                        itemSize={88} // Height of each row
                                        itemData={{ clients }}
                                        onScroll={({ scrollOffset, scrollUpdateWasRequested }: any) => {
                                            // Ideally calculate based on item size and count
                                            // Simplistic infinite scroll trigger
                                            if (!loading && hasNextPage) {
                                                // Trigger when closer to bottom. Hard to detect perfectly in FixedSizeList without ref checks
                                                // We can check if (scrollOffset + height) > (itemCount * itemSize - threshold)
                                                // For now, load on demand or stick to pagination if this is tricky.
                                                // Let's implement a simple button at bottom if needed, or rely on aggressive prefetching?
                                                // Actually let's just use a simple threshold check here:
                                                const totalHeight = clients.length * 88;
                                                if (scrollOffset + height > totalHeight - 200) {
                                                    fetchNextPage();
                                                }
                                            }
                                        }}
                                    >
                                        {ClientRow}
                                    </FixedSizeList>
                                )}
                            </AutoSizer>
                        )}
                    </div>
                </div>

                {/* Client Details */}
                <div className="lg:col-span-2 glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col relative">
                    {selectedClient ? (
                        <div className="h-full flex flex-col overflow-y-auto">
                            {/* Header Banner */}
                            <div className="h-32 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 relative">
                                <div className="absolute -bottom-10 left-8 flex items-end">
                                    <div className="w-20 h-20 rounded-2xl bg-slate-900 border-4 border-slate-950 flex items-center justify-center text-3xl font-bold text-white shadow-xl">
                                        {selectedClient.name.charAt(0)}
                                    </div>
                                </div>
                                <div className="absolute top-4 right-4 flex gap-2">
                                    <Button size="sm" variant="danger" onClick={() => handleDeleteClient(selectedClient.id)} icon={<Trash2 className="w-3 h-3" />}>Delete</Button>
                                    <Button size="sm" variant="secondary" icon={<Edit2 className="w-3 h-3" />}>Edit</Button>
                                </div>
                            </div>

                            <div className="mt-12 px-8 pb-8 space-y-8">
                                <div>
                                    <h1 className="text-2xl font-black text-white">{selectedClient.name}</h1>
                                    <p className="text-slate-400 flex items-center gap-2 mt-1">
                                        {selectedClient.company} <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                        {selectedClient.stage.toUpperCase()}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Lifetime Value</div>
                                        <div className="text-xl font-mono text-green-400">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedClient.value)}</div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Contact</div>
                                        <div className="text-sm text-slate-300 truncate">{selectedClient.email || 'N/A'}</div>
                                    </div>
                                    <div className="p-4 rounded-xl bg-slate-900/40 border border-white/5">
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Phone</div>
                                        <div className="text-sm text-slate-300">{selectedClient.phone || 'N/A'}</div>
                                    </div>
                                </div>

                                {/* Info Tabs Placeholder */}
                                <div className="border-t border-white/5 pt-6">
                                    <h3 className="font-bold text-white mb-4">Activity Timeline</h3>
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                                                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm text-slate-300">Client profile created</div>
                                                <div className="text-xs text-slate-500 mt-1">{new Date(selectedClient.createdAt).toLocaleString()}</div>
                                            </div>
                                        </div>
                                        {/* More timeline items would go here, fetched via activityService */}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <div className="w-16 h-16 rounded-full bg-slate-900/50 flex items-center justify-center mb-4 border border-white/5">
                                <Users className="w-8 h-8 text-slate-600" />
                            </div>
                            <p>Select a client to view details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Client Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="Add New Client"
            >
                <div className="space-y-4">
                    <Input
                        label="Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="John Doe"
                    />
                    <Input
                        label="Company"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Acme Corp"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="john@example.com"
                        />
                        <Input
                            label="Phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+1 (555) 000-0000"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Stage</label>
                            <select
                                value={formData.stage}
                                onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                                className="w-full px-4 py-2 bg-slate-900 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-violet-500"
                            >
                                <option value="lead">Lead</option>
                                <option value="prospect">Prospect</option>
                                <option value="customer">Customer</option>
                                <option value="lost">Lost</option>
                            </select>
                        </div>
                        <Input
                            label="Value ($)"
                            type="number"
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) })}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleCreateClient} disabled={isSubmitting}>
                            {isSubmitting ? 'Adding...' : 'Add Client'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Import Modal */}
            <ClientImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImportComplete={() => {
                    // Invalidate queries or refetch
                    // queryClient.invalidateQueries(['clients'])
                }}
            />
        </div>
    );
};

export default CRMTab;
