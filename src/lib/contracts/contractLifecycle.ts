export const SIGNED_CONTRACT_STATUSES = [
  'signed',
  'fully_signed',
  'client_signed',
] as const;

export type SignedContractStatus = (typeof SIGNED_CONTRACT_STATUSES)[number];

export function isSignedContractStatus(status: string | null | undefined): boolean {
  return SIGNED_CONTRACT_STATUSES.includes(String(status || '').toLowerCase() as SignedContractStatus);
}

export function contractEndDate(row: {
  end_date?: string | null;
  payment_due_date?: string | null;
}): string | null {
  return row.end_date || row.payment_due_date || null;
}

export function contractStartDate(row: {
  start_date?: string | null;
  client_signed_at?: string | null;
  signed_at?: string | null;
  created_at?: string | null;
}): string | null {
  return row.start_date || row.client_signed_at || row.signed_at || row.created_at || null;
}
