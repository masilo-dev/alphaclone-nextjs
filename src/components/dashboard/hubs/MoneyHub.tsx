'use client';

import React from 'react';
import { DollarSign, BarChart3, TrendingUp, Receipt, FileText } from 'lucide-react';
import HubShell from './HubShell';

const MONEY_TABS = [
  { label: 'Accounting', href: '/dashboard/accounting', icon: BarChart3 },
  { label: 'Banking', href: '/dashboard/accounting/banking', icon: DollarSign },
  { label: 'Bills', href: '/dashboard/accounting/bills', icon: Receipt },
  { label: 'Billing', href: '/dashboard/business/billing', icon: DollarSign },
  { label: 'Expenses', href: '/dashboard/business/expenses', icon: Receipt },
  { label: 'Quotes', href: '/dashboard/business/quotes', icon: FileText },
  { label: 'Cash Flow', href: '/dashboard/business/cash-flow', icon: TrendingUp },
];

interface MoneyHubProps {
  children: React.ReactNode;
}

export default function MoneyHub({ children }: MoneyHubProps) {
  return (
    <HubShell
      title="Money Hub"
      description="Invoicing, accounting, expenses, and financial reports"
      tabs={MONEY_TABS}
    >
      {children}
    </HubShell>
  );
}
