"use client";

import React, { useState } from "react";
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
  const [activeTab] = useState<CommsTab>(initialTab);

  const folderMap: Record<string, InboxFolder> = {
    inbox: "inbox",
    sent: "sent",
    drafts: "drafts",
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-950">
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
