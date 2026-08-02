import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { notifyTenantOwners } from '@/lib/notifyTenantOwners';
import { campaignHealth } from '@/lib/outreach/outreachIntelligence';

async function markerExists(tenantId: string, type: string, marker: string) {
  const db = createSupabaseAdminClient();
  const { count } = await db.from('notifications').select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId).eq('type', type).ilike('message', `%${marker}%`);
  return Boolean(count);
}

async function notifyOnce(options: { tenantId: string; type: string; title: string; message: string; marker: string; link: string }) {
  if (await markerExists(options.tenantId, options.type, options.marker)) return false;
  await notifyTenantOwners({ tenantId: options.tenantId, type: options.type, title: options.title, message: `${options.message} ${options.marker}`, link: options.link });
  return true;
}

export async function processRevenueLifecycleAlerts() {
  const db = createSupabaseAdminClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in30Days = new Date(now.getTime() + 30 * 86400_000).toISOString().slice(0, 10);
  const results = { contracts: 0, obligations: 0, documents: 0, missingDocuments: 0, invoices: 0, campaigns: 0, errors: 0 };
  const [contracts, obligations, documents, requirements, invoices] = await Promise.all([
    db.from('contracts').select('id, tenant_id, title, end_date, renewal_date, notice_deadline, lifecycle_status').not('lifecycle_status','in','("renewed","terminated")').or(`end_date.lte.${in30Days},renewal_date.lte.${in30Days},notice_deadline.lte.${in30Days}`),
    db.from('contract_obligations').select('id, tenant_id, contract_id, title, due_date, status, owner_user_id').not('status','in','("completed","cancelled","waived")').not('due_date','is',null).lte('due_date', new Date(now.getTime() + 14 * 86400_000).toISOString()),
    db.from('documents').select('id, tenant_id, name, title, expiry_date').not('expiry_date','is',null).lte('expiry_date', in30Days).is('deleted_at', null),
    db.from('document_requirements').select('*').in('status',['missing','requested']).or(`due_date.is.null,due_date.lte.${in30Days}`),
    db.from('business_invoices').select('id, tenant_id, invoice_number, due_date, total, balance_due, status, lifecycle_status').lt('due_date', today).not('status','in','("paid","void","cancelled")'),
  ]);
  for (const contract of contracts.data || []) try {
    const date = contract.notice_deadline || contract.renewal_date || contract.end_date;
    const current = String(contract.lifecycle_status || '');
    if (['signed', 'active'].includes(current)) {
      const transitionedAt = new Date().toISOString();
      const { error: transitionError } = await db.from('contracts').update({
        lifecycle_status: 'expiring', status: 'expiring', updated_at: transitionedAt,
      }).eq('tenant_id', contract.tenant_id).eq('id', contract.id).eq('lifecycle_status', current);
      if (transitionError) throw transitionError;
      const { error: eventError } = await db.from('contract_lifecycle_events').insert({
        tenant_id: contract.tenant_id,
        contract_id: contract.id,
        from_status: current,
        to_status: 'expiring',
        source: 'revenue_lifecycle_alerts',
        reason: `Renewal, notice or end date is within 30 days (${date})`,
        evidence: { trigger_date: date, transitioned_at: transitionedAt },
      });
      if (eventError) throw eventError;
    }
    if (await notifyOnce({ tenantId: contract.tenant_id, type: 'contract_expiring', title: `Contract action due: ${contract.title}`, message: `Review renewal, notice and obligations before ${date}.`, marker: `contract_alert:${contract.id}:${date}`, link: `/dashboard/business/contracts?contractId=${contract.id}` })) results.contracts += 1;
  } catch { results.errors += 1; }
  for (const obligation of obligations.data || []) try {
    const dueDate = String(obligation.due_date).slice(0, 10);
    const overdue = dueDate < today;
    if (await notifyOnce({
      tenantId: obligation.tenant_id,
      type: overdue ? 'contract_obligation_overdue' : 'contract_obligation_due',
      title: `${overdue ? 'Overdue' : 'Upcoming'} contract obligation: ${obligation.title}`,
      message: `${obligation.owner_user_id ? 'An owner is assigned. ' : 'Assign an owner. '}Due ${dueDate}.`,
      marker: `contract_obligation:${obligation.id}:${dueDate}`,
      link: `/dashboard/business/contracts?contractId=${obligation.contract_id}`,
    })) results.obligations += 1;
    if (overdue && obligation.status !== 'overdue') await db.from('contract_obligations').update({ status: 'overdue', updated_at: new Date().toISOString() }).eq('tenant_id', obligation.tenant_id).eq('id', obligation.id);
  } catch { results.errors += 1; }
  for (const document of documents.data || []) try { if (await notifyOnce({ tenantId: document.tenant_id, type: 'document_expiring', title: `Document expiring: ${document.title || document.name}`, message: `This document expires on ${document.expiry_date}. Renew or replace it.`, marker: `document_expiry:${document.id}:${document.expiry_date}`, link: `/dashboard/business/documents?documentId=${document.id}` })) results.documents += 1; } catch { results.errors += 1; }
  for (const requirement of requirements.data || []) try { const marker = `document_missing:${requirement.id}:${requirement.due_date || 'open'}`; if (await notifyOnce({ tenantId: requirement.tenant_id, type: 'document_missing', title: `Missing document: ${requirement.name}`, message: requirement.due_date ? `Required by ${requirement.due_date}.` : 'This required document has not been received.', marker, link: '/dashboard/business/documents' })) { results.missingDocuments += 1; await db.from('document_requirements').update({ last_reminded_at: new Date().toISOString() }).eq('tenant_id', requirement.tenant_id).eq('id', requirement.id); } } catch { results.errors += 1; }
  for (const invoice of invoices.data || []) try { const marker = `invoice_overdue:${invoice.id}:${invoice.due_date}`; if (await notifyOnce({ tenantId: invoice.tenant_id, type: 'invoice_overdue', title: `Invoice overdue: ${invoice.invoice_number}`, message: `${invoice.balance_due ?? invoice.total} remains due. Review and approve a collection reminder.`, marker, link: `/dashboard/business/billing/manage?invoiceId=${invoice.id}` })) { results.invoices += 1; await db.from('business_invoices').update({ lifecycle_status: 'overdue' }).eq('tenant_id', invoice.tenant_id).eq('id', invoice.id).neq('lifecycle_status','disputed'); } } catch { results.errors += 1; }
  const { data: events } = await db.from('outreach_events').select('tenant_id, campaign_id, event_type').not('campaign_id','is',null).gte('occurred_at', new Date(now.getTime() - 7 * 86400_000).toISOString());
  const campaignGroups = new Map<string, typeof events>();
  for (const event of events || []) { const key = `${event.tenant_id}:${event.campaign_id}`; campaignGroups.set(key, [...(campaignGroups.get(key) || []), event]); }
  for (const [key, rows] of campaignGroups) try { if (!rows?.length) continue; const count = (type: string) => rows.filter((row) => row.event_type === type).length; const health = campaignHealth({ sent: count('sent'), bounced: count('bounced'), complained: count('complained'), unsubscribed: count('unsubscribed') }); if (!health.shouldPause) continue; const [tenantId, campaignId] = key.split(':'); await db.from('email_campaigns').update({ status: 'paused' }).eq('tenant_id', tenantId).eq('id', campaignId).in('status',['running','sending','scheduled']); if (await notifyOnce({ tenantId, type: 'campaign_safety', title: 'Campaign paused for deliverability safety', message: health.reasons.join(' '), marker: `campaign_safety:${campaignId}:${today}`, link: `/dashboard/outreach?campaignId=${campaignId}` })) results.campaigns += 1; } catch { results.errors += 1; }
  return results;
}
