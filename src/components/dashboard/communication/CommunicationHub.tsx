'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Inbox, Send, FileEdit, MessageSquare, AlertCircle, Mail, Sparkles } from 'lucide-react';
import type { User } from '@/types';
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
    <div className="flex flex-col h-full min-h-0 bg-slate-950/60 backdrop-blur-xl">
      {/* ── Glassmorphic executive header bar ── */}
      <div className="flex items-center justify-between px-3 md:px-5 py-2.5 border-b border-white/10 bg-slate-900/60 backdrop-blur-md shrink-0 gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto ac-scroll-x py-0.5">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-all duration-200 whitespace-nowrap',
                  isActive
                    ? 'bg-gradient-to-r from-teal-500/25 via-cyan-500/20 to-emerald-500/20 text-teal-200 border border-teal-500/40 shadow-[0_0_15px_rgba(20,184,166,0.2)]'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                )}
              >
                <Icon className={cn('w-3.5 h-3.5 transition-transform duration-200', isActive ? 'text-teal-300 scale-110' : 'text-slate-400')} aria-hidden="true" />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(45,212,191,0.8)] animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium px-2.5 py-1 rounded-full bg-slate-900/80 border border-white/5 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          <span className="text-[11px]">AI Workspace Active</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'outreaches' ? (
          <EmailOutreachComposer />
        ) : activeTab === 'channels' || activeTab === 'needs-reply' ? (
          <div className="h-full p-2 md:p-3">
            <UnifiedInboxTab needsReplyOnly={activeTab === 'needs-reply'} />
          </div>
        ) : (
          <div className="h-full p-2 md:p-3">
            <UnifiedInbox
              defaultTab="mailbox"
              initialFolder={folderMap[activeTab] || 'inbox'}
              hideTabSwitcher
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default CommunicationHub;
