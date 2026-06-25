'use client';

import React from 'react';
import { Users, TrendingUp, Target, Contact, CheckSquare } from 'lucide-react';
import HubShell from './HubShell';

const SALES_TABS = [
  { label: 'CRM', href: '/dashboard/crm', icon: Users },
  { label: 'Console', href: '/dashboard/crm/console', icon: Target },
  { label: 'Leads', href: '/dashboard/leads', icon: TrendingUp },
  { label: 'Deals', href: '/dashboard/deals', icon: Target },
  { label: 'Contacts', href: '/dashboard/contacts', icon: Contact },
  { label: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare },
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
    >
      {children}
    </HubShell>
  );
}
