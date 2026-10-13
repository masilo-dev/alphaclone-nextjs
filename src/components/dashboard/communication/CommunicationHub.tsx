"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Inbox,
  Send,
  FileEdit,
  MessageSquare,
  AlertCircle,
  Mail,
  Sparkles,
} from "lucide-react";
import type { User } from "@/types";
import { cn } from "@/lib/utils";
import { TaskGuide } from '../common/TaskGuide';
import UnifiedInbox from "@/components/dashboard/business/UnifiedInbox";
import UnifiedInboxTab from "@/components/dashboard/business/UnifiedInboxTab";
import { EmailOutreachComposer } from "@/components/dashboard/communication/EmailOutreachComposer";
import type { InboxFolder } from "@/types/unifiedInbox";

type CommsTab =
  | "inbox"
  | "sent"
  | "drafts"
  | "outreaches"
  | "channels"
  | "needs-reply";

const TABS: { id: CommsTab; label: string; icon: React.ElementType }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileEdit },
  { id: "outreaches", label: "Outreaches", icon: Mail },
  { id: "channels", label: "All channels", icon: MessageSquare },
  { id: "needs-reply", label: "Needs reply", icon: AlertCircle },
];

interface CommunicationHubProps {
  user: User;
}

export function CommunicationHub({ user: _user }: CommunicationHubProps) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams?.get("tab") as CommsTab) || "inbox";
  const [activeTab, setActiveTab] = useState<CommsTab>(TABS.some(tab => tab.id === initialTab) ? initialTab : 'inbox');
  useEffect(() => {
    const requested = searchParams?.get('tab') as CommsTab;
    if (TABS.some(tab => tab.id === requested)) setActiveTab(requested);
  }, [searchParams]);

  const folderMap: Record<string, InboxFolder> = {
    inbox: "inbox",
    sent: "sent",
    drafts: "drafts",
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--ws-canvas)]">
      <TaskGuide />
      <nav aria-label="Communication sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--ws-border)] px-3">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return <button type="button" key={tab.id} aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => setActiveTab(tab.id)} className={cn('inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm', activeTab === tab.id ? 'border-[var(--info-text)] text-[var(--info-text)]' : 'border-transparent text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)]')}><Icon className="h-4 w-4" aria-hidden />{tab.label === 'Outreaches' ? 'Outreach' : tab.label}</button>;
        })}
      </nav>
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "outreaches" ? (
          <EmailOutreachComposer />
        ) : activeTab === "channels" || activeTab === "needs-reply" ? (
          <div className="h-full min-h-0">
            <UnifiedInboxTab needsReplyOnly={activeTab === "needs-reply"} />
          </div>
        ) : (
          <div className="h-full min-h-0">
            <UnifiedInbox
              defaultTab="mailbox"
              initialFolder={folderMap[activeTab] || "inbox"}
              hideTabSwitcher
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default CommunicationHub;
