'use client';
// @ts-nocheck

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import {
    Briefcase,
    Search,
    Plus,
    Filter,
    MoreVertical,
    Phone,
    Mail,
    Calendar,
    DollarSign,
    Users,
    TrendingUp,
    FileText,
    Loader2,
    X,
    Trash2,
    Edit2,
    Upload,
    CheckCircle2,
    MessageCircle,
    Download
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
    () => import('react-virtualized-auto-sizer').then((mod: any) => mod.AutoSizer),
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
import { LeadImportModal } from './crm/LeadImportModal';
import { useQueryClient } from '@tanstack/react-query';
import ProjectModal from './projects/ProjectModal';
import { exportToCSV } from '../../utils/exportUtils';

interface CRMTabProps {
    userId: string;
    userRole: string;
}

const CRMTab: React.FC<CRMTabProps> = ({ userId, userRole }) => {
    const { currentTenant: tenant } = useTenant();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<BusinessClient | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showLeadImportModal, setShowLeadImportModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const queryClient = useQueryClient();

    // React Query Hook
    const {
        clients,
        isLoading: loading,
        createClient: createClientMutation,
        updateClient: updateClientMutation,
        deleteClient: deleteClientMutation
    } = useClients(tenant?.id, {
        searchTerm,
        limit: 50
    });

    const [formData, setFormData] = useState<Partial<BusinessClient>>({
        name: '',
        email: '',
        phone: '',
        salesStage: 'lead',
        value: undefined,
        description: '',
        industry: '',
        location: ''
    });

    const handleEditClient = (client: BusinessClient) => {
        setFormData({
            name: client.name,
            email: client.email || '',
            phone: client.phone || '',
            salesStage: client.salesStage,
            value: client.value,
            description: client.description || '',
            industry: client.industry || '',
            location: client.location || ''
        });
        setShowEditModal(true);
    };

    const handleUpdateClient = async () => {
        if (!formData.name || !selectedClient) {
            toast.error('Name is required');
            return;
        }

        setIsSubmitting(true);
        try {
            await updateClientMutation.mutateAsync({ clientId: selectedClient.id, updates: formData });
            toast.success('Client updated successfully');
            setShowEditModal(false);
            setSelectedClient({ ...selectedClient, ...formData });
            setFormData({
                name: '',
                email: '',
                phone: '',
                salesStage: 'lead',
                value: 0,
                description: '',
                industry: '',
                location: ''
            });
        } catch (err) {
            toast.error('Failed to update client');
        } finally {
            setIsSubmitting(false);
        }
    };

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
                salesStage: 'lead',
                value: 0,
                description: '',
                industry: '',
                location: ''
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



    return (
        <>
            <div className="h-full flex flex-col p-8 overflow-y-auto custom-scrollbar space-y-8 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.05),transparent_40%)]">
                {/* Elite Client Relations Header */}
                <div className={`flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-8 border-b border-white/5 relative ${selectedClient ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="flex-1 relative z-10">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-4 mb-3"
                        >
                            <div className="p-3 bg-teal-500 rounded-2xl shadow-2xl shadow-teal-500/40 rotate-3">
                                <Briefcase className="w-8 h-8 text-slate-900" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">
                                    Client Relations
                                </h1>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                                    <p className="text-[10px] font-mono text-teal-500/60 uppercase tracking-[0.3em]">
                                        {loading ? 'SYNCING DATABASE...' : `${clients.length} Active Records`}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 relative z-10">
                        <div className="relative group">
                            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-teal-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="SEARCH INTELLIGENCE..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full lg:w-72 bg-black/40 border border-white/5 rounded-2xl pl-12 pr-6 py-3 text-[10px] font-mono tracking-widest text-white focus:border-teal-500/40 outline-none transition-all placeholder:text-slate-700 shadow-inner"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowLeadImportModal(true)}
                                className="p-3 bg-slate-900/50 border border-white/5 rounded-2xl text-slate-400 hover:text-teal-400 transition-all hover:bg-teal-500/5"
                                title="Import Leads"
                            >
                                <Users className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setShowImportModal(true)}
                                className="p-3 bg-slate-900/50 border border-white/5 rounded-2xl text-slate-400 hover:text-teal-400 transition-all hover:bg-teal-500/5"
                                title="Import CSV"
                            >
                                <Upload className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => exportToCSV(clients, 'CRM_Clients')}
                                className="p-3 bg-slate-900/50 border border-white/5 rounded-2xl text-slate-400 hover:text-teal-400 transition-all hover:bg-teal-500/5"
                                title="Export Data"
                            >
                                <Download className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02, translateY: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowAddModal(true)}
                                className="bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-2xl h-12 px-8 shadow-[0_10px_30px_rgba(20,184,166,0.3)] transition-all flex items-center gap-3 group ml-2"
                            >
                                <Plus className="w-4 h-4 font-bold group-hover:rotate-90 transition-transform duration-500" />
                                <span className="font-black text-[10px] uppercase tracking-[0.2em]">New Relation</span>
                            </motion.button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Client Intelligence Directory */}
                    <div className={`lg:col-span-1 glass-panel rounded-[2rem] border border-white/5 overflow-hidden flex flex-col bg-slate-900/20 backdrop-blur-2xl shadow-2xl ${selectedClient ? 'hidden lg:flex' : 'flex'}`} style={{ minHeight: '500px' }}>
                        <div className="p-6 border-b border-white/5 bg-slate-950/20 flex justify-between items-center">
                            <h2 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                                <Users className="w-3 h-3 text-teal-500" />
                                Intelligence Directory
                            </h2>
                            <div className="flex gap-2">
                                <button className="p-2 hover:bg-white/5 rounded-xl text-slate-500 transition-colors">
                                    <Filter className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 relative min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-3">
                            {loading && clients.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-20 gap-4">
                                    <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                                    <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest animate-pulse">Scanning Records...</p>
                                </div>
                            ) : clients.length === 0 ? (
                                <div className="p-20 text-center">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                        <Users className="w-8 h-8 text-slate-800" />
                                    </div>
                                    <p className="text-sm font-black text-slate-600 uppercase tracking-widest">No Intelligence Found</p>
                                    <p className="text-[10px] font-mono text-slate-700 mt-2 uppercase">Database Query Returned Null</p>
                                </div>
                            ) : (
                                <AnimatePresence mode="popLayout">
                                    {clients.map((client, idx) => (
                                        <motion.div
                                            key={client.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.03, ease: [0.23, 1, 0.32, 1] }}
                                            className="px-1"
                                        >
                                            <motion.div
                                                whileHover={{ scale: 1.02, x: 4 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => typeof setSelectedClient === 'function' && setSelectedClient(client)}
                                                className={`p-4 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between relative overflow-hidden ${selectedClient?.id === client.id
                                                    ? 'bg-teal-500/10 border-teal-500/30 shadow-[0_0_30px_rgba(20,184,166,0.1)]'
                                                    : 'bg-slate-900/40 border-white/5 hover:border-white/10 hover:bg-slate-800/40 shadow-lg'
                                                    }`}
                                            >
                                                {selectedClient?.id === client.id && (
                                                    <motion.div
                                                        layoutId="active-client-glow"
                                                        className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-transparent pointer-events-none"
                                                    />
                                                )}

                                                <div className="flex items-center gap-4 overflow-hidden relative z-10">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black flex-shrink-0 transition-all duration-500 ${selectedClient?.id === client.id ? 'bg-teal-500 text-slate-950 scale-110 rotate-3' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                                                        }`}>
                                                        {client.name.charAt(0)}
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <div className="font-black text-sm text-slate-200 group-hover:text-white transition-colors truncate tracking-tight uppercase">
                                                            {client.name}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <div className="w-1 h-1 rounded-full bg-teal-500/40" />
                                                            <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest truncate">
                                                                {client.industry || 'Classified'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-shrink-0 ml-4 relative z-10">
                                                    <div className={`text-[9px] px-2.5 py-1 rounded-lg font-black uppercase tracking-[0.1em] border ${client.salesStage === 'customer' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                        client.salesStage === 'prospect' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                                                            'bg-slate-800/50 text-slate-500 border-white/5'
                                                        }`}>
                                                        {client.salesStage}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>

                    {/* Client Intelligence Dossier */}
                    <div className={`lg:col-span-2 glass-panel rounded-[2rem] border border-white/5 overflow-hidden flex flex-col relative bg-slate-900/40 backdrop-blur-2xl shadow-2xl ${!selectedClient ? 'hidden lg:flex' : 'flex focus-in'}`}>
                        <AnimatePresence mode="wait">
                            {selectedClient ? (
                                <motion.div
                                    key={selectedClient.id}
                                    initial={{ opacity: 0, scale: 0.98, filter: 'blur(20px)' }}
                                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, scale: 0.98, filter: 'blur(20px)' }}
                                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                                    className="h-full flex flex-col overflow-y-auto custom-scrollbar"
                                >
                                    {/* Command Banner */}
                                    <div className="h-44 md:h-64 bg-[url('https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center relative">
                                        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/40 to-slate-950" />

                                        {/* Mobile Escape */}
                                        <button
                                            onClick={() => typeof setSelectedClient === 'function' && setSelectedClient(null)}
                                            className="lg:hidden absolute top-6 left-6 p-3 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl text-white hover:bg-white/10 transition-all z-10"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>

                                        <div className="absolute -bottom-14 left-10 md:left-14 flex items-end gap-10">
                                            <motion.div
                                                layoutId={`avatar-${selectedClient.id}`}
                                                className="w-28 h-28 md:w-36 md:h-36 rounded-[2.5rem] bg-slate-900 border-4 border-slate-950 flex items-center justify-center text-5xl md:text-6xl font-black text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group"
                                            >
                                                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-transparent group-hover:opacity-100 transition-opacity" />
                                                <span className="relative z-10 drop-shadow-2xl">{selectedClient.name.charAt(0)}</span>
                                            </motion.div>

                                            <div className="mb-6 pb-2">
                                                <motion.h1
                                                    initial={{ opacity: 0, y: 15 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.2 }}
                                                    className="text-3xl md:text-5xl font-black text-white tracking-tighter uppercase leading-[0.8]"
                                                >
                                                    {selectedClient.name}
                                                </motion.h1>
                                                <div className="flex items-center gap-4 mt-4">
                                                    <span className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] border ${selectedClient.salesStage === 'customer' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-teal-500/10 text-teal-400 border-teal-500/30'
                                                        }`}>
                                                        {selectedClient.salesStage} Protocol
                                                    </span>
                                                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                                                        <Briefcase className="w-3.5 h-3.5 text-teal-500" />
                                                        {selectedClient.industry || 'Classified Information'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="absolute top-8 right-8 flex gap-3">
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleEditClient(selectedClient)}
                                                className="p-3.5 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[1.25rem] text-slate-400 hover:text-white transition-all shadow-2xl"
                                                title="Modify Record"
                                            >
                                                <Edit2 className="w-6 h-6" />
                                            </motion.button>
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleDeleteClient(selectedClient.id)}
                                                className="p-3.5 bg-red-500/5 backdrop-blur-2xl border border-red-500/20 rounded-[1.25rem] text-red-500 hover:text-red-400 transition-all shadow-2xl"
                                                title="Purge Record"
                                            >
                                                <Trash2 className="w-6 h-6" />
                                            </motion.button>
                                            <motion.button
                                                whileHover={{ scale: 1.02, translateY: -2 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setShowProjectModal(true)}
                                                className="bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-[1.5rem] h-14 px-10 shadow-[0_20px_40px_rgba(20,184,166,0.25)] transition-all flex items-center gap-4 font-black text-[11px] uppercase tracking-[0.25em] ml-3"
                                            >
                                                <Plus className="w-5 h-5 font-bold" />
                                                Launch Project
                                            </motion.button>
                                        </div>
                                    </div>

                                    <div className="mt-24 px-12 md:px-16 pb-16 space-y-16">
                                        {/* Strategic Intelligence Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            {[
                                                { label: 'Intelligence Value', value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedClient.value || 0), icon: <DollarSign className="w-5 h-5" />, color: 'text-emerald-400', desc: 'Accumulated Revenue' },
                                                { label: 'Comm Channel', value: selectedClient.email || 'N/A', icon: <Mail className="w-5 h-5" />, color: 'text-teal-400', isLink: true, href: `mailto:${selectedClient.email}`, desc: 'Primary Signal' },
                                                { label: 'Signal Range', value: selectedClient.phone || 'N/A', icon: <Phone className="w-5 h-5" />, color: 'text-blue-400', isLink: true, href: `tel:${selectedClient.phone}`, desc: 'Tactical Voice' }
                                            ].map((node, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, y: 30 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.3 + (i * 0.1) }}
                                                    className="p-8 rounded-[2.5rem] bg-slate-950/40 border border-white/5 hover:border-teal-500/20 transition-all group/node relative overflow-hidden shadow-2xl"
                                                >
                                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.05),transparent_50%)]" />
                                                    <div className="text-[10px] text-slate-600 uppercase font-black tracking-[0.25em] mb-4 flex items-center gap-3 relative z-10">
                                                        <div className="p-2 bg-slate-900 rounded-xl text-teal-500 border border-white/5 shadow-inner">
                                                            {node.icon}
                                                        </div>
                                                        {node.label}
                                                    </div>
                                                    {node.isLink && node.value !== 'N/A' ? (
                                                        <a href={node.href} className={`text-sm font-black ${node.color} hover:underline truncate block relative z-10 tracking-tight transition-all`}>
                                                            {node.value}
                                                        </a>
                                                    ) : (
                                                        <div className={`text-2xl font-mono ${node.color} relative z-10 tracking-tighter font-black`}>
                                                            {node.value}
                                                        </div>
                                                    )}
                                                    <div className="mt-2 text-[9px] font-mono text-slate-700 uppercase tracking-widest relative z-10">
                                                        {node.desc}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>

                                        {/* Narrative Log */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.6 }}
                                            className="p-10 rounded-[3.5rem] bg-slate-950/30 border border-white/5 relative overflow-hidden shadow-inner group/log"
                                        >
                                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-500/20 to-transparent" />
                                            <div className="text-[12px] text-slate-500 uppercase font-black tracking-[0.4em] mb-8 flex items-center gap-4">
                                                <FileText className="w-5 h-5 text-teal-500/50 group-hover/log:scale-110 transition-transform" />
                                                Strategic Intelligence Narrative
                                            </div>
                                            <p className="text-slate-400 text-lg leading-[1.8] font-medium italic indent-8">
                                                {selectedClient.description || 'No detailed intelligence logs recorded for this entity. All operations conducted under standard protocol. Subject monitoring remains active for potential tactical updates.'}
                                            </p>
                                            {/* Deployment Zones / Activity */}
                                            <motion.div
                                                initial={{ opacity: 0, y: 30 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.7 }}
                                                className="space-y-8"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-[12px] text-slate-500 uppercase font-black tracking-[0.4em] flex items-center gap-4">
                                                        <TrendingUp className="w-5 h-5 text-teal-500/50" />
                                                        Tactical Event Log
                                                    </h3>
                                                    <div className="h-px flex-1 bg-gradient-to-r from-teal-500/20 to-transparent ml-6" />
                                                </div>

                                                <div className="space-y-4">
                                                    {[
                                                        { title: 'Intelligence Node Established', date: selectedClient.createdAt, icon: <CheckCircle2 className="w-4 h-4" />, status: 'Completed' },
                                                        { title: 'Last Communication Signal', date: new Date().toISOString(), icon: <MessageCircle className="w-4 h-4" />, status: 'Transmitted' }
                                                    ].map((event, i) => (
                                                        <div key={i} className="flex gap-6 group/event">
                                                            <div className="flex flex-col items-center">
                                                                <div className="w-10 h-10 rounded-2xl bg-slate-900 border border-white/5 flex items-center justify-center text-teal-500 shadow-xl group-hover/event:border-teal-500/30 transition-colors">
                                                                    {event.icon}
                                                                </div>
                                                                {i === 0 && <div className="w-px h-full bg-slate-800 my-2" />}
                                                            </div>
                                                            <div className="pt-1 pb-4">
                                                                <div className="text-sm font-black text-white uppercase tracking-wider">{event.title}</div>
                                                                <div className="flex items-center gap-3 mt-2">
                                                                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{new Date(event.date).toLocaleString()}</span>
                                                                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                                    <span className="text-[9px] font-black text-teal-500/70 uppercase tracking-widest">{event.status}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        </motion.div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center"
                                >
                                    <div className="bg-slate-900/50 p-12 rounded-[3rem] border border-white/5">
                                        <div className="w-20 h-20 bg-teal-500/10 rounded-3xl flex items-center justify-center border border-teal-500/20 mb-6 mx-auto">
                                            <Users className="w-10 h-10 text-teal-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Select a Client</h3>
                                        <p className="max-w-xs text-sm text-slate-500 leading-relaxed">
                                            View complete relationship history, linked projects, and intelligence notes.
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Add Client Modal */}
            < Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="Add New Client"
            >
                <div className="space-y-4">
                    <Input
                        label="Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Business or Contact Name"
                    />
                    <Input
                        label="Industry"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        placeholder="e.g. Technology"
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
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Sales Stage</label>
                            <select
                                value={formData.salesStage}
                                onChange={(e) => setFormData({ ...formData, salesStage: e.target.value as any })}
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
                            placeholder="0.00"
                            value={formData.value === undefined ? '' : formData.value}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                        />
                    </div>
                    <Input
                        label="Description/Notes"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Additional details..."
                        textarea
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleCreateClient} disabled={isSubmitting}>
                            {isSubmitting ? 'Adding...' : 'Add Client'}
                        </Button>
                    </div>
                </div>
            </Modal >

            {/* Edit Client Modal */}
            < Modal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                title="Edit Client"
            >
                <div className="space-y-4">
                    <Input
                        label="Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Business or Contact Name"
                    />
                    <Input
                        label="Industry"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        placeholder="e.g. Technology"
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
                            <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Sales Stage</label>
                            <select
                                value={formData.salesStage}
                                onChange={(e) => setFormData({ ...formData, salesStage: e.target.value as any })}
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
                            placeholder="0.00"
                            value={formData.value === undefined ? '' : formData.value}
                            onChange={(e) => setFormData({ ...formData, value: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                        />
                    </div>
                    <Input
                        label="Description/Notes"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Additional details..."
                        textarea
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleUpdateClient} disabled={isSubmitting}>
                            {isSubmitting ? 'Updating...' : 'Update Client'}
                        </Button>
                    </div>
                </div>
            </Modal >

            {/* Import Modal */}
            < ClientImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImportComplete={() => {
                    // Invalidate queries or refetch
                    // queryClient.invalidateQueries(['clients'])
                }}
            />
            {/* Lead Import Modal */}
            <LeadImportModal
                isOpen={showLeadImportModal}
                onClose={() => setShowLeadImportModal(false)}
                onImportComplete={() => {
                    queryClient.invalidateQueries({ queryKey: ['clients'] });
                }}
            />

            {/* Launch Project Modal */}
            <ProjectModal
                isOpen={showProjectModal}
                onClose={() => setShowProjectModal(false)}
                clientId={selectedClient?.id || null}
                ownerId={userId}
                ownerName={selectedClient?.name || 'Client'} // Using client name as reference
                onSuccess={(project) => {
                    toast.success(`Project ${project.name} initialized!`);
                    // We could redirect to projects tab here or just close
                }}
            />
        </>
    );
};

export default CRMTab;
