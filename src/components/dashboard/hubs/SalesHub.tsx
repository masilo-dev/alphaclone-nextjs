'use client';

import React from 'react';
import HubShell from './HubShell';
import { SALES_WORKSPACE_TABS } from './SalesWorkspaceTabs';

/** Hub tabs aligned with CRM / leads / pipeline lifecycle — not every submodule at once. */
interface SalesHubProps {
  children: React.ReactNode;
}

export default function SalesHub({ children }: SalesHubProps) {
  return (
    <HubShell
      title="CRM & Sales"
      description="Relationships, leads, and deals moving toward close"
      tabs={SALES_WORKSPACE_TABS}
      moduleId="crm"
      accent="green"
    >
      {children}
    </HubShell>
  );
}
