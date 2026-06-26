import { supabase } from '@/lib/supabase';

export type ClientContextItemType =
  | 'contract'
  | 'invoice'
  | 'quote'
  | 'proposal'
  | 'meeting'
  | 'receipt'
  | 'event';

export interface ClientContextItem {
  id: string;
  type: ClientContextItemType;
  label: string;
  detail: string;
  referenceLine: string;
}

export async function loadClientEmailContext(
  tenantId: string,
  opts: { clientId?: string; email?: string }
): Promise<ClientContextItem[]> {
  const items: ClientContextItem[] = [];
  const clientId = opts.clientId?.trim();
  const email = opts.email?.trim().toLowerCase();

  const pushUnique = (item: ClientContextItem) => {
    if (!items.some((existing) => existing.id === item.id && existing.type === item.type)) {
      items.push(item);
    }
  };

  const queries: Promise<void>[] = [];

  if (clientId) {
    queries.push(
      (async () => {
        const { data } = await supabase
          .from('contracts')
          .select('id, title, status, created_at')
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(8);
        (data || []).forEach((row: any) => {
          pushUnique({
            id: row.id,
            type: 'contract',
            label: row.title || 'Contract',
            detail: `Status: ${row.status || 'draft'}`,
            referenceLine: `- Contract: ${row.title || 'Agreement'} (${row.status || 'draft'})`,
          });
        });
      })()
    );

    queries.push(
      (async () => {
        const { data } = await supabase
          .from('business_invoices')
          .select('id, invoice_number, total, status, created_at, paid_at')
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(8);
        (data || []).forEach((row: any) => {
          const isPaid = String(row.status || '').toLowerCase() === 'paid';
          pushUnique({
            id: row.id,
            type: isPaid ? 'receipt' : 'invoice',
            label: row.invoice_number || 'Invoice',
            detail: `$${Number(row.total || 0).toLocaleString()} · ${row.status || 'draft'}`,
            referenceLine: `- ${isPaid ? 'Receipt' : 'Invoice'}: ${row.invoice_number || row.id} ($${Number(row.total || 0).toLocaleString()}, ${row.status})`,
          });
        });
      })()
    );

    queries.push(
      (async () => {
        const { data } = await supabase
          .from('quotes')
          .select('id, title, total_amount, status, created_at')
          .eq('tenant_id', tenantId)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(8);
        (data || []).forEach((row: any) => {
          pushUnique({
            id: row.id,
            type: row.status === 'accepted' ? 'proposal' : 'quote',
            label: row.title || 'Quote',
            detail: `$${Number(row.total_amount || 0).toLocaleString()} · ${row.status || 'draft'}`,
            referenceLine: `- ${row.status === 'accepted' ? 'Proposal' : 'Quote'}: ${row.title || 'Quote'} ($${Number(row.total_amount || 0).toLocaleString()})`,
          });
        });
      })()
    );

    queries.push(
      (async () => {
        const { data } = await supabase
          .from('calendar_events')
          .select('id, title, start_time')
          .eq('tenant_id', tenantId)
          .eq('related_entity_id', clientId)
          .order('start_time', { ascending: false })
          .limit(6);
        (data || []).forEach((row: any) => {
          const when = row.start_time ? new Date(row.start_time).toLocaleString() : 'Scheduled';
          pushUnique({
            id: row.id,
            type: 'meeting',
            label: row.title || 'Meeting',
            detail: when,
            referenceLine: `- Meeting: ${row.title || 'Session'} (${when})`,
          });
        });
      })()
    );
  }

  if (email) {
    queries.push(
      (async () => {
        const { data } = await supabase
          .from('quotes')
          .select('id, title, total_amount, status, created_at')
          .eq('tenant_id', tenantId)
          .ilike('client_email', email)
          .order('created_at', { ascending: false })
          .limit(4);
        (data || []).forEach((row: any) => {
          pushUnique({
            id: row.id,
            type: 'quote',
            label: row.title || 'Quote',
            detail: `$${Number(row.total_amount || 0).toLocaleString()}`,
            referenceLine: `- Quote: ${row.title || 'Quote'}`,
          });
        });
      })()
    );
  }

  await Promise.all(queries);
  return items;
}

export function formatContextInsert(selected: ClientContextItem[]): string {
  if (selected.length === 0) return '';
  return `\n\nReferenced from your workspace:\n${selected.map((item) => item.referenceLine).join('\n')}\n`;
}
