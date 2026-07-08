'use client';

import React from 'react';
import { Globe, Zap, BookOpen, Settings, Bot } from 'lucide-react';
import HubShell from './HubShell';

const WORKSPACE_TABS = [
  { label: 'Marketplace', href: '/dashboard/marketplace', icon: Globe },
  { label: 'Workflows', href: '/dashboard/business/workflows', icon: Zap },
  { label: 'Platform guide', href: '/dashboard/help', icon: BookOpen },
  { label: 'Settings', href: '/dashboard/business/settings', icon: Settings },
  { label: 'Zoho CRM', href: '/dashboard/zoho/crm', icon: Bot },
];

interface WorkspaceHubProps {
  children: React.ReactNode;
}

export default function WorkspaceHub({ children }: WorkspaceHubProps) {
  return (
    <HubShell
      title="Workspace"
      description="Integrations, automations, and system settings"
      tabs={WORKSPACE_TABS}
    >
      {children}
    </HubShell>
  );
}
