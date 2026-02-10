import React, { useState, useEffect } from 'react';
import {
    Building2,
    Search,
    MoreVertical,
    CheckCircle,
    XCircle,
    ShieldAlert,
    Eye,
    LogIn,
    Trash2,
    MapPin,
    Calendar // Added for Calendly status
} from 'lucide-react';
import { tenantManagementService, TenantInfo } from '../../../services/tenantManagementService';
import { securityLogService } from '../../../services/securityLogService';

const SuperAdminTenantsTab: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [tenants, setTenants] = useState<TenantInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
    const [tenantLogs, setTenantLogs] = useState<any[]>([]);

    useEffect(() => {
        loadTenants();
    }, []);

    const loadTenants = async () => {
        setLoading(true);
        const { tenants: data } = await tenantManagementService.getAllTenants();
        setTenants(data);
        setLoading(false);
    };

    const handleViewLogs = async (tenantId: string) => {
        setSelectedTenant(tenantId);
        const { logs } = await securityLogService.getTenantLogs(tenantId, 50);
        setTenantLogs(logs);
    };

    const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
        if (!confirm(`Are you sure you want to delete "${tenantName}"? This action cannot be undone.`)) return;

        const { error } = await tenantManagementService.deleteTenant(tenantId);
        if (!error) {
            setTenants(tenants.filter(t => t.id !== tenantId));
            alert('Tenant deleted successfully');
        } else {
            alert(`Error deleting tenant: ${error}`);
        }
    };

    const filteredTenants = tenants.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalMRR = tenants.reduce((sum, t) => sum + (t.subscription === 'enterprise' ? 24000 : t.subscription === 'pro' ? 12000 : 0), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-slate-400">Loading tenants...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-teal-400" />
                        Platform Command Center
                    </h2>
                    <p className="text-slate-400">Manage all tenants on the platform</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search tenants..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl focus:outline-none focus:border-teal-500 text-white"
                    />
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Tenants" value={tenants.length.toString()} trend={`${tenants.length} Active`} />
                <StatCard label="Total MRR" value={`$${(totalMRR / 1000).toFixed(1)}k`} trend={`+$${(totalMRR * 0.1 / 1000).toFixed(1)}k`} color="text-green-400" />
                <StatCard label="Active Users" value={tenants.reduce((sum, t) => sum + t.userCount, 0).toString()} trend="All Tenants" color="text-teal-400" />
                <StatCard label="Avg Users/Tenant" value={(tenants.reduce((sum, t) => sum + t.userCount, 0) / (tenants.length || 1)).toFixed(1)} trend="Growing" color="text-blue-400" />
            </div>

            {/* Tenants Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 text-sm">
                            <th className="p-4 font-medium">Business Name</th>
                            <th className="p-4 font-medium">Subscription</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium text-center">Calendly</th>
                            <th className="p-4 font-medium">Users</th>
                            <th className="p-4 font-medium">Created</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTenants.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-400">
                                    No tenants found. {searchTerm && 'Try a different search term.'}
                                </td>
                            </tr>
                        ) : (
                            filteredTenants.map(tenant => (
                                <tr key={tenant.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold text-xs text-white border border-teal-500 shadow-lg shadow-teal-500/20">
                                                {tenant.name.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-medium text-white">{tenant.name}</div>
                                                <div className="text-xs text-slate-500">ID: {tenant.id.substring(0, 8)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-slate-300 text-sm capitalize">{tenant.subscription || 'Free'}</span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(tenant.status)} uppercase tracking-wide`}>
                                            {tenant.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        {(tenant.settings as any)?.calendly?.enabled ? (
                                            <div className="flex items-center justify-center text-teal-400" title="Calendly Connected">
                                                <Calendar className="w-4 h-4" />
                                                <div className="w-1.5 h-1.5 bg-teal-400 rounded-full ml-1 animate-pulse" />
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-center text-slate-600" title="Not Connected">
                                                <Calendar className="w-4 h-4" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 font-mono text-slate-300">
                                        {tenant.userCount}
                                    </td>
                                    <td className="p-4 text-slate-400 text-sm">
                                        {new Date(tenant.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleViewLogs(tenant.id)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-teal-600 text-slate-300 hover:text-white rounded-lg transition-all border border-slate-700 hover:border-teal-500"
                                                title="View Security Logs"
                                            >
                                                <Eye className="w-4 h-4" />
                                                <span className="text-xs font-medium">Logs</span>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all border border-red-500/20 hover:border-red-500/50"
                                                title="Delete Tenant"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Security Logs Modal */}
            {selectedTenant && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                                <ShieldAlert className="w-6 h-6 text-teal-400" />
                                Security Logs & IP Tracking
                            </h3>
                            <button
                                onClick={() => setSelectedTenant(null)}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {tenantLogs.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    No security logs found for this tenant
                                </div>
                            ) : (
                                tenantLogs.map(log => (
                                    <div key={log.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${log.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                                                    log.severity === 'warning' ? 'bg-orange-500/20 text-orange-400' :
                                                        'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {log.eventType}
                                                </span>
                                            </div>
                                            <span className="text-xs text-slate-500">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <MapPin className="w-4 h-4 text-teal-400" />
                                                <span className="font-mono">{log.ipAddress}</span>
                                            </div>
                                            {log.location && (
                                                <span className="text-slate-400">{log.location}</span>
                                            )}
                                            {log.deviceInfo && (
                                                <span className="text-slate-500">
                                                    {log.deviceInfo.browser} on {log.deviceInfo.os}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const getStatusColor = (status: string) => {
    switch (status) {
        case 'active': return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
        case 'suspended': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
        case 'inactive': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
};

const StatCard = ({ label, value, trend, color = 'text-white' }: any) => (
    <div className="p-5 bg-slate-900/50 border border-slate-800 rounded-2xl">
        <div className="text-slate-500 text-xs uppercase tracking-wider font-semibold mb-1">{label}</div>
        <div className="flex items-end justify-between">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className={`text-xs font-medium ${trend.startsWith('+') ? 'text-teal-400' : 'text-slate-400'}`}>{trend}</div>
        </div>
    </div>
);

export default SuperAdminTenantsTab;

