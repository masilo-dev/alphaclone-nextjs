'use client';

import React from 'react';
import { FileText, FolderLock, FileSignature, LayoutTemplate } from 'lucide-react';
import HubShell from './HubShell';

const DOCUMENTS_TABS = [
  { label: 'All Documents', href: '/dashboard/business/documents', icon: FileText },
  { label: 'Vault', href: '/dashboard/business/vault', icon: FolderLock },
  { label: 'Contracts', href: '/dashboard/business/contracts', icon: FileSignature },
  { label: 'Templates', href: '/dashboard/business/documents?tab=templates', icon: LayoutTemplate },
];

interface DocumentsHubProps {
  children: React.ReactNode;
}

export default function DocumentsHub({ children }: DocumentsHubProps) {
  return (
    <HubShell
      title="Documents"
      description="Hub, vault, contracts, and templates in one place"
      tabs={DOCUMENTS_TABS}
    >
      {children}
    </HubShell>
  );
}
