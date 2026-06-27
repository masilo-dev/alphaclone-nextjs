import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Building2,
    Search,
    Eye,
    Trash2,
    MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantManagementService, TenantInfo } from '../../../services/tenantManagementService';
import { securityLogService } from '../../../services/securityLogService';
import { ModulePageLayout } from '../../ui/ModulePageLayout';
import { DetailDrawer } from '../../ui/DetailDrawer';
import { EnterpriseDataTable, type EnterpriseColumn } from '../../ui/EnterpriseDataTable';
import { StatusBadge } from '../../ui/StatusBadge';
import { ModuleStatCards } from '../common/ModuleStatCards';

const SuperAdminTenantsTab: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [tenants, setTenants] = useState<TenantInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
    const [tenantLogs, setTenantLogs] = useState<any[]>([]);

    const loadTenants = useCallback(async () => {
        setLoading(true);
        const { tenants: data, error } = await tenantManagementService.getAllTenants();
        if (error) {
            toast.error(`Error loading tenants: ${error}`);
        }
        setTenants(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadTenants();
    }, [loadTenants]);

    const handleViewLogs = useCallback(async (tenantId: string) => {
        setSelectedTenant(tenantId);
        const { logs } = await securityLogService.getTenantLogs(tenantId, 50);
        setTenantLogs(logs);
    }, []);

    const handleDeleteTenant = useCallback(async (tenantId: string, tenantName: string) => {
        if (!confirm(`Are you sure you want to delete "${tenantName}"? This action cannot be undone.`)) return;

        const { error } = await tenantManagementService.deleteTenant(tenantId);
        if (!error) {
            setTenants(prev => prev.filter(t => t.id !== tenantId));
            toast.success('Tenant scheduled for deletion');
        } else {
            toast.error(`Error deleting tenant: ${error}`);
        }
    }, []);

    const filteredTenants = tenants.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalMRR = tenants.reduce((sum, t) => sum + (t.subscription === 'enterprise' ? 24000 : t.subscription === 'pro' ? 12000 : 0), 0);
    const selectedTenantName = tenants.find((t) => t.id === selectedTenant)?.name;

    const tenantColumns = useMemo<EnterpriseColumn<TenantInfo>[]>(() => [
        {
            id: 'name',
            header: 'Tenant',
            mobilePrimary: true,
            sortable: true,
            sortValue: (t) => t.name,
            accessor: (t) => (
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-violet-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
                        {t.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <span className="text-[13px] font-bold text-white block truncate">{t.name}</span>
                        <span className="text-[11px] text-slate-500">ID: {t.id.substring(0, 8)}…</span>
                    </div>
                </div>
            ),
        },
        {
            id: 'plan',
            header: 'Plan',
            accessor: (t) => <span className="capitalize text-slate-300">{t.subscription || 'free'}</span>,
        },
        {
            id: 'status',
            header: 'Status',
            accessor: (t) => <StatusBadge variant={t.status === 'active' ? 'success' : t.status === 'suspended' ? 'warning' : 'neutral'}>{t.status}</StatusBadge>,
        },
        {
            id: 'users',
            header: 'Users',
            sortable: true,
            sortValue: (t) => t.userCount,
            accessor: (t) => <span className="font-mono">{t.userCount}</span>,
        },
        {
            id: 'created',
            header: 'Created',
            sortable: true,
            sortValue: (t) => t.createdAt,
            accessor: (t) => new Date(t.createdAt).toLocaleDateString(),
        },
        {
            id: 'actions',
            header: '',
            accessor: (t) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleViewLogs(t.id); }}
                        className="px-2 py-1.5 rounded-lg border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/5"
                    >
                        <Eye className="w-3.5 h-3.5 inline" /> Logs
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTenant(t.id, t.name); }}
                        className="p-1.5 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            ),
        },
    ], [handleDeleteTenant, handleViewLogs]);

    const tenantStats = useMemo(() => [
        { label: 'Total tenants', value: tenants.length, sub: `${filteredTenants.length} shown`, Icon: Building2, accent: 'teal' as const },
        { label: 'Total MRR', value: `$${(totalMRR / 1000).toFixed(1)}k`, Icon: Building2, accent: 'emerald' as const },
        { label: 'Active users', value: tenants.reduce((sum, t) => sum + t.userCount, 0), Icon: Building2, accent: 'blue' as const },
        { label: 'Avg users/tenant', value: (tenants.reduce((sum, t) => sum + t.userCount, 0) / (tenants.length || 1)).toFixed(1), Icon: Building2, accent: 'sky' as const },
    ], [tenants, filteredTenants.length, totalMRR]);

    return (
        <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module p-3 sm:p-4 md:p-6">
            <ModulePageLayout
                header={(
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Building2 className="w-6 h-6 text-teal-400" />
                                Platform Overview
                            </h2>
                            <p className="text-slate-400 text-sm">Manage all tenants on the platform</p>
                        </div>
                    </div>
                )}
                toolbar={(
                    <div className="relative px-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search tenants..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-white/5 rounded-xl text-sm text-white focus:outline-none focus:border-teal-500/50"
                        />
                    </div>
                )}
                stats={!loading ? (
                    <div className="px-1">
                        <ModuleStatCards stats={tenantStats} />
                    </div>
                ) : null}
            >
                <div className="px-1 pb-20">
                    {loading ? (
                        <div className="divide-y divide-white/5">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900/40 animate-pulse" />)}</div>
                    ) : (
                        <EnterpriseDataTable
                            columns={tenantColumns}
                            data={filteredTenants}
                            getRowId={(t) => t.id}
                            onRowClick={(t) => handleViewLogs(t.id)}
                            emptyMessage={searchTerm ? 'No tenants match your search.' : 'No tenants found.'}
                        />
                    )}
                </div>
            </ModulePageLayout>

            <DetailDrawer
                open={Boolean(selectedTenant)}
                onOpenChange={(open) => { if (!open) setSelectedTenant(null); }}
                title="Security logs"
                description={selectedTenantName}
                size="wide"
            >
                <div className="space-y-3 pb-6">
                    {tenantLogs.length === 0 ? (
                        <p className="text-sm text-slate-500 py-8 text-center">No security logs found for this tenant.</p>
                    ) : (
                        tenantLogs.map((log) => (
                            <div key={log.id} className="bg-slate-900/60 border border-white/5 rounded-xl p-4">
                                <div className="flex items-start justify-between mb-2 gap-2">
                                    <StatusBadge variant={log.severity === 'critical' ? 'error' : log.severity === 'warning' ? 'warning' : 'info'}>
                                        {log.eventType}
                                    </StatusBadge>
                                    <span className="text-xs text-slate-500 shrink-0">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                                    <span className="inline-flex items-center gap-1.5 font-mono">
                                        <MapPin className="w-3.5 h-3.5 text-teal-400" />
                                        {log.ipAddress}
                                    </span>
                                    {log.location && <span className="text-slate-400">{log.location}</span>}
                                    {log.deviceInfo && (
                                        <span className="text-slate-500 text-xs">
                                            {log.deviceInfo.browser} on {log.deviceInfo.os}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </DetailDrawer>
        </div>
    );
};

export default SuperAdminTenantsTab;
