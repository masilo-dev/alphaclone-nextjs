'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

export type ComposerChannel =
  | 'email'
  | 'note'
  | 'sms'
  | 'whatsapp'
  | 'meeting'
  | 'sequence';

export interface ComposerRelatedRecord {
  type: string;
  id?: string;
  label: string;
}

interface CommunicationComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  defaultChannel?: ComposerChannel;
  relatedCustomer?: ComposerRelatedRecord;
  relatedRecord?: ComposerRelatedRecord;
  /** Render the active channel body (e.g. existing email form). */
  children?: React.ReactNode;
  onAskBonnie?: () => void;
  channels?: ComposerChannel[];
}

const CHANNEL_LABEL: Record<ComposerChannel, string> = {
  email: 'Email',
  note: 'Internal note',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  meeting: 'Meeting',
  sequence: 'Follow-up sequence',
};

const DEFAULT_CHANNELS: ComposerChannel[] = ['email', 'note', 'meeting', 'sequence'];

/**
 * Side-drawer communication composer shell.
 * Hosts channel selection + related context; channel bodies are injected by callers
 * so existing send/API logic (CommunicationModal, etc.) stays intact.
 */
export function CommunicationComposer({
  open,
  onOpenChange,
  title = 'Compose',
  defaultChannel = 'email',
  relatedCustomer,
  relatedRecord,
  children,
  onAskBonnie,
  channels = DEFAULT_CHANNELS,
}: CommunicationComposerProps) {
  const [channel, setChannel] = useState<ComposerChannel>(defaultChannel);

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Communicate without leaving this record"
      size="wide"
      className="ac-communication-composer"
    >
      <div className="space-y-4 pt-2">
        {(relatedCustomer || relatedRecord) && (
          <div className="rounded-[12px] border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] px-3 py-2.5 text-xs text-[var(--ws-text-secondary)] space-y-1">
            {relatedCustomer ? (
              <p>
                <span className="text-[var(--ws-text-muted)]">Customer </span>
                <span className="font-semibold text-[var(--ws-text-primary)]">{relatedCustomer.label}</span>
              </p>
            ) : null}
            {relatedRecord ? (
              <p>
                <span className="text-[var(--ws-text-muted)]">{relatedRecord.type} </span>
                <span className="font-semibold text-[var(--ws-text-primary)]">{relatedRecord.label}</span>
              </p>
            ) : null}
          </div>
        )}

        <div
          className="flex flex-wrap gap-1 rounded-[10px] bg-[var(--ws-surface-tertiary)] p-1"
          role="tablist"
          aria-label="Channel"
        >
          {channels.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={channel === item}
              onClick={() => setChannel(item)}
              className={cn(
                'px-3 min-h-8 rounded-[8px] text-xs font-semibold transition-colors',
                channel === item
                  ? 'bg-[var(--ws-surface-primary)] text-[var(--ws-text-primary)] shadow-sm'
                  : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
              )}
            >
              {CHANNEL_LABEL[item]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--ws-text-muted)]">
            Activity can be tracked on the related customer timeline.
          </p>
          {onAskBonnie ? (
            <button type="button" onClick={onAskBonnie} className={WORKSPACE.action.bonnie}>
              Ask Bonnie
            </button>
          ) : null}
        </div>

        {channel === 'email' || channel === 'note' || children ? (
          <div className="ac-composer-body">{children}</div>
        ) : (
          <div className="rounded-[14px] border border-[var(--ws-border)] p-6 text-center">
            <p className="text-sm font-semibold text-[var(--ws-text-primary)]">
              {CHANNEL_LABEL[channel]}
            </p>
            <p className="mt-2 text-sm text-[var(--ws-text-secondary)]">
              Connect this channel in Settings to compose from here. Your existing integrations stay
              unchanged.
            </p>
            <a href="/dashboard/business/settings" className={cn(WORKSPACE.action.secondary, 'mt-4 inline-flex')}>
              Open communication settings
            </a>
          </div>
        )}
      </div>
    </DetailDrawer>
  );
}

/** Compact trigger used on record headers */
export function ComposerCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-2 rounded-[8px] text-[var(--ws-text-muted)] hover:bg-[var(--ws-hover)]"
      aria-label="Close composer"
    >
      <X className="w-4 h-4" />
    </button>
  );
}
