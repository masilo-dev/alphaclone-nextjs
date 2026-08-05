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
  { label: 'Tickets', href: '/dashboard/business/tickets', icon: CheckSquare },
  { label: 'Team chat', href: '/dashboard/business/messages', icon: MessageSquare },
  { label: 'Mail', href: '/dashboard/mail', icon: Mail },
  { label: 'WhatsApp', href: '/dashboard/business/whatsapp', icon: MessageCircle },
];

interface ChannelsHubProps {
  children: React.ReactNode;
}

export default function ChannelsHub({ children }: ChannelsHubProps) {
  return (
    <HubShell
      title="Email & Outreach"
      description="Tickets, team messages, email, and messaging"
      tabs={CHANNELS_TABS}
      moduleId="email"
      accent="rose"
    >
      {children}
    </HubShell>
  );
}
