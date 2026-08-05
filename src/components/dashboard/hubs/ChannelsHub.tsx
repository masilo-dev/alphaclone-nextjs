'use client';

import React from 'react';
import {
  MessageSquare,
  Mail,
  Inbox,
  Send,
  FileEdit,
  AlertCircle,
} from 'lucide-react';
import HubShell from './HubShell';

const CHANNELS_TABS = [
  { label: 'Inbox', href: '/dashboard/comms', aliases: ['/dashboard/mail'], icon: Inbox },
  { label: 'Sent', href: '/dashboard/comms?tab=sent', aliases: ['/dashboard/mail?tab=sent'], icon: Send },
  { label: 'Drafts', href: '/dashboard/comms?tab=drafts', aliases: ['/dashboard/mail?tab=drafts'], icon: FileEdit },
  { label: 'Outreach', href: '/dashboard/comms?tab=outreaches', aliases: ['/dashboard/mail?tab=outreaches'], icon: Mail },
  { label: 'Needs reply', href: '/dashboard/comms?tab=needs-reply', aliases: ['/dashboard/mail?tab=needs-reply'], icon: AlertCircle },
  { label: 'Channels', href: '/dashboard/comms?tab=channels', aliases: ['/dashboard/mail?tab=channels'], icon: MessageSquare },
];

interface ChannelsHubProps {
  children: React.ReactNode;
}

export default function ChannelsHub({ children }: ChannelsHubProps) {
  return (
    <HubShell
      title="Email & Outreach"
      description="Mailbox, outreach, replies, and connected channels"
      tabs={CHANNELS_TABS}
      moduleId="email"
      accent="rose"
    >
      {children}
    </HubShell>
  );
}
