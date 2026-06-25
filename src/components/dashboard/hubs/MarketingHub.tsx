'use client';

import React from 'react';
import { Mail, Globe, FileText, MessageSquare, Facebook, Linkedin, Twitter } from 'lucide-react';
import HubShell from './HubShell';

const MARKETING_TABS = [
  { label: 'Campaigns', href: '/dashboard/business/campaigns', icon: Mail },
  { label: 'Sequences', href: '/dashboard/marketing/sequences', icon: Mail },
  { label: 'Deliverability', href: '/dashboard/marketing/deliverability', icon: MessageSquare },
  { label: 'Forms', href: '/dashboard/business/forms', icon: FileText },
  { label: 'Social', href: '/dashboard/business/social', icon: Globe },
  { label: 'Facebook', href: '/dashboard/business/facebook', icon: Facebook },
  { label: 'LinkedIn', href: '/dashboard/business/linkedin', icon: Linkedin },
  { label: 'X (Twitter)', href: '/dashboard/business/x', icon: Twitter },
  { label: 'Inbox', href: '/dashboard/mail', icon: MessageSquare },
];

interface MarketingHubProps {
  children: React.ReactNode;
}

export default function MarketingHub({ children }: MarketingHubProps) {
  return (
    <HubShell
      title="Marketing Hub"
      description="Email campaigns, forms, social, and outreach"
      tabs={MARKETING_TABS}
    >
      {children}
    </HubShell>
  );
}
