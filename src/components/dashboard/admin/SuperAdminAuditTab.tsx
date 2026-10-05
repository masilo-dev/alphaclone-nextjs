'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Search, Filter, RefreshCw } from 'lucide-react';
import { userService } from '@/services/userService';
import { Input } from '../../ui/UIComponents';

export const SuperAdminAuditTab: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);

  const loadAuditLogs = useCallback(async () => {
    setLoading(true);
    const { logs: fetchedLogs, total: count, error } = await userService.getAuditLogs({
      action: actionFilter || undefined,
      search: search || undefined,
      page,
      limit: 30,
    });
    if (!error) {
      setLogs(fetchedLogs);
      setTotal(count);
    }
    setLoading(false);
  }, [actionFilter, page, search]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  return (
    <div className="space-y-6 animate-fade-in ac-enterprise-module">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-teal-400" />
            Platform Audit Trail
          </h2>
          <p className="text-[var(--ws-text-muted)] type-card-description">Immutable log of privileged system and governance actions ({total} entries)</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ws-text-muted)]" />
            <Input
              placeholder="Search action or resource..."
              className="pl-10 w-48 sm:w-64 h-10 bg-[var(--ws-panel)]/50 border-[var(--ws-border)] type-ui"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={loadAuditLogs}
            className="p-2.5 bg-[var(--ws-surface-secondary)] hover:bg-[var(--ws-surface-tertiary)] text-[var(--ws-text-secondary)] rounded-xl border border-white/5"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'ROLE_CHANGED', 'SUPER_ADMIN_GRANTED', 'SUPER_ADMIN_REVOKED', 'USER_SUSPENDED', 'USER_REACTIVATED', 'USER_SOFT_DELETED', 'USER_PERMANENTLY_DELETED', 'PASSWORD_CHANGED', 'WORKSPACE_OWNERSHIP_TRANSFERRED'].map(act => (
          <button
            key={act}
            onClick={() => { setActionFilter(act); setPage(1); }}
            className={`px-3 py-1 rounded-full type-caption font-bold uppercase tracking-wider transition-all border ${actionFilter === act
              ? 'bg-teal-500 text-white border-teal-500'
              : 'bg-[var(--ws-panel)]/50 text-[var(--ws-text-muted)] border-[var(--ws-border)] hover:border-[var(--ws-border)]'
            }`}
          >
            {act === '' ? 'ALL ACTIONS' : act.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="p-8 text-center bg-[var(--ws-panel)]/40 border border-[var(--ws-border)] rounded-2xl text-[var(--ws-text-muted)]">
          No audit logs found matching criteria.
        </div>
      ) : (
        <div className="bg-[var(--ws-panel)]/40 border border-[var(--ws-border)] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left type-caption">
              <thead className="bg-[var(--ws-panel)]/80 text-[var(--ws-text-muted)] font-bold uppercase tracking-wider border-b border-[var(--ws-border)]">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Actor User</th>
                  <th className="p-3.5">Resource</th>
                  <th className="p-3.5">Metadata Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-[var(--ws-text-secondary)]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--ws-surface-secondary)]/30 transition-colors">
                    <td className="p-3.5 text-[var(--ws-text-muted)] font-mono whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-3.5 font-bold">
                      <span className={`px-2 py-0.5 rounded uppercase type-caption font-black ${
                        log.action.includes('SUPER_ADMIN') ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                        log.action.includes('SUSPENDED') || log.action.includes('DELETED') ? 'bg-[var(--error-500)]/20 text-red-400 border border-red-500/30' :
                        'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[var(--ws-text-muted)]">
                      {log.user_id ? log.user_id.slice(0, 8) + '...' : 'System'}
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-white">{log.resource_type}</span>
                      <span className="text-[var(--ws-text-muted)] block type-ui font-mono">{log.resource_id}</span>
                    </td>
                    <td className="p-3.5 font-mono type-ui text-[var(--ws-text-muted)] max-w-xs truncate">
                      {JSON.stringify(log.metadata || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminAuditTab;
