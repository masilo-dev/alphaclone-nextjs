'use client';

import React from 'react';
import { Users, TrendingUp, Target, Contact, CheckSquare, Mail, BarChart3, Database } from 'lucide-react';
import HubShell from './HubShell';

const SALES_TABS = [
  { label: 'Overview', href: '/dashboard/crm', icon: Users },
  { label: 'Workspace', href: '/dashboard/crm/workspace', icon: Users },
  { label: 'Outreach', href: '/dashboard/outreach', icon: Mail },
  { label: 'Console', href: '/dashboard/crm/console', icon: Target },
  { label: 'Leads', href: '/dashboard/leads', icon: TrendingUp },
  { label: 'Deals', href: '/dashboard/deals', icon: Target },
  { label: 'Contacts', href: '/dashboard/contacts', icon: Contact },
  { label: 'Accounts', href: '/dashboard/crm/accounts', icon: Users },
  { label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
  { label: 'Forecast', href: '/dashboard/forecast', icon: BarChart3 },
  { label: 'Ingestion', href: '/dashboard/business/ingestion', icon: Database },
];

interface SalesHubProps {
  children: React.ReactNode;
}

export default function SalesHub({ children }: SalesHubProps) {
  return (
    <HubShell
      title="Sales Hub"
      description="Pipeline, leads, deals, and contacts in one workspace"
      tabs={SALES_TABS}
      accent="teal"
    >
      {children}
    </HubShell>
  );
}
