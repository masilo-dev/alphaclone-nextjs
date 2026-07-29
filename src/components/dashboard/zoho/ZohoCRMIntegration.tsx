'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { RefreshCw, CheckCircle, AlertCircle, Database, Layout, ExternalLink } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';
import { showActionNextSteps } from '../../common/showActionNextSteps';

export default function ZohoCRMIntegration() {
    const router = useRouter();
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const [syncing, setSyncing] = useState(false);
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message?: string }>({ type: 'idle' });
    const [connectionLoading, setConnectionLoading] = useState(true);
    const [zohoStatus, setZohoStatus] = useState<{
        isConnected: boolean;
        mailReady?: boolean;
        baseConnected?: boolean;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;

        const loadZohoStatus = async () => {
            setConnectionLoading(true);
            try {
<<<<<<< HEAD
                if (!currentTenant?.id) return;
                const res = await fetch(`/api/auth/zoho/status?tenantId=${encodeURIComponent(currentTenant.id)}`, { credentials: 'include' });
=======
                const res = await fetch('/api/auth/zoho/status', { credentials: 'include' });
>>>>>>> origin/main
                const data = await res.json().catch(() => ({}));
                if (!cancelled) {
                    setZohoStatus({
                        isConnected: data?.isConnected === true,
                        mailReady: data?.mailReady === true,
                        baseConnected: data?.baseConnected === true,
                    });
                }
            } catch {
                if (!cancelled) setZohoStatus(null);
            } finally {
                if (!cancelled) setConnectionLoading(false);
            }
        };

        void loadZohoStatus();
        return () => {
            cancelled = true;
        };
<<<<<<< HEAD
    }, [currentTenant?.id]);
=======
    }, []);
>>>>>>> origin/main

    const handleSync = async (module?: string) => {
        if (!user || !currentTenant?.id) {
            setStatus({ type: 'error', message: 'User not authenticated' });
            return;
        }
        setSyncing(true);
        setStatus({ type: 'idle' });
        try {
            const res = await fetch('/api/zoho/crm/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
<<<<<<< HEAD
                body: JSON.stringify({ module, tenantId: currentTenant.id })
=======
                body: JSON.stringify({ module })
>>>>>>> origin/main
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: data.message });
                toast.success(data.message || 'Zoho sync completed');
                showActionNextSteps('zoho_sync_done', (path) => router.push(path));
            } else if (data?.reconnect) {
                setStatus({ type: 'error', message: data.error || 'Zoho needs to be reconnected.' });
                toast.error(data.error || 'Reconnect Zoho to continue');
            } else {
                setStatus({ type: 'error', message: data.error });
            }
        } catch (err) {
            setStatus({ type: 'error', message: 'Sync failed. Please check connection.' });
        } finally {
            setSyncing(false);
        }
    };

    const handleConnect = () => {
        // Redirect to settings where the robust region-aware connection is handled
        window.location.href = '/dashboard/settings?section=booking';
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Database className="text-orange-500" /> Zoho CRM Synchronization
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Keep your leads, contacts and deals synced automatically.</p>
                </div>
                <button 
                    onClick={handleConnect}
                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors border border-gray-700"
                >
                    <ExternalLink size={16} /> Reconnect Zoho
                </button>
            </div>

            <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold">Contacts & Leads</h3>
                                <p className="text-gray-400 text-xs">Syncs full names, emails, and company info.</p>
                            </div>
                            <Layout className="text-blue-500 opacity-50" />
                        </div>
                        <button 
                            disabled={syncing}
                            onClick={() => handleSync('Contacts')}
                            className="flex items-center justify-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 py-2 rounded-md transition-colors border border-blue-600/20"
                        >
                            {syncing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />} Sync Now
                        </button>
                    </div>

                    <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 flex flex-col gap-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold">Deals & Pipelines</h3>
                                <p className="text-gray-400 text-xs">Syncs deal names, values, and stages.</p>
                            </div>
                            <RefreshCw className="text-green-500 opacity-50" size={20} />
                        </div>
                        <button 
                            disabled={syncing}
                            onClick={() => handleSync('Deals')}
                            className="flex items-center justify-center gap-2 bg-green-600/10 hover:bg-green-600/20 text-green-400 py-2 rounded-md transition-colors border border-green-600/20"
                        >
                            {syncing ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />} Sync Now
                        </button>
                    </div>
                </div>

                {status.type !== 'idle' && (
                    <div className={`flex items-center gap-3 p-4 rounded-lg border ${
                        status.type === 'success' ? 'bg-green-600/10 border-green-600/20 text-green-400' : 'bg-red-600/10 border-red-600/20 text-red-400'
                    }`}>
                        {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <p className="text-sm font-medium">{status.message}</p>
                    </div>
                )}
            </div>

            <div className="px-6 py-4 bg-gray-800/30 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
                <p>
                    {connectionLoading
                        ? 'Checking Zoho connection...'
                        : zohoStatus?.baseConnected
                            ? 'Zoho CRM connection detected'
                            : 'Zoho is not connected yet'}
                </p>
                <div className="flex gap-4">
                    <span className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${zohoStatus?.baseConnected ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                        {zohoStatus?.baseConnected ? 'CRM Connected' : 'CRM Needs Attention'}
                    </span>
                    <span className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${zohoStatus?.mailReady ? 'bg-green-500' : 'bg-slate-500'}`}></span>
                        {zohoStatus?.mailReady ? 'Mail Ready' : 'Mail Not Ready'}
                    </span>
                </div>
            </div>
        </div>
    );
}
