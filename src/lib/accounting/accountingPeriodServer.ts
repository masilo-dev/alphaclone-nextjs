import type { SupabaseClient } from '@supabase/supabase-js';

export type PeriodStatus = 'open' | 'closed' | 'locked';

export interface AccountingPeriod {
  id: string;
  tenantId: string;
  periodName: string;
  fiscalYear: number;
  periodNumber: number;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  closedAt?: string;
  closedBy?: string;
  lockedAt?: string;
  lockedBy?: string;
  createdAt: string;
  createdBy?: string;
}

type PeriodRow = {
  id: string;
  tenant_id: string;
  period_name: string;
  fiscal_year: number;
  period_number: number;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  closed_at?: string | null;
  closed_by?: string | null;
  locked_at?: string | null;
  locked_by?: string | null;
  created_at: string;
  created_by?: string | null;
};

export function mapAccountingPeriod(data: PeriodRow): AccountingPeriod {
  return {
    id: data.id,
    tenantId: data.tenant_id,
    periodName: data.period_name,
    fiscalYear: data.fiscal_year,
    periodNumber: data.period_number,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
    closedAt: data.closed_at ?? undefined,
    closedBy: data.closed_by ?? undefined,
    lockedAt: data.locked_at ?? undefined,
    lockedBy: data.locked_by ?? undefined,
    createdAt: data.created_at,
    createdBy: data.created_by ?? undefined,
  };
}

export async function listAccountingPeriods(
  admin: SupabaseClient,
  tenantId: string,
  filters?: { fiscalYear?: number; status?: PeriodStatus },
): Promise<AccountingPeriod[]> {
  let query = admin.from('accounting_periods').select('*').eq('tenant_id', tenantId);

  if (filters?.fiscalYear != null) {
    query = query.eq('fiscal_year', filters.fiscalYear);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query
    .order('fiscal_year', { ascending: false })
    .order('period_number', { ascending: true });

  if (error) throw error;
  return (data as PeriodRow[] | null)?.map(mapAccountingPeriod) ?? [];
}

export async function getCurrentOpenPeriod(
  admin: SupabaseClient,
  tenantId: string,
): Promise<AccountingPeriod | null> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await admin
    .from('accounting_periods')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'open')
    .lte('start_date', today)
    .gte('end_date', today)
    .maybeSingle();

  if (error) throw error;
  return data ? mapAccountingPeriod(data as PeriodRow) : null;
}

export async function initializeFiscalYearPeriods(
  admin: SupabaseClient,
  tenantId: string,
  fiscalYear: number,
  createdBy?: string,
): Promise<AccountingPeriod[]> {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const rows = monthNames.map((name, month) => {
    const startDate = new Date(fiscalYear, month, 1);
    const endDate = new Date(fiscalYear, month + 1, 0);
    return {
      tenant_id: tenantId,
      period_name: `${name} ${fiscalYear}`,
      fiscal_year: fiscalYear,
      period_number: month + 1,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      status: 'open' as const,
      created_by: createdBy ?? null,
    };
  });

  const { data, error } = await admin.from('accounting_periods').insert(rows).select('*');
  if (error) throw error;
  return (data as PeriodRow[]).map(mapAccountingPeriod);
}

export async function closeAccountingPeriod(
  admin: SupabaseClient,
  tenantId: string,
  periodId: string,
  actorUserId: string,
): Promise<void> {
  const { data: period, error: loadError } = await admin
    .from('accounting_periods')
    .select('status')
    .eq('id', periodId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (loadError) throw loadError;
  if (!period) throw new Error('Period not found');
  if (period.status !== 'open') {
    throw new Error(`Period is already ${period.status}`);
  }

  const { error } = await admin
    .from('accounting_periods')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: actorUserId,
    })
    .eq('id', periodId)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}

export async function lockAccountingPeriod(
  admin: SupabaseClient,
  tenantId: string,
  periodId: string,
  actorUserId: string,
): Promise<void> {
  const { data: period, error: loadError } = await admin
    .from('accounting_periods')
    .select('status')
    .eq('id', periodId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (loadError) throw loadError;
  if (!period) throw new Error('Period not found');
  if (period.status !== 'closed') {
    throw new Error('Period must be closed before locking');
  }

  const { error } = await admin
    .from('accounting_periods')
    .update({
      status: 'locked',
      locked_at: new Date().toISOString(),
      locked_by: actorUserId,
    })
    .eq('id', periodId)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}

export async function reopenAccountingPeriod(
  admin: SupabaseClient,
  tenantId: string,
  periodId: string,
): Promise<void> {
  const { data: period, error: loadError } = await admin
    .from('accounting_periods')
    .select('status')
    .eq('id', periodId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (loadError) throw loadError;
  if (!period) throw new Error('Period not found');
  if (period.status === 'locked') {
    throw new Error('Cannot reopen locked period');
  }
  if (period.status === 'open') {
    throw new Error('Period is already open');
  }

  const { error } = await admin
    .from('accounting_periods')
    .update({
      status: 'open',
      closed_at: null,
      closed_by: null,
    })
    .eq('id', periodId)
    .eq('tenant_id', tenantId);

  if (error) throw error;
}

export async function getAccountingPeriodById(
  admin: SupabaseClient,
  tenantId: string,
  periodId: string,
): Promise<AccountingPeriod | null> {
  const { data, error } = await admin
    .from('accounting_periods')
    .select('*')
    .eq('id', periodId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapAccountingPeriod(data as PeriodRow) : null;
}
