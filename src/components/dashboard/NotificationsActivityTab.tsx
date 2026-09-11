'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Clock, Smartphone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ModulePageLayout } from '../ui/ModulePageLayout';
import { ActivityFeed } from './ActivityFeed';
import { notificationService, type Notification } from '../../services/dashboardService';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User } from '../../types';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import type { DashboardFeedItem } from '@/types/dashboardStats';
import EmptyState from '@/components/ui/EmptyState';
import { WORKSPACE } from '@/constants/design';
import { EnterprisePageHeader } from '@/components/dashboard/responsive/EnterpriseModuleChrome';

interface NotificationsActivityTabProps {
  user: User;
}

export function NotificationsActivityTab({ user }: NotificationsActivityTabProps) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id || '';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activity, setActivity] = useState<DashboardFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { isSubscribed, pushSupported, subscribeToPush } = usePushNotifications();

  const loadData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [{ notifications: loaded }, activityRes] = await Promise.all([
        notificationService.getNotifications(user.id, tenantId),
        supabase
          .from('audit_logs')
          .select('action, entity_type, created_at, metadata, severity')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      if (loaded) setNotifications(loaded);

      const feed: DashboardFeedItem[] = (activityRes.data || []).map((row: any) => {
        const meta = row.metadata || {};
        const isFailure = row.severity === 'high' || meta.status === 'failed' || meta.status === 'blocked';
        const isAtRisk = meta.status === 'at_risk';

        const eventTitle = meta.event || row.action || row.entity_type;
        const actorName = meta.actor ? ` (${meta.actor})` : '';
        const resultText = meta.result ? ` — ${meta.result}` : '';

        return {
          dot: isFailure ? '#f43f5e' : isAtRisk ? '#f59e0b' : '#14b8a6',
          text: `${eventTitle}${actorName}${resultText}`,
          time: formatDistanceToNow(new Date(row.created_at), { addSuffix: true }),
        };
      });
      setActivity(feed);
    } finally {
      setLoading(false);
    }
  }, [tenantId, user.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visibleNotifications = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [filter, notifications]
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <ModulePageLayout
      header={<EnterprisePageHeader moduleKey="notifications" />}
    >
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-4 ac-scroll-full pb-24">
        <div className={`overflow-hidden ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--ws-border)] p-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-semibold text-white">In-app alerts</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {(['all', 'unread'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`text-xs px-3 py-1 rounded-lg border ${
                    filter === key
                      ? 'border-teal-500/40 bg-teal-500/10 text-teal-300'
                      : 'border-white/5 text-slate-400'
                  }`}
                >
                  {key === 'all' ? 'All' : 'Unread'}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <EmptyState icon={Bell} title="Loading alerts" description="Pulling your latest notifications and audit activity into the workspace." className="py-8" />
            ) : visibleNotifications.length === 0 ? (
              <EmptyState
                icon={BellOff}
                title="You're all caught up"
                description="Important alerts — overdue invoices, pending approvals, and customer replies — will appear here when something needs your attention."
                bonnieSuggestion="Bonnie sends proactive alerts when something needs your attention."
                className="py-8"
              />
            ) : (
              visibleNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 flex gap-3 ${n.read ? 'opacity-70' : 'bg-teal-500/5'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{n.title}</p>
                    {n.message && <p className="text-sm text-slate-400 mt-1">{n.message}</p>}
                    <p className="text-xs text-slate-500 mt-2">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => notificationService.markAsRead(n.id).then(loadData)}
                      className="text-xs text-teal-400 shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className={`p-4 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-semibold text-white">Alert preferences</span>
            </div>
            {pushSupported ? (
              <button
                onClick={() => subscribeToPush()}
                className="w-full rounded-lg border border-[var(--ws-border)] bg-[var(--ws-toolbar)] p-3 text-left transition-colors hover:bg-slate-950"
              >
                <p className="text-sm text-white">{isSubscribed ? 'Push enabled' : 'Enable push notifications'}</p>
                <p className="text-xs text-slate-500 mt-1">Browser alerts for invoices, deals, and tasks</p>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <BellOff className="w-4 h-4" />
                Push not supported in this browser
              </div>
            )}
          </div>

          <div className={`p-4 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-semibold text-white">Business activity timeline</span>
            </div>
            <ActivityFeed items={activity} title="" subtitle="" />
          </div>
        </div>
      </div>
    </ModulePageLayout>
  );
}

export default NotificationsActivityTab;
