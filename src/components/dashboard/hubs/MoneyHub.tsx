'use client';

import React from 'react';
import { DollarSign, BarChart3, TrendingUp, Receipt } from 'lucide-react';
import HubShell from './HubShell';

// Keep this list aligned 1:1 with the Money group in TENANT_ADMIN_NAV_ITEMS.
// A module must never expose a second, competing navigation taxonomy.
const MONEY_TABS = [
  { label: 'Invoices', href: '/dashboard/business/billing/manage', icon: DollarSign },
  { label: 'Billing overview', href: '/dashboard/business/billing', icon: DollarSign },
  { label: 'Accounting', href: '/dashboard/accounting', icon: BarChart3 },
  { label: 'Expenses', href: '/dashboard/business/expenses', icon: Receipt },
  { label: 'Cash flow', href: '/dashboard/business/cash-flow', icon: TrendingUp },
  { label: 'Banking', href: '/dashboard/accounting/banking', icon: DollarSign },
];

interface MoneyHubProps {
  children: React.ReactNode;
}

export default function MoneyHub({ children }: MoneyHubProps) {
  return (
    <HubShell
      title="Money Hub"
      description="Billing, cash movement, and financial oversight"
      tabs={MONEY_TABS}
      dataTour="money-hub"
      moduleId="money"
      accent="green"
    >
      {children}
    </HubShell>
  );
}
