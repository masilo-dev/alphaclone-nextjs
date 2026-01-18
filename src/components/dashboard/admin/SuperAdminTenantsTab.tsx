import React, { useState } from 'react';
import {
    Building2,
    Search,
    MoreVertical,
    CheckCircle,
    XCircle,
    ShieldAlert,
    Eye,
    LogIn
} from 'lucide-react';

const SuperAdminTenantsTab: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [ghostLoading, setGhostLoading] = useState(false);

    // The Single "Ghost Account" requested by user
    const [demoTenant, setDemoTenant] = useState({
        id: 'ghost-001',
        name: 'Ghost Industries (Demo)',
        plan: 'Enterprise',
        status: 'active',
        mrr: 24000,
        trustScore: 98,
        verification: 'verified'
    });

    const handleGhostLogin = async () => {
        if (confirm(`Enter 'Ghost Mode' for ${demoTenant.name}? This will simulate their view.`)) {
            setGhostLoading(true);

            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 800));

            // Trick: Save a flag and reload to force App.tsx to pick up the "Ghost Role"
            // In a real app, this would be a secure token exchange.
            const ghostUser = {
                id: 'ghost-admin-id',
                email: 'admin@ghost.demo',
                name: 'Ghost Admin',
                role: 'tenant_admin',
                tenantId: demoTenant.id,
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ghost'
            };

            localStorage.setItem('alphaclone_ghost_user', JSON.stringify(ghostUser));
            window.location.reload();
        }
    };

    const handleVerify = () => {
        alert("This tenant is already verified (Ghost Account). In production, this would approve the pending request.");
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
            default: return 'bg-slate-800 text-slate-400 border-slate-700';
        }
    };

    return (
        <div className="space-y-6 p-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-teal-400" />
                        Platform Command Center
                    </h2>
                    <p className="text-slate-400">Total control over the AlphaClone ecosystem.</p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Tenants" value="1" trend="Ghost Mode" />
                <StatCard label="Total MRR" value="$24.0k" trend="+$0.0k" color="text-green-400" />
                <StatCard label="Pending Verification" value="0" trend="All Clear" color="text-teal-400" />
                <StatCard label="Avg Trust Score" value="98%" trend="High" color="text-blue-400" />
            </div>

            {/* Tenants Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-sm">
                            <th className="p-4 font-medium">Business Name</th>
                            <th className="p-4 font-medium">Plan</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium">MRR</th>
                            <th className="p-4 font-medium">Trust Score</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors group">
                            <td className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-xs text-white border border-violet-500 shadow-lg shadow-violet-500/20">
                                        GI
                                    </div>
                                    <div>
                                        <div className="font-medium text-white">{demoTenant.name}</div>
                                        <div className="text-xs text-slate-500">ID: {demoTenant.id}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4">
                                <span className="text-slate-300 text-sm">{demoTenant.plan}</span>
                            </td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(demoTenant.status)} uppercase tracking-wide`}>
                                    {demoTenant.status}
                                </span>
                            </td>
                            <td className="p-4 font-mono text-slate-300">
                                ${demoTenant.mrr.toLocaleString()}
                            </td>
                            <td className="p-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-green-500" style={{ width: `${demoTenant.trustScore}%` }} />
                                    </div>
                                    <span className="text-xs text-slate-400">{demoTenant.trustScore}%</span>
                                </div>
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <button
                                        onClick={handleGhostLogin}
                                        disabled={ghostLoading}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-violet-600 text-slate-300 hover:text-white rounded-lg transition-all border border-slate-700 hover:border-violet-500"
                                    >
                                        {ghostLoading ? <div className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full" /> : <LogIn className="w-4 h-4" />}
                                        <span className="text-xs font-medium">Ghost Login</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const StatCard = ({ label, value, trend, color = 'text-white' }: any) => (
    <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
        <div className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">{label}</div>
        <div className="flex items-end justify-between">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className={`text-xs font-medium ${trend.startsWith('+') ? 'text-teal-400' : 'text-red-400'}`}>{trend}</div>
        </div>
    </div>
);

export default SuperAdminTenantsTab;
