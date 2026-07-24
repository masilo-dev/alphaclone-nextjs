'use client';

import React from 'react';
import { DollarSign, BarChart3, TrendingUp, Receipt, FileText, Briefcase } from 'lucide-react';
import HubShell from './HubShell';

const MONEY_TABS = [
  { label: 'Accounting', href: '/dashboard/accounting', icon: BarChart3 },
  { label: 'Banking', href: '/dashboard/accounting/banking', icon: DollarSign },
  { label: 'Bills', href: '/dashboard/accounting/bills', icon: Receipt },
  { label: 'Vendors', href: '/dashboard/vendors', icon: Briefcase },
  { label: 'Billing', href: '/dashboard/business/billing', icon: DollarSign },
  { label: 'Invoices', href: '/dashboard/business/billing/manage', icon: FileText },
  { label: 'Expenses', href: '/dashboard/business/expenses', icon: Receipt },
  { label: 'Quotes', href: '/dashboard/business/quotes', icon: FileText },
  { label: 'Cash flow', href: '/dashboard/business/cash-flow', icon: TrendingUp },
];

interface MoneyHubProps {
  children: React.ReactNode;
}

export default function MoneyHub({ children }: MoneyHubProps) {
  return (
    <HubShell
      title="Money"
      description="Money coming in, bills to pay, and invoices waiting"
      tabs={MONEY_TABS}
      dataTour="money-hub"
      accent="amber"
    >
      {children}
    </HubShell>
  );
}
