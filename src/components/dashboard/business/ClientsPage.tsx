import React, { useState, useEffect } from 'react';
import { User } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { businessClientService, BusinessClient } from '../../../services/businessClientService';
import { fileImportService } from '../../../services/fileImportService';
import {
    Users,
    Plus,
    Search,
    Upload,
    Mail,
    Phone,
    Building,
    X,
    FileText,
    Download,
    Edit,
    Trash2,
    MoreVertical,
    FilePlus,
    Calendar,
    History,
    MessageSquare,
    Receipt,
    ChevronLeft
} from 'lucide-react';
import { Button, Input, Modal, Badge, Dropdown, Card } from '../../ui/UIComponents';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../../../lib/supabase';
import { dailyService } from '../../../services/dailyService';
import { callSignalingService } from '../../../services/video/CallSignalingService';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import CRMTab from '../CRMTab';
import { LayoutGrid, List } from 'lucide-react';
import { CommunicationModal } from '../crm/CommunicationModal';

interface ClientsPageProps {
    user: User;
}

const ClientsPage: React.FC<ClientsPageProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const router = useRouter();
    const [clients, setClients] = useState<BusinessClient[]>([]);
    const [filteredClients, setFilteredClients] = useState<BusinessClient[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStage, setSelectedStage] = useState<string>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingClient, setEditingClient] = useState<BusinessClient | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
    const [showProposalModal, setShowProposalModal] = useState(false);
    const [selectedClientForProposal, setSelectedClientForProposal] = useState<BusinessClient | null>(null);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [selectedClientForInvoice, setSelectedClientForInvoice] = useState<BusinessClient | null>(null);
    const [showCommunicationModal, setShowCommunicationModal] = useState(false);
    const [selectedClientForCommunication, setSelectedClientForCommunication] = useState<BusinessClient | null>(null);
    const [selectedClient, setSelectedClient] = useState<BusinessClient | null>(null);

    const searchParams = useSearchParams();
    const stageParam = searchParams.get('stage');

    useEffect(() => {
        if (currentTenant) {
            loadClients();
        }
    }, [currentTenant]);

    useEffect(() => {
        if (stageParam) {
            setSelectedStage(stageParam);
        }
    }, [stageParam]);

    useEffect(() => {
        filterClients();
    }, [clients, searchTerm, selectedStage]);

    const loadClients = async () => {
        if (!currentTenant) return;

        setLoading(true);
        const { clients: data } = await businessClientService.getClients(currentTenant.id);
        setClients(data);
        setLoading(false);
    };

    const filterClients = () => {
        let filtered = clients;

        if (searchTerm) {
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.email?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (selectedStage !== 'all') {
            filtered = filtered.filter(c => c.salesStage === selectedStage);
        }

        setFilteredClients(filtered);
    };

    const handleAddClient = async (clientData: Partial<BusinessClient>) => {
        if (!currentTenant) return;

        const { client, error } = await businessClientService.createClient(currentTenant.id, clientData);
        if (!error && client) {
            setClients([client, ...clients]);
            setShowAddModal(false);
        }
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

    // ── One-click stage conversion (no modal) ────────────────────────────────
    const STAGE_PIPELINE: { id: string; label: string; next?: string }[] = [
        { id: 'lead',     label: 'Lead',     next: 'prospect' },
        { id: 'prospect', label: 'Prospect', next: 'customer' },
        { id: 'customer', label: 'Customer' },
        { id: 'lost',     label: 'Lost' },
    ];

    const handleStageConvert = async (client: BusinessClient, newStage: string) => {
        const prev = client.salesStage;
        // Optimistic update
        setClients(cs => cs.map(c => c.id === client.id ? { ...c, salesStage: newStage as any } : c));
        if (selectedClient?.id === client.id) setSelectedClient(s => s ? { ...s, salesStage: newStage as any } : s);
        const { error } = await businessClientService.updateClient(client.id, { salesStage: newStage as any });
        if (error) {
            // Rollback on error
            setClients(cs => cs.map(c => c.id === client.id ? { ...c, salesStage: prev as any } : c));
            if (selectedClient?.id === client.id) setSelectedClient(s => s ? { ...s, salesStage: prev as any } : s);
            toast.error('Stage update failed');
        } else {
            toast.success(`${client.name} → ${newStage.charAt(0).toUpperCase() + newStage.slice(1)}`);
        }
    };

    const handleDeleteClient = async (clientId: string) => {
        if (!confirm('Are you sure you want to delete this client?')) return;

        const { error } = await businessClientService.deleteClient(clientId);
        if (!error) {
            setClients(clients.filter(c => c.id !== clientId));
            toast.success('Client deleted successfully!');
        } else {
            toast.error('Failed to delete client');
        }
    };

    const handleImportClients = async (importedClients: Partial<BusinessClient>[]) => {
        if (!currentTenant) return;

        const { count, error } = await businessClientService.importClients(currentTenant.id, importedClients);
        if (!error) {
            await loadClients();
            setShowImportModal(false);
            alert(`Successfully imported ${count} clients!`);
        } else {
            alert(`Error importing clients: ${error}`);
        }
    };

    const handleCallClient = async (client: BusinessClient) => {
        if (!client.email) {
            toast.error('Client has no email address. Cannot initiate call.');
            return;
        }

        const toastId = toast.loading('Initiating secure call...');

        try {
            // 1. Find User ID by Email (to signal them)
            const { data: users, error: userError } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', client.email)
                .single();

            if (userError || !users) {
                console.warn('User lookup failed:', userError);
                toast.error('Client is not a registered user on the platform.', { id: toastId });
                return;
            }

            const recipientId = users.id;

            // 2. Create Video Room
            const { call, error: roomError } = await dailyService.createVideoCall({
                hostId: user.id,
                title: `Call with ${client.name}`,
                isPublic: false
            });

            if (roomError || !call || !call.daily_room_url) {
                // Throw the specific error message from the service, or a default
                throw new Error(roomError || 'Failed to create room: No URL returned');
            }

            // 3. Send Signal to Client
            await callSignalingService.sendCallSignal(recipientId, {
                callerId: user.id,
                callerName: user.name,
                roomUrl: call.daily_room_url,
                roomId: call.id
            });

            toast.success('Calling client...', { id: toastId });

            // 4. Redirect Admin to Room
            router.push(`/call/${call.id}`);

        } catch (error) {
            console.error('Call failed:', error);
            // Show the actual error message to the user
            toast.error(error instanceof Error ? error.message : 'Failed to start call.', { id: toastId, duration: 5000 });
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><div className="text-slate-400">Loading clients...</div></div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-white tracking-tight">Contacts</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="blue">{clients.length} total</Badge>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">CRM Database</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <Button
                        variant="outline"
                        onClick={() => setShowImportModal(true)}
                        icon={<Upload className="w-4 h-4" />}
                    >
                        Import
                    </Button>
                    <Button
                        onClick={() => setShowAddModal(true)}
                        icon={<Plus className="w-4 h-4" />}
                    >
                        Add
                    </Button>
                    {/* View mode toggle */}
                    <div className="flex bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-1">
                        <button
                            onClick={() => setViewMode('list')}
                            title="List view"
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('board')}
                            title="Grid view"
                            className={`p-2 rounded-lg transition-all ${viewMode === 'board' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-500 hover:text-white'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'board' ? (
                /* ── Compact Bio-Card Grid View ── */
                <div className="space-y-4">
                    {/* Search + Filter row */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search contacts..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 transition-all text-sm"
                            />
                        </div>
                        <select
                            value={selectedStage}
                            onChange={(e) => setSelectedStage(e.target.value)}
                            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 transition-all text-sm"
                        >
                            <option value="all">All Stages</option>
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                            <option value="lost">Lost</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {filteredClients.map(client => {
                            const initials = client.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                            const stageColor = client.salesStage === 'customer' ? 'from-emerald-500 to-teal-600'
                                : client.salesStage === 'lost' ? 'from-slate-600 to-slate-700'
                                : client.salesStage === 'prospect' ? 'from-blue-500 to-violet-600'
                                : 'from-teal-500 to-cyan-600';
                            return (
                                <div
                                    key={client.id}
                                    onClick={() => { setSelectedClient(client); setViewMode('list'); }}
                                    className="group relative bg-slate-900/80 border border-slate-800 hover:border-teal-500/40 rounded-2xl p-3 cursor-pointer transition-all hover:shadow-lg hover:shadow-teal-500/10 hover:-translate-y-0.5 flex flex-col items-center text-center gap-2"
                                >
                                    {/* Stage indicator dot */}
                                    <div className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-gradient-to-br ${stageColor} shadow-sm`} />
                                    {/* Avatar */}
                                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${stageColor} flex items-center justify-center font-bold text-white text-sm shadow-lg`}>
                                        {initials}
                                    </div>
                                    {/* Name + company */}
                                    <div className="w-full">
                                        <p className="font-semibold text-white text-xs truncate leading-snug">{client.name}</p>
                                        {client.company && <p className="text-[10px] text-slate-500 truncate">{client.company}</p>}
                                        {!client.company && client.industry && <p className="text-[10px] text-slate-500 truncate">{client.industry}</p>}
                                    </div>
                                    {/* Stage badge */}
                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                        client.salesStage === 'customer' ? 'bg-emerald-500/15 text-emerald-400'
                                        : client.salesStage === 'lost' ? 'bg-slate-700 text-slate-400'
                                        : client.salesStage === 'prospect' ? 'bg-blue-500/15 text-blue-400'
                                        : 'bg-teal-500/15 text-teal-400'
                                    }`}>
                                        {client.salesStage}
                                    </span>
                                    {/* Quick action icons */}
                                    <div className="flex gap-1 w-full justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        {client.email && (
                                            <a
                                                href={`mailto:${client.email}`}
                                                onClick={e => e.stopPropagation()}
                                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-teal-500/20 hover:text-teal-400 text-slate-400 transition-colors"
                                                title={client.email}
                                            >
                                                <Mail className="w-3 h-3" />
                                            </a>
                                        )}
                                        {client.phone && (
                                            <a
                                                href={`tel:${client.phone}`}
                                                onClick={e => e.stopPropagation()}
                                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-teal-500/20 hover:text-teal-400 text-slate-400 transition-colors"
                                                title={client.phone}
                                            >
                                                <Phone className="w-3 h-3" />
                                            </a>
                                        )}
                                        <button
                                            onClick={e => { e.stopPropagation(); setEditingClient(client); setShowEditModal(true); }}
                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors"
                                            title="Edit"
                                        >
                                            <Edit className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredClients.length === 0 && (
                            <div className="col-span-full text-center py-16 text-slate-500 text-sm">
                                No contacts found. Add your first contact to get started.
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-140px)] overflow-hidden">
                    <div className={`flex flex-col gap-4 h-full ${selectedClient ? 'hidden lg:flex w-full lg:w-1/3 lg:max-w-[350px]' : 'w-full'} overflow-hidden`}>
                        {/* Filters */}
                        <div className="flex flex-col gap-4 shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search clients..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 transition-all font-medium"
                                />
                            </div>
                            <select
                                value={selectedStage}
                                onChange={(e) => setSelectedStage(e.target.value)}
                                className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 transition-all font-medium"
                            >
                                <option value="all">All Stages</option>
                                <option value="lead">Leads</option>
                                <option value="prospect">Prospects</option>
                                <option value="customer">Customers</option>
                                <option value="lost">Lost</option>
                            </select>
                        </div>

                        {/* Client List */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {filteredClients.map(client => {
                                const nextStage = STAGE_PIPELINE.find(s => s.id === client.salesStage)?.next;
                                return (
                                <div
                                    key={client.id}
                                    onClick={() => setSelectedClient(client)}
                                    className={`group p-3 rounded-xl cursor-pointer transition-all border ${selectedClient?.id === client.id ? 'bg-teal-500/10 border-teal-500 shadow-sm shadow-teal-500/20' : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full shrink-0 bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold text-white text-sm">
                                            {client.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-semibold text-white text-sm truncate">{client.name}</h3>
                                            {client.industry && <p className="text-[11px] text-slate-400 truncate">{client.industry}</p>}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {/* One-click convert button — visible on hover */}
                                            {nextStage && (
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleStageConvert(client, nextStage); }}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-[10px] font-bold rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 hover:bg-teal-500/40 hover:text-white whitespace-nowrap"
                                                    title={`Convert to ${nextStage}`}
                                                >
                                                    → {nextStage.charAt(0).toUpperCase() + nextStage.slice(1)}
                                                </button>
                                            )}
                                            <Badge variant={client.salesStage === 'customer' ? 'success' : client.salesStage === 'lost' ? 'error' : 'blue'}>
                                                {client.salesStage.charAt(0).toUpperCase() + client.salesStage.slice(1)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Desktop Split Pane Right Side */}
                    <div className={`flex-1 ${!selectedClient ? 'hidden md:flex' : 'flex'} flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden`}>
                        {selectedClient ? (
                            <div className="flex flex-col h-full overflow-hidden">
                                {/* Mobile Header with Back Button */}
                                <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 shrink-0">
                                    <button 
                                        onClick={() => setSelectedClient(null)}
                                        className="flex items-center gap-2 text-teal-400 font-medium hover:text-teal-300 transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                        Back to List
                                    </button>
                                    <Badge variant={selectedClient.salesStage === 'customer' ? 'success' : selectedClient.salesStage === 'lost' ? 'error' : 'blue'}>
                                        {selectedClient.salesStage.charAt(0).toUpperCase() + selectedClient.salesStage.slice(1)}
                                    </Badge>
                                </div>

                                <div className="p-4 md:p-6 flex flex-col h-full overflow-y-auto custom-scrollbar ios-scroll">
                                    <div className="flex justify-between items-start mb-6 shrink-0">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-full shrink-0 bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold text-white text-2xl">
                                            {selectedClient.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-bold text-white">{selectedClient.name}</h2>
                                            {selectedClient.industry && <p className="text-slate-400">{selectedClient.industry}</p>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Dropdown
                                            trigger={
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="!p-2 hover:bg-slate-800"
                                                    icon={<MoreVertical className="w-5 h-5" />}
                                                />
                                            }
                                            items={[
                                                { label: 'Edit Client', icon: <Edit className="w-4 h-4"/>, onClick: () => { setEditingClient(selectedClient); setShowEditModal(true); } },
                                                { label: 'Delete Client', icon: <Trash2 className="w-4 h-4"/>, onClick: () => { handleDeleteClient(selectedClient.id); setSelectedClient(null); }, variant: 'danger' }
                                            ]}
                                        />
                                        <Button className="hidden" size="sm" variant="ghost" onClick={() => setSelectedClient(null)}>
                                            <X className="w-5 h-5"/>
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 shrink-0">
                                    <div className="bg-slate-800/50 p-3 rounded-xl">
                                        <p className="text-sm text-slate-400 mb-1">Email</p>
                                        <div className="flex items-center gap-2 text-white">
                                            <Mail className="w-4 h-4 text-teal-500 shrink-0" />
                                            <span className="truncate" title={selectedClient.email || 'N/A'}>{selectedClient.email || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-800/50 p-3 rounded-xl">
                                        <p className="text-sm text-slate-400 mb-1">Phone</p>
                                        <div className="flex items-center gap-2 text-white">
                                            <Phone className="w-4 h-4 text-teal-500 shrink-0" />
                                            <span className="truncate">{selectedClient.phone || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="bg-slate-800/50 p-3 rounded-xl">
                                        <p className="text-sm text-slate-400 mb-1">Sales Stage</p>
                                        <Badge variant={selectedClient.salesStage === 'customer' ? 'success' : selectedClient.salesStage === 'lost' ? 'error' : 'blue'}>
                                            {selectedClient.salesStage.charAt(0).toUpperCase() + selectedClient.salesStage.slice(1)}
                                        </Badge>
                                    </div>
                                    <div className="bg-slate-800/50 p-3 rounded-xl">
                                        <p className="text-sm text-slate-400 mb-1">Potential Value</p>
                                        <p className="font-semibold text-teal-400">${selectedClient.value.toLocaleString()}</p>
                                    </div>
                                </div>

                                {selectedClient.description && (
                                    <div className="mb-6 shrink-0">
                                        <h3 className="text-base font-semibold text-white mb-2">Description</h3>
                                        <div className="bg-slate-800/50 p-4 rounded-xl text-slate-300 whitespace-pre-wrap">
                                            {selectedClient.description}
                                        </div>
                                    </div>
                                )}

                                {/* ── Stage Pipeline — one-click convert ──── */}
                                <div className="mb-6 shrink-0">
                                    <h3 className="text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">Convert Stage</h3>
                                    <div className="flex items-center gap-0 rounded-xl overflow-hidden border border-slate-800">
                                        {STAGE_PIPELINE.map((stage, i) => {
                                            const isActive = selectedClient.salesStage === stage.id;
                                            const stageColors: Record<string, string> = {
                                                lead: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
                                                prospect: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                                                customer: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                                                lost: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
                                            };
                                            return (
                                                <button
                                                    key={stage.id}
                                                    onClick={() => !isActive && handleStageConvert(selectedClient, stage.id)}
                                                    className={`flex-1 py-2 text-xs font-bold transition-all border-r border-slate-800 last:border-r-0 ${
                                                        isActive
                                                            ? stageColors[stage.id]
                                                            : 'bg-slate-900 text-slate-500 hover:text-white hover:bg-slate-800'
                                                    }`}
                                                    disabled={isActive}
                                                    title={isActive ? 'Current stage' : `Convert to ${stage.label}`}
                                                >
                                                    {isActive ? '● ' : ''}{stage.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-[10px] text-slate-600 mt-1">Click any stage to convert instantly</p>
                                </div>

                                <div className="mt-auto">
                                    <h3 className="text-base font-semibold text-white mb-4">Quick Actions</h3>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="w-full h-10 gap-2"
                                            onClick={() => {
                                                setSelectedClientForProposal(selectedClient);
                                                setShowProposalModal(true);
                                            }}
                                            icon={<FilePlus className="w-4 h-4" />}
                                        >
                                            Proposal
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-10 gap-2 border-teal-500/30 text-teal-400 hover:bg-teal-500/10 hover:text-teal-300"
                                            onClick={() => {
                                                setSelectedClientForInvoice(selectedClient);
                                                setShowInvoiceModal(true);
                                            }}
                                            icon={<Receipt className="w-4 h-4" />}
                                        >
                                            Invoice
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-10 gap-2"
                                            onClick={() => handleCallClient(selectedClient)}
                                            icon={<Phone className="w-4 h-4" />}
                                        >
                                            Call
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full h-10 gap-2"
                                            onClick={() => {
                                                if (selectedClient.email) {
                                                    setSelectedClientForCommunication(selectedClient);
                                                    setShowCommunicationModal(true);
                                                } else {
                                                    toast.error('No email address on file.');
                                                }
                                            }}
                                            icon={<Mail className="w-4 h-4" />}
                                        >
                                            Email
                                        </Button>
                                    </div>
                                </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center bg-slate-800/10 text-slate-500">
                                <Users className="w-16 h-16 mb-4 text-slate-700" />
                                <p className="text-lg font-medium text-slate-400">Select a client to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Proposal Modal */}
            {showProposalModal && selectedClientForProposal && (
                <CreateProposalModal
                    client={selectedClientForProposal}
                    user={user}
                    onClose={() => {
                        setShowProposalModal(false);
                        setSelectedClientForProposal(null);
                    }}
                    onCreated={() => {
                        setShowProposalModal(false);
                        setSelectedClientForProposal(null);
                        toast.success('Proposal project created!');
                    }}
                />
            )}

            {/* Create Invoice Modal */}
            {showInvoiceModal && selectedClientForInvoice && (
                <CreateClientInvoiceModal
                    client={selectedClientForInvoice}
                    onClose={() => {
                        setShowInvoiceModal(false);
                        setSelectedClientForInvoice(null);
                    }}
                    onCreated={() => {
                        setShowInvoiceModal(false);
                        setSelectedClientForInvoice(null);
                        toast.success('Invoice created successfully!');
                    }}
                />
            )}

            {/* Communication Modal */}
            {showCommunicationModal && selectedClientForCommunication && (
                <CommunicationModal
                    client={selectedClientForCommunication}
                    user={user}
                    onClose={() => {
                        setShowCommunicationModal(false);
                        setSelectedClientForCommunication(null);
                    }}
                    onSent={() => {
                        setShowCommunicationModal(false);
                        setSelectedClientForCommunication(null);
                    }}
                />
            )}

            {filteredClients.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    No clients found. Add your first client to get started!
                </div>
            )}

            {/* Add Client Modal */}
            {showAddModal && (
                <AddClientModal
                    onClose={() => setShowAddModal(false)}
                    onAdd={handleAddClient}
                />
            )}

            {/* Edit Client Modal */}
            {showEditModal && editingClient && (
                <EditClientModal
                    client={editingClient}
                    onClose={() => {
                        setShowEditModal(false);
                        setEditingClient(null);
                    }}
                    onSave={(updates) => handleEditClient(editingClient.id, updates)}
                />
            )}

            {/* Import Modal */}
            {showImportModal && (
                <ImportClientsModal
                    onClose={() => setShowImportModal(false)}
                    onImport={handleImportClients}
                />
            )}
        </div>
    );
};

const ClientCard = ({ client, onEdit, onDelete, onCall, onCreateProposal, onCreateInvoice, onSendEmail }: { 
    client: BusinessClient; 
    onEdit: (c: BusinessClient) => void; 
    onDelete: (id: string) => void; 
    onCall: (c: BusinessClient) => void;
    onCreateProposal: (c: BusinessClient) => void;
    onCreateInvoice: (c: BusinessClient) => void;
    onSendEmail: (c: BusinessClient) => void;
}) => {
    const stageVariants = {
        lead: 'blue',
        prospect: 'warning',
        customer: 'success',
        lost: 'error'
    } as const;

    const dropdownItems = [
        {
            label: 'Create Proposal',
            icon: <FilePlus className="w-4 h-4" />,
            onClick: () => onCreateProposal(client)
        },
        {
            label: 'Create Invoice',
            icon: <Receipt className="w-4 h-4" />,
            onClick: () => onCreateInvoice(client)
        },
        {
            label: 'Send Email',
            icon: <Mail className="w-4 h-4" />,
            onClick: () => {
                if (client.email) {
                    onSendEmail(client);
                } else {
                    toast.error('No email address on file for this client.');
                }
            }
        },
        {
            label: 'Schedule Meeting',
            icon: <Calendar className="w-4 h-4" />,
            onClick: () => window.location.href = '/dashboard/calendar'
        },
        {
            label: 'View History',
            icon: <History className="w-4 h-4" />,
            onClick: () => window.location.href = '/dashboard/reports'
        },
        {
            label: 'Edit Client',
            icon: <Edit className="w-4 h-4" />,
            onClick: () => onEdit(client)
        },
        {
            label: 'Delete Client',
            icon: <Trash2 className="w-4 h-4" />,
            onClick: () => onDelete(client.id),
            variant: 'danger' as const
        }
    ];

    return (
        <Card hoverEffect className="flex flex-col h-full !p-3 relative z-10 hover:z-[60] focus-within:z-[60] transition-all">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1 min-w-0 mr-2">
                    <div className="w-10 h-10 rounded-full shrink-0 bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold text-white">
                        {client.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate" title={client.name}>{client.name}</h3>
                        {client.industry && <p className="text-xs text-slate-400 truncate">{client.industry}</p>}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCall(client)}
                        className="!p-2 hover:bg-teal-500/10 hover:text-teal-400"
                        icon={<Phone className="w-4 h-4" />}
                    />
                    <Dropdown
                        trigger={
                            <Button
                                size="sm"
                                variant="ghost"
                                className="!p-2 hover:bg-slate-700"
                                icon={<MoreVertical className="w-4 h-4" />}
                            />
                        }
                        items={dropdownItems}
                    />
                </div>
            </div>

            <div className="space-y-2 mb-4 flex-1">
                {client.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Mail className="w-4 h-4 shrink-0" />
                        <span className="truncate" title={client.email}>{client.email}</span>
                    </div>
                )}
                {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Phone className="w-4 h-4 shrink-0" />
                        <span className="truncate">{client.phone}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-800/50">
                <div className="flex items-center gap-2">
                    <Badge variant={stageVariants[client.salesStage as keyof typeof stageVariants] || 'neutral'}>
                        {client.salesStage.charAt(0).toUpperCase() + client.salesStage.slice(1)}
                    </Badge>
                    {client.value > 0 && (
                        <span className="text-sm font-semibold text-teal-400">
                            ${client.value.toLocaleString()}
                        </span>
                    )}
                </div>
            </div>
        </Card>
    );
};

const AddClientModal = ({ onClose, onAdd }: any) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        salesStage: 'lead' as any,
        value: 0,
        description: '',
        industry: '',
        location: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd(formData);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Register New Client Entity" maxWidth="max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Full Name"
                        required
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        icon={<Users className="w-5 h-5" />}
                    />
                    <Input
                        label="Email Address"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        icon={<Mail className="w-5 h-5" />}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Phone Number"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        icon={<Phone className="w-5 h-5" />}
                    />
                    <Input
                        label="Industry"
                        placeholder="e.g. Technology"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        icon={<Building className="w-5 h-5" />}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-300">Target Stage</label>
                        <select
                            value={formData.salesStage}
                            onChange={(e) => setFormData({ ...formData, salesStage: e.target.value as any })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all font-medium"
                        >
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                        </select>
                    </div>
                    <Input
                        label="Potential Value ($)"
                        type="number"
                        placeholder="0.00"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    />
                </div>

                <Input
                    label="Biographical Notes"
                    textarea
                    placeholder="Key client details..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <div className="flex gap-4 pt-4 border-t border-slate-800">
                    <Button variant="ghost" className="flex-1" onClick={onClose}>
                        Abort Registration
                    </Button>
                    <Button type="submit" className="flex-1">
                        Initialize Client Node
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

const EditClientModal = ({ client, onClose, onSave }: { client: BusinessClient; onClose: () => void; onSave: (updates: Partial<BusinessClient>) => void }) => {
    const [formData, setFormData] = useState({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        industry: client.industry || '',
        location: client.location || '',
        salesStage: client.salesStage,
        value: client.value,
        description: client.description || ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Edit Client Information" maxWidth="max-w-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Full Name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        icon={<Users className="w-5 h-5" />}
                    />
                    <Input
                        label="Email Address"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        icon={<Mail className="w-5 h-5" />}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Phone Number"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        icon={<Phone className="w-5 h-5" />}
                    />
                    <Input
                        label="Industry"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        icon={<Building className="w-5 h-5" />}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-300">Sales Stage</label>
                        <select
                            value={formData.salesStage}
                            onChange={(e) => setFormData({ ...formData, salesStage: e.target.value as any })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
                        >
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                            <option value="lost">Lost</option>
                        </select>
                    </div>
                    <Input
                        label="Potential Value ($)"
                        type="number"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    />
                </div>

                <Input
                    label="Description"
                    textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <div className="flex gap-4 pt-4 border-t border-slate-800">
                    <Button variant="outline" className="flex-1" onClick={onClose}>
                        Discard Changes
                    </Button>
                    <Button type="submit" className="flex-1">
                        Save Identity Updates
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

const ImportClientsModal = ({ onClose, onImport }: any) => {
    const [importedClients, setImportedClients] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: {
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'text/csv': ['.csv'],
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
        },
        onDrop: handleFileDrop
    });

    async function handleFileDrop(files: File[]) {
        if (files.length === 0) return;

        setImporting(true);
        const file = files[0];
        const fileType = file.name.split('.').pop()?.toLowerCase();

        try {
            let result;
            if (fileType === 'xlsx' || fileType === 'xls' || fileType === 'csv') {
                result = await fileImportService.importFromExcel(file);
            } else if (fileType === 'pdf') {
                result = await fileImportService.importFromPDF(file);
            } else if (fileType === 'doc' || fileType === 'docx') {
                result = await fileImportService.importFromWord(file);
            }

            if (result && !result.error) {
                setImportedClients(result.contacts);
            } else {
                alert(`Error importing file: ${result?.error}`);
            }
        } catch (error) {
            console.error('Import error:', error);
            alert('Error importing file');
        } finally {
            setImporting(false);
        }
    }

    const handleConfirmImport = () => {
        onImport(importedClients);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Import Clients</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {importedClients.length === 0 ? (
                    <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${isDragActive
                            ? 'border-teal-500 bg-teal-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                            }`}
                    >
                        <input {...getInputProps()} />
                        <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                        <p className="text-lg font-medium mb-2">
                            {isDragActive ? 'Drop file here' : 'Drag & drop file here'}
                        </p>
                        <p className="text-sm text-slate-400 mb-4">
                            or click to browse
                        </p>
                        <p className="text-xs text-slate-500">
                            Supports: Excel (.xlsx, .xls), CSV, PDF, Word (.doc, .docx)
                        </p>
                        {importing && <p className="mt-4 text-teal-400">Importing...</p>}
                    </div>
                ) : (
                    <div>
                        <p className="mb-4 text-slate-400">
                            Found {importedClients.length} contacts. Review and confirm import:
                        </p>
                        <div className="max-h-96 overflow-y-auto space-y-2 mb-6">
                            {importedClients.map((client, index) => (
                                <div key={index} className="bg-slate-800/50 p-3 rounded-lg">
                                    <p className="font-medium">{client.name || 'No name'}</p>
                                    <p className="text-sm text-slate-400">{client.email || 'No email'}</p>
                                    {client.phone && <p className="text-sm text-slate-400">{client.phone}</p>}
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setImportedClients([])}
                                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                            >
                                Import {importedClients.length} Clients
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const CreateProposalModal = ({ client, user, onClose, onCreated }: { client: BusinessClient; user: User; onClose: () => void; onCreated: () => void }) => {
    const [formData, setFormData] = useState({
        name: `Proposal for ${client.name}`,
        category: 'Consulting',
        description: `Project proposal for ${client.name}. Generated from Client Nexus.`,
        budget: client.value || 0
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const { projectService } = await import('../../../services/projectService');
            const { error } = await projectService.createProject({
                ownerId: user.id,
                ownerName: user.name,
                name: formData.name,
                category: formData.category,
                description: formData.description,
                status: 'Pending',
                currentStage: 'Proposal',
                progress: 0,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                team: [],
                image: '',
                contractStatus: 'None',
                clientId: client.id,
                budget: formData.budget,
                isPublic: false,
                showInPortfolio: false,
                resources: [],
                startDate: new Date().toISOString()
            } as any);

            if (error) {
                toast.error(`Failed to create proposal: ${error}`);
            } else {
                onCreated();
            }
        } catch (err) {
            toast.error('An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Initialize Project Proposal" maxWidth="max-w-xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl mb-4">
                    <p className="text-sm text-teal-200">
                        Initializing a formal proposal for <strong>{client.name}</strong>. This creates a pending project in your pipeline.
                    </p>
                </div>

                <Input
                    label="Project Title"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-slate-300">Project Category</label>
                        <select
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all"
                        >
                            <option value="Web">Web Development</option>
                            <option value="Mobile">Mobile App</option>
                            <option value="AI">AI / Automation</option>
                            <option value="Consulting">Strategic Consulting</option>
                            <option value="Design">UI/UX Design</option>
                        </select>
                    </div>
                    <Input
                        label="Projected Budget ($)"
                        type="number"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                    />
                </div>

                <Input
                    label="Scope & Objectives"
                    textarea
                    placeholder="Describe the high-level goals of this proposal..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <div className="flex gap-4 pt-4 border-t border-slate-800">
                    <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                        Generate Proposal
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

const CreateClientInvoiceModal = ({ client, onClose, onCreated }: { client: BusinessClient; onClose: () => void; onCreated: () => void }) => {
    const { currentTenant } = useTenant();
    const [formData, setFormData] = useState({
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        description: `Services for ${client.name}`,
        amount: client.value || 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant) {
            toast.error('No active tenant. Please refresh the page.');
            return;
        }
        setIsSubmitting(true);
        try {
            const { businessInvoiceService } = await import('../../../services/businessInvoiceService');
            const { error } = await businessInvoiceService.createInvoice(currentTenant.id, {
                invoiceNumber: formData.invoiceNumber,
                clientId: client.id,
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: formData.dueDate,
                lineItems: [
                    {
                        description: formData.description,
                        quantity: 1,
                        rate: formData.amount,
                        amount: formData.amount
                    }
                ],
                subtotal: formData.amount,
                taxRate: 0,
                tax: 0,
                discountAmount: 0,
                total: formData.amount,
                status: 'draft',
                notes: formData.notes,
                isPublic: false
            });

            if (error) {
                toast.error(`Failed to create invoice: ${error}`);
            } else {
                onCreated();
            }
        } catch (err) {
            toast.error('An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Create Invoice" maxWidth="max-w-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl">
                    <p className="text-sm text-teal-200">
                        Creating invoice for <strong>{client.name}</strong>
                        {client.email && <span className="text-teal-400"> · {client.email}</span>}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Invoice #"
                        required
                        value={formData.invoiceNumber}
                        onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    />
                    <Input
                        label="Due Date"
                        type="date"
                        required
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                </div>

                <Input
                    label="Description"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />

                <Input
                    label="Amount ($)"
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                />

                <Input
                    label="Notes (optional)"
                    textarea
                    placeholder="Payment terms, additional details..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />

                <div className="flex gap-4 pt-2 border-t border-slate-800">
                    <Button variant="ghost" className="flex-1" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" className="flex-1" isLoading={isSubmitting}>
                        Create Invoice
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

export default ClientsPage;
