'use client';

import React from 'react';
import { FileText, ShieldCheck, Layers } from 'lucide-react';
import HubShell from './HubShell';

const DOCUMENTS_TABS = [
  { label: 'All documents', href: '/dashboard/business/documents', icon: FileText },
  { label: 'Contracts', href: '/dashboard/business/contracts', icon: ShieldCheck },
  { label: 'Proposals', href: '/dashboard/business/quotes', icon: FileText },
  { label: 'Invoices', href: '/dashboard/business/billing', icon: Layers },
  { label: 'Client docs', href: '/dashboard/business/vault', icon: ShieldCheck },
];

interface DocumentsHubProps {
  children: React.ReactNode;
}

export default function DocumentsHub({ children }: DocumentsHubProps) {
  return (
    <HubShell
      title="Documents"
      description="Contracts, proposals, invoices, and client files"
      tabs={DOCUMENTS_TABS}
      moduleId="documents"
      accent="amber"
    >
      {children}
    </HubShell>
  );
}
