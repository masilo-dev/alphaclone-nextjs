'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Bot,
  ChevronRight,
  FileText,
  Mail,
  Receipt,
  Send,
} from 'lucide-react';
import { useBonnieApprovals } from '@/hooks/useBonnieApprovals';
import { useTenant } from '@/contexts/TenantContext';
import { HUMAN_LABELS } from '@/lib/copy/humanLabels';
import ApprovalCenter from './ApprovalCenter';

interface ActionQueueItem {
  id: string;
  type: 'approval' | 'message' | 'invoice' | 'contract' | 'social';
  title: string;
  detail?: string;
  href: string;
  impact: 'high' | 'medium' | 'low';
}

export function UnifiedActionCenter() {
  const { currentTenant } = useTenant();
  const { pendingCount, approvals } = useBonnieApprovals(currentTenant?.id);
  const [extraItems, setExtraItems] = useState<ActionQueueItem[]>([]);

  useEffect(() => {
    if (!currentTenant?.id) return;
    void fetch(`/api/dashboard/action-queue?tenantId=${encodeURIComponent(currentTenant.id)}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        setExtraItems((data?.items || []) as ActionQueueItem[]);
      })
      .catch(() => {});
  }, [currentTenant?.id]);

  const approvalItems: ActionQueueItem[] = (approvals || [])
    .filter((a) => a.status === 'pending')
    .slice(0, 10)
    .map((a) => ({
      id: a.id,
      type: 'approval' as const,
      title: a.toolName || 'Bonnie action waiting for approval',
      detail: a.reason || undefined,
      href: '/dashboard/bonnie/approvals',
      impact: (a.riskLevel === 'high' || a.riskLevel === 'critical' ? 'high' : 'medium') as 'high' | 'medium',
    }));

  const allItems = [...approvalItems, ...extraItems].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.impact] - order[b.impact];
  });

  const iconFor = (type: ActionQueueItem['type']) => {
    switch (type) {
      case 'approval':
        return Bot;
      case 'message':
        return Mail;
      case 'invoice':
        return Receipt;
      case 'contract':
        return FileText;
      case 'social':
        return Send;
      default:
        return AlertCircle;
    }
  };

  return (
    <div className="space-y-6">
      {allItems.length > 0 ? (
        <section className="ac-workspace-panel p-4">
          <h2 className="text-[13px] font-semibold text-[var(--ws-text-primary)] mb-3">
            {HUMAN_LABELS.pendingApprovals} ({allItems.length})
          </h2>
          <ul className="space-y-2">
            {allItems.slice(0, 8).map((item) => {
              const Icon = iconFor(item.type);
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 hover:border-teal-500/30 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-teal-400 shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[var(--ws-text-primary)] truncate">{item.title}</p>
                      {item.detail ? (
                        <p className="text-[11px] text-[var(--ws-text-tertiary)] truncate">{item.detail}</p>
                      ) : null}
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--ws-text-tertiary)]" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <ApprovalCenter />
    </div>
  );
}

export default UnifiedActionCenter;
