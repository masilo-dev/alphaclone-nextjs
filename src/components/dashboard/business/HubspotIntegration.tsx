'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    RefreshCw, 
    Settings, 
    CheckCircle2, 
    AlertCircle, 
    Trash2, 
    Database, 
    Link as LinkIcon,
    ArrowRight,
    Search,
    UserPlus,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/UIComponents';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface HubspotIntegrationProps {
    onClose?: () => void;
}

export default function HubspotIntegration({ onClose }: HubspotIntegrationProps) {
    const { user } = useAuth();
    const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
    const [isSyncing, setIsSyncing] = useState(false);
    const [integrationData, setIntegrationData] = useState<any>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState<'settings' | 'contacts'>('settings');
    const [contacts, setContacts] = useState<any[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);
    const [contactToDelete, setContactToDelete] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (user) {
            checkIntegrationStatus();
        }
    }, [user]);

    const checkIntegrationStatus = async () => {
        try {
            const { data, error } = await supabase
                .from('integrations')
                .select('*')
                .eq('user_id', user?.id)
                .eq('type', 'hubspot')
                .maybeSingle();

            if (data) {
                setIntegrationData(data);
                setStatus('connected');
            } else {
                setStatus('idle');
            }
        } catch (err) {
            console.error('Error checking HubSpot status:', err);
            setStatus('error');
        }
    };

    const handleConnect = () => {
        if (!user) return;
        // Redirect to our connect API
        window.location.href = `/api/auth/hubspot/connect?userId=${user.id}`;
    };

    const fetchContacts = async () => {
        if (!user) return;
        setIsLoadingContacts(true);
        try {
            const response = await fetch(`/api/hubspot/sync?userId=${user.id}`);
            // Note: In a real app, this would be a GET route for contacts. 
            // For now, we'll use a mocked list or implement the GET in sync route.
            // Since I haven't implemented GET in sync route, I'll mock some data for the premium feel
            // but in a real scenario, this would call a contacts endpoint.
            
            // Simulating API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            setContacts([
                { id: '101', properties: { firstname: 'John', lastname: 'Doe', email: 'john@example.com', company: 'Tech Corp' } },
                { id: '102', properties: { firstname: 'Jane', lastname: 'Smith', email: 'jane@startup.io', company: 'Green Energy' } },
                { id: '103', properties: { firstname: 'Robert', lastname: 'Brown', email: 'robert@global.com', company: 'Build-IT' } },
            ]);
        } catch (err) {
            console.error('Error fetching HubSpot contacts:', err);
        } finally {
            setIsLoadingContacts(false);
        }
    };

    useEffect(() => {
        if (status === 'connected' && activeTab === 'contacts') {
            fetchContacts();
        }
    }, [status, activeTab]);

    const handleSync = async () => {
        setIsSyncing(true);
        // Simulate sync for now
        setTimeout(() => {
            setIsSyncing(false);
            // In real implementation, call /api/hubspot/sync
        }, 2000);
    };

    const handleDeleteIntegration = async () => {
        try {
            const { error } = await supabase
                .from('integrations')
                .delete()
                .eq('user_id', user?.id)
                .eq('type', 'hubspot');

            if (error) throw error;
            
            setStatus('idle');
            setIntegrationData(null);
            setShowDeleteConfirm(false);
        } catch (err) {
            console.error('Error deleting HubSpot integration:', err);
        }
    };

    const handleDeleteContact = async (id: string) => {
        if (!user) return;
        setIsDeleting(true);
        try {
            const response = await fetch(`/api/hubspot/delete?userId=${user.id}&contactId=${id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                setContacts(prev => prev.filter(c => c.id !== id));
                setContactToDelete(null);
                // toast.success('Contact deleted from HubSpot'); // Need toast
            } else {
                throw new Error('Failed to delete');
            }
        } catch (err) {
            console.error('Error deleting HubSpot contact:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="relative">
            <div className="glass-card rounded-2xl border border-white/10 overflow-hidden opacity-75 grayscale-[0.5]">
                <div className="p-5 border-b border-white/5 bg-gradient-to-r from-orange-500/10 to-transparent">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                                <img src="https://www.hubspot.com/hubfs/assets/hubspot.com/style-guide/brand-guidelines/guidelines_logos_sprocket_color.svg" alt="HubSpot" className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white tracking-tight">HubSpot CRM</h2>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px] font-black uppercase tracking-widest">
                                        Coming Soon
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <p className="text-slate-400 text-xs leading-relaxed max-w-md">
                        Advanced HubSpot integration is currently under development. Soon you'll be able to sync contacts, track deal stages, and automate your sales workflow directly from AlphaClone.
                    </p>
                    <div className="mt-4 flex gap-2">
                        <div className="h-1.5 w-1/3 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full w-3/4 bg-orange-500 animate-pulse" />
                        </div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Development in progress</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
