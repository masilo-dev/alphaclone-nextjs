'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Inbox, Send, FileEdit, MessageSquare, AlertCircle, Mail } from 'lucide-react';
import type { User } from '@/types';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { cn } from '@/lib/utils';
import UnifiedInbox from '@/components/dashboard/business/UnifiedInbox';
import UnifiedInboxTab from '@/components/dashboard/business/UnifiedInboxTab';
import { EmailOutreachComposer } from '@/components/dashboard/communication/EmailOutreachComposer';
import type { InboxFolder } from '@/types/unifiedInbox';

type CommsTab = 'inbox' | 'sent' | 'drafts' | 'outreaches' | 'channels' | 'needs-reply';

const TABS: { id: CommsTab; label: string; icon: React.ElementType }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'drafts', label: 'Drafts', icon: FileEdit },
  { id: 'outreaches', label: 'Outreaches', icon: Mail },
  { id: 'channels', label: 'All channels', icon: MessageSquare },
  { id: 'needs-reply', label: 'Needs reply', icon: AlertCircle },
];

interface CommunicationHubProps {
  user: User;
}

export function CommunicationHub({ user: _user }: CommunicationHubProps) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get('tab') as CommsTab) || 'inbox';
  const [activeTab, setActiveTab] = useState<CommsTab>(initialTab);

  const folderMap: Record<string, InboxFolder> = {
    inbox: 'inbox',
    sent: 'sent',
    drafts: 'drafts',
  };

  return (
    <ModulePageLayout className="h-full min-h-0">
      <div className="flex flex-col h-full min-h-0">
        <div className="px-3 md:px-5 pt-2 pb-2 border-b border-white/5">
          <div className="flex gap-1 overflow-x-auto ac-scroll-x pb-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors min-h-9',
                  activeTab === tab.id
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                    : 'text-[var(--ws-text-secondary)] hover:bg-white/5 border border-transparent'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'outreaches' ? (
            <EmailOutreachComposer />
          ) : activeTab === 'channels' || activeTab === 'needs-reply' ? (
            <div className="h-full p-3 md:p-5">
              <UnifiedInboxTab needsReplyOnly={activeTab === 'needs-reply'} />
            </div>
          ) : (
            <div className="h-full p-3 md:p-5">
              <UnifiedInbox
                defaultTab="mailbox"
                initialFolder={folderMap[activeTab] || 'inbox'}
                hideTabSwitcher
              />
            </div>
          )}
        </div>
      </div>
    </ModulePageLayout>
  );
}

export default CommunicationHub;
