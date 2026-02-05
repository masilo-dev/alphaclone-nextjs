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
    Trash2
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../../../lib/supabase';
import { dailyService } from '../../../services/dailyService';
import { callSignalingService } from '../../../services/video/CallSignalingService';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
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

    useEffect(() => {
        if (currentTenant) {
            loadClients();
        }
    }, [currentTenant]);

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
                c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.company?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (selectedStage !== 'all') {
            filtered = filtered.filter(c => c.stage === selectedStage);
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
                .from('users')
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
                    <h2 className="text-2xl font-bold">My Clients</h2>
                    <p className="text-slate-400 mt-1">{clients.length} total clients</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                    >
                        <Upload className="w-4 h-4" />
                        Import
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Client
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
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
                    className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 transition-all font-medium min-w-[140px]"
                >
                    <option value="all">All Stages</option>
                    <option value="lead">Leads</option>
                    <option value="prospect">Prospects</option>
                    <option value="customer">Customers</option>
                    <option value="lost">Lost</option>
                </select>
            </div>

            {/* Client List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClients.map(client => (
                    <ClientCard
                        key={client.id}
                        client={client}
                        onEdit={(client) => {
                            setEditingClient(client);
                            setShowEditModal(true);
                        }}
                        onDelete={handleDeleteClient}
                        onCall={handleCallClient}
                    />
                ))}
            </div>

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

const ClientCard = ({ client, onEdit, onDelete, onCall }: { client: BusinessClient; onEdit: (c: BusinessClient) => void; onDelete: (id: string) => void; onCall: (c: BusinessClient) => void }) => {
    const stageColors = {
        lead: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        prospect: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        customer: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        lost: 'bg-red-500/10 text-red-400 border-red-500/20'
    };

    return (
        <div className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 transition-all group relative shadow-sm">
            {/* Call Button (Mobile/Direct Action) */}
            <button
                onClick={() => onCall(client)}
                className="absolute top-4 right-12 p-2.5 hover:bg-teal-500/10 rounded-full transition-colors group/call active:scale-95"
                title="Video Call"
            >
                <Phone className="w-5 h-5 text-slate-400 group-hover/call:text-teal-400" />
            </button>

            {/* Proposal Button */}
            <button
                onClick={(e) => {
                    e.stopPropagation(); // Avoid triggering card click if any
                    // Navigate to Projects with pre-fill
                    window.location.href = `/dashboard/business/projects?create=true&clientId=${client.id}`;
                }}
                className="absolute top-4 right-24 text-xs bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-lg hover:border-teal-500 hover:text-teal-400 transition-colors"
            >
                Create Proposal
            </button>

            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold">
                        {client.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-semibold">{client.name}</h3>
                        {client.company && <p className="text-xs text-slate-400">{client.company}</p>}
                    </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                        onClick={() => onEdit(client)}
                        className="p-1 hover:bg-teal-500/10 rounded transition-all"
                        title="Edit Client"
                    >
                        <Edit className="w-4 h-4 text-teal-400" />
                    </button>
                    <button
                        onClick={() => onDelete(client.id)}
                        className="p-1 hover:bg-red-500/10 rounded transition-all"
                        title="Delete Client"
                    >
                        <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                </div>
            </div>

            <div className="space-y-2 mb-3">
                {client.email && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{client.email}</span>
                    </div>
                )}
                {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Phone className="w-4 h-4" />
                        <span>{client.phone}</span>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-1 rounded-full border ${stageColors[client.stage]}`}>
                    {client.stage.charAt(0).toUpperCase() + client.stage.slice(1)}
                </span>
                {client.value > 0 && (
                    <span className="text-sm font-semibold text-teal-400">
                        ${client.value.toLocaleString()}
                    </span>
                )}
            </div>
        </div>
    );
};

const AddClientModal = ({ onClose, onAdd }: any) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        stage: 'lead' as any,
        value: 0,
        notes: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Add New Client</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Phone</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Company</label>
                        <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Stage</label>
                        <select
                            value={formData.stage}
                            onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        >
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Potential Value ($)</label>
                        <input
                            type="number"
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                        >
                            Add Client
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditClientModal = ({ client, onClose, onSave }: { client: BusinessClient; onClose: () => void; onSave: (updates: Partial<BusinessClient>) => void }) => {
    const [formData, setFormData] = useState({
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        company: client.company || '',
        stage: client.stage,
        value: client.value,
        notes: client.notes || ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">Edit Client</h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Name *</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Phone</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Company</label>
                        <input
                            type="text"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Stage</label>
                        <select
                            value={formData.stage}
                            onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        >
                            <option value="lead">Lead</option>
                            <option value="prospect">Prospect</option>
                            <option value="customer">Customer</option>
                            <option value="lost">Lost</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Potential Value ($)</label>
                        <input
                            type="number"
                            value={formData.value}
                            onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:border-teal-500"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg transition-colors"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
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

export default ClientsPage;
