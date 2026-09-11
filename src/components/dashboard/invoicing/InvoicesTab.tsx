'use client';

/**
 * Canonical invoice workspace — delegates to EnhancedBillingPage.
 * Route: /dashboard/business/invoices (alias of /dashboard/business/billing/manage).
 */
import EnhancedBillingPage from '../business/EnhancedBillingPage';
import { useAuth } from '@/contexts/AuthContext';

export default function InvoicesTab() {
  const { user } = useAuth();
  if (!user) return null;
  return <EnhancedBillingPage user={user} />;
}
