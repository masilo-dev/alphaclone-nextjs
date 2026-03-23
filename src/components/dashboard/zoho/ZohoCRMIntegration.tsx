'use client';

import React, { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Database, Layout, ExternalLink } from 'lucide-react';

export default function ZohoCRMIntegration() {
    const [syncing, setSyncing] = useState(false);
    const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error', message?: string }>({ type: 'idle' });

    const handleSync = async (module?: string) => {
        setSyncing(true);
        setStatus({ type: 'idle' });
        try {
            const res = await fetch('/api/zoho/crm/sync', {
                method: 'POST',
                body: JSON.stringify({ module })
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ type: 'success', message: data.message });
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
        // You should pass the current user ID as state here
        window.location.href = '/api/auth/zoho/connect?region=US&state=CURRENT_USER_ID';
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
                <p>Last full sync: 2 hours ago</p>
                <div className="flex gap-4">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> System Online</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> OAuth Token Valid</span>
                </div>
            </div>
        </div>
    );
}
