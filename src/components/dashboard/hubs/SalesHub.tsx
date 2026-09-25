'use client';

import React from 'react';
import { TrendingUp, Target, Mail, BarChart3, Search, FileText } from 'lucide-react';
import HubShell from './HubShell';

/** Keep Sales navigation aligned with the sidebar; deeper CRM tools stay contextual. */
const SALES_TABS = [
  { label: 'Lead Finder', href: '/dashboard/leads/campaigns', icon: Search },
  { label: 'Leads', href: '/dashboard/leads', icon: TrendingUp },
  { label: 'Deals', href: '/dashboard/deals', icon: Target },
  { label: 'Outreach', href: '/dashboard/outreach', icon: Mail },
  { label: 'Quotes', href: '/dashboard/business/quotes', icon: FileText },
  { label: 'Sales overview', href: '/dashboard/crm', icon: BarChart3 },
];

interface SalesHubProps {
  children: React.ReactNode;
}

export default function SalesHub({ children }: SalesHubProps) {
  return (
    <HubShell
      title="CRM & Sales"
      description="Relationships, leads, and deals moving toward close"
      tabs={SALES_TABS}
      moduleId="crm"
      accent="green"
    >
      {children}
    </HubShell>
  );
}
