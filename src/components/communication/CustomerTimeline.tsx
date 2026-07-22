'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  DollarSign,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Receipt,
  StickyNote,
} from 'lucide-react';
import { clientActivityService, type ClientActivity } from '@/services/clientActivityService';
import { cn } from '@/lib/utils';
import EmptyState from '@/components/ui/EmptyState';
import { getEmptyStatePreset } from '@/config/emptyStatePresets';

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  message: MessageCircle,
  call: Phone,
  meeting: Calendar,
  contract: FileText,
  payment: DollarSign,
  project_update: FileText,
  file_upload: FileText,
  note: StickyNote,
  invoice: Receipt,
  email: Mail,
};

interface CustomerTimelineProps {
  clientId: string;
  className?: string;
  maxItems?: number;
  onOpenComms?: () => void;
}

export function CustomerTimeline({ clientId, className, maxItems = 50, onOpenComms }: CustomerTimelineProps) {
  const [activities, setActivities] = useState<ClientActivity[]>([]);
  const [clientName, setClientName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    setLoading(true);
    void clientActivityService.getClientTimeline(clientId).then(({ timeline, error: err }) => {
      if (!active) return;
      if (err || !timeline) {
        setError(err || 'Could not load timeline');
        setActivities([]);
      } else {
        setClientName(timeline.client_name);
        setActivities(timeline.activities.slice(0, maxItems));
        setError(null);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [clientId, maxItems]);

  if (loading) {
    return (
      <div className={cn('space-y-3 p-4', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-[12px] text-red-400 p-4">{error}</p>;
  }

  if (activities.length === 0) {
    const preset = getEmptyStatePreset('messages');
    return (
      <EmptyState
        icon={preset.icon}
        title="No conversations yet"
        description={`Start communicating with ${clientName || 'this customer'} — messages, emails, and notes will appear here.`}
        bonnieSuggestion={preset.bonnieSuggestion}
        quickActions={onOpenComms ? [{ label: 'Open communication hub', onAction: onOpenComms }] : preset.quickActions}
        className="py-8"
      />
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {activities.map((activity) => {
        const Icon = ACTIVITY_ICONS[activity.activity_type] || MessageCircle;
        return (
          <div
            key={activity.id}
            className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <div className="w-7 h-7 rounded-md bg-teal-500/10 flex items-center justify-center shrink-0">
              <Icon className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-[var(--ws-text-primary)] truncate">{activity.title}</p>
              {activity.description ? (
                <p className="text-[11px] text-[var(--ws-text-tertiary)] line-clamp-2 mt-0.5">{activity.description}</p>
              ) : null}
              <p className="text-[10px] text-[var(--ws-text-tertiary)] mt-1">
                {new Date(activity.created_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default CustomerTimeline;
