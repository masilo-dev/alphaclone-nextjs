import { tenantService } from '../tenancy/TenantService';

async function post<T>(action: string, config: Record<string, unknown> = {}): Promise<T> {
  const tenantId = tenantService.getCurrentTenantId();
  if (!tenantId) throw new Error('No active tenant');

  const res = await fetch('/api/accounting/management', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId, action, config }),
  });

  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || 'Accounting request failed');
  return json as T;
}

export const accountingManagementClient = {
  getBankAccounts: () =>
    post<{ success: boolean; data: { accounts: BankAccount[] } }>('get_bank_accounts'),

  getReconciliationSessions: (limit = 25) =>
    post<{ success: boolean; data: { sessions: ReconciliationSession[] } }>(
      'get_reconciliation_sessions',
      { limit }
    ),

  createReconciliationSession: (config: {
    bankAccountId: string;
    statementStartDate: string;
    statementEndDate: string;
    statementEndingBalance: number;
    status?: string;
  }) => post<{ success: boolean; data: unknown }>('create_reconciliation_session', config),

  createBankAccount: (config: {
    name: string;
    bankName?: string;
    accountNumberLast4?: string;
    accountType?: 'checking' | 'savings' | 'credit' | 'other';
    currency?: string;
    openingBalance?: number;
  }) => post<{ success: boolean; data: BankAccount }>('create_bank_account', config),

  getBills: (page = 1, limit = 50, status?: string) =>
    post<{ success: boolean; data: { bills: VendorBill[]; pagination: { total: number } } }>(
      'get_bills',
      { page, limit, status }
    ),

  getApAging: () =>
    post<{ success: boolean; data: { aging: ApAgingRow[] } }>('get_ap_aging'),

  getFinanceSnapshot: () =>
    post<{ success: boolean; data: Record<string, unknown> }>('get_finance_snapshot'),
};

export interface BankAccount {
  id: string;
  name: string;
  account_type?: string;
  current_balance?: number;
  currency?: string;
  last_reconciled_at?: string;
}

export interface ReconciliationSession {
  id: string;
  bank_account_id: string;
  statement_start_date: string;
  statement_end_date: string;
  statement_ending_balance: number;
  status: string;
  created_at: string;
}

export interface VendorBill {
  id: string;
  vendor_name?: string;
  total?: number;
  status?: string;
  issue_date?: string;
  due_date?: string;
}

export interface ApAgingRow {
  bucket?: string;
  amount?: number;
  count?: number;
}
