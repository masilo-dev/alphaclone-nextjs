'use client';

import React from 'react';
import { Users, TrendingUp, Target, Contact, CheckSquare, Mail, BarChart3, Activity, Search, Inbox, Bot } from 'lucide-react';
import HubShell from './HubShell';

/** Hub tabs aligned with CRM / leads / pipeline lifecycle — not every submodule at once. */
const SALES_TABS = [
  { label: 'Overview', href: '/dashboard/crm', icon: Users },
  { label: 'Contacts', href: '/dashboard/crm/unified-contacts', icon: Contact },
  { label: 'Companies', href: '/dashboard/crm/accounts', icon: Users },
  { label: 'Leads', href: '/dashboard/leads', icon: TrendingUp },
  { label: 'Lead Finder', href: '/dashboard/leads/finder', icon: Search },
  { label: 'Pipeline', href: '/dashboard/deals', icon: Target },
  { label: 'Activities', href: '/dashboard/crm/follow-ups', icon: Activity },
  { label: 'Outreach', href: '/dashboard/outreach', icon: Mail },
  { label: 'Reach Inbox', href: '/dashboard/outreach/inbox', icon: Inbox },
  { label: 'Growth Agent', href: '/dashboard/sales-agent', icon: Bot },
  { label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
  { label: 'Forecast', href: '/dashboard/forecast', icon: BarChart3 },
  { label: 'Workspace', href: '/dashboard/crm/workspace', icon: Users },
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
