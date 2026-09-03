'use client';

import React from 'react';
import {
  LayoutDashboard,
  Mail,
  Send,
  Globe,
  Users,
  BarChart3,
  Truck,
} from 'lucide-react';
import HubShell from './HubShell';

const MARKETING_TABS = [
  { label: 'Overview', href: '/dashboard/marketing', icon: LayoutDashboard },
  { label: 'Campaigns', href: '/dashboard/business/campaigns', icon: Mail },
  { label: 'Outreach', href: '/dashboard/marketing/outreach', icon: Send },
  { label: 'Social', href: '/dashboard/business/social-command', icon: Globe },
  { label: 'Audience', href: '/dashboard/crm/unified-contacts', icon: Users },
  { label: 'Results', href: '/dashboard/marketing/deliverability', icon: BarChart3 },
  { label: 'Delivery', href: '/dashboard/marketing/delivery', icon: Truck },
];

interface MarketingHubProps {
  children: React.ReactNode;
}

export default function MarketingHub({ children }: MarketingHubProps) {
  return (
    <HubShell
      title="Marketing"
      description="Run outreach, campaigns and social from one control center"
      tabs={MARKETING_TABS}
      moduleId="marketing"
      accent="blue"
    >
      {children}
    </HubShell>
  );
}
