'use client';

import React from 'react';
import {
  Mail,
  Globe,
  FileText,
  MessageSquare,
  PenSquare,
  Calendar,
  Linkedin,
  Facebook,
  Instagram,
  Twitter,
} from 'lucide-react';
import HubShell from './HubShell';

const MARKETING_TABS = [
  { label: 'Overview', href: '/dashboard/business/social', icon: Globe },
  { label: 'Compose', href: '/dashboard/business/social/compose', icon: PenSquare },
  { label: 'Schedule', href: '/dashboard/business/social-command', icon: Calendar },
  { label: 'LinkedIn', href: '/dashboard/business/linkedin', icon: Linkedin },
  { label: 'Facebook', href: '/dashboard/business/facebook', icon: Facebook },
  { label: 'Instagram', href: '/dashboard/business/instagram', icon: Instagram },
  { label: 'X', href: '/dashboard/business/x', icon: Twitter },
  { label: 'Campaigns', href: '/dashboard/business/campaigns', icon: Mail },
  { label: 'Sequences', href: '/dashboard/marketing/sequences', icon: Mail },
  { label: 'Forms', href: '/dashboard/business/forms', icon: FileText },
  { label: 'SMS', href: '/dashboard/business/sms', icon: MessageSquare },
  { label: 'Inbox', href: '/dashboard/mail', icon: MessageSquare },
];

interface MarketingHubProps {
  children: React.ReactNode;
}

export default function MarketingHub({ children }: MarketingHubProps) {
  return (
    <HubShell
      title="Marketing & Social"
      description="Publish, schedule, and run campaigns from one place"
      tabs={MARKETING_TABS}
      accent="violet"
    >
      {children}
    </HubShell>
  );
}
