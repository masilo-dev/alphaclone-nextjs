'use client';

import React from 'react';
import { FileText, ShieldCheck, Layers, Users } from 'lucide-react';
import HubShell from './HubShell';

const DOCUMENTS_TABS = [
  { label: 'Documents', href: '/dashboard/business/documents', icon: FileText },
  { label: 'Vault', href: '/dashboard/business/vault', icon: ShieldCheck },
  { label: 'Contracts', href: '/dashboard/business/contracts', icon: ShieldCheck },
  { label: 'Contract manager', href: '/dashboard/business/contracts/manage', icon: ShieldCheck },
  { label: 'Projects', href: '/dashboard/business/projects', icon: Layers },
  { label: 'Onboarding', href: '/dashboard/business/onboarding', icon: Users },
];

interface DocumentsHubProps {
  children: React.ReactNode;
}

export default function DocumentsHub({ children }: DocumentsHubProps) {
  return (
    <HubShell
      title="Documents"
      description="Contracts, documents, projects, and your vault"
      tabs={DOCUMENTS_TABS}
      moduleId="documents"
      accent="amber"
    >
      {children}
    </HubShell>
  );
}
