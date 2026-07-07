'use client';

import React from 'react';
import HubShell from './HubShell';
import { SALES_WORKSPACE_TABS } from './SalesWorkspaceTabs';

interface SalesHubProps {
  children: React.ReactNode;
}

export default function SalesHub({ children }: SalesHubProps) {
  return (
    <HubShell
      title="Sales Workspace"
      description="One home for pipeline, leads, contacts, accounts, and execution tabs"
      tabs={SALES_WORKSPACE_TABS}
      accent="blue"
    >
      {children}
    </HubShell>
  );
}
