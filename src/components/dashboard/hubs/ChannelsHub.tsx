'use client';

import React from 'react';
import {
  MessageSquare,
  Mail,
  MessageCircle,
  CheckSquare,
} from 'lucide-react';
import HubShell from './HubShell';

const CHANNELS_TABS = [
  { label: 'Unified Inbox', href: '/dashboard/comms', icon: Mail },
  { label: 'Support tickets', href: '/dashboard/business/tickets', icon: CheckSquare },
  { label: 'Team messages', href: '/dashboard/business/messages', icon: MessageSquare },
  { label: 'Email', href: '/dashboard/mail', icon: Mail },
  { label: 'WhatsApp', href: '/dashboard/business/whatsapp', icon: MessageCircle },
];

interface ChannelsHubProps {
  children: React.ReactNode;
}

export default function ChannelsHub({ children }: ChannelsHubProps) {
  return (
    <HubShell
      title="Inbox"
      description="One place for email, tickets, team chat, and WhatsApp"
      tabs={CHANNELS_TABS}
      accent="blue"
    >
      {children}
    </HubShell>
  );
}
