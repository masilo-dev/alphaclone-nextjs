import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type CrmActivityType = 'note' | 'call' | 'email' | 'meeting' | 'task' | 'stage_change';

export async function logCrmActivityAdmin(
  admin: SupabaseClient,
  params: {
    tenantId: string;
    type: CrmActivityType;
    subject: string;
    description?: string;
    contactId?: string;
    companyId?: string;
    opportunityId?: string;
    dealId?: string;
    projectId?: string;
    createdBy?: string;
    metadata?: Record<string, unknown>;
    isAutomated?: boolean;
    source?: string;
  }
) {
  const now = new Date().toISOString();
  const { data: activity, error } = await admin
    .from('activities')
    .insert({
      tenant_id: params.tenantId,
      type: params.type,
      subject: params.subject,
      description: params.description || null,
      contact_id: params.contactId || null,
      company_id: params.companyId || null,
      opportunity_id: params.opportunityId || null,
      project_id: params.projectId || null,
      created_by: params.createdBy || null,
      status: 'completed',
      priority: 'normal',
      is_automated: params.isAutomated ?? false,
      source: params.source || 'crm',
      metadata: {
        ...(params.metadata || {}),
        deal_id: params.dealId || null,
      },
      completed_at: now,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[crmActivityServer] activities insert failed:', error.message);
  }

  if (params.dealId) {
    const { error: dealActErr } = await admin.from('deal_activities').insert({
      deal_id: params.dealId,
      user_id: params.createdBy || null,
      activity_type: params.type,
      title: params.subject,
      description: params.description || null,
      metadata: params.metadata || {},
    });
    if (dealActErr) {
      console.warn('[crmActivityServer] deal_activities insert failed:', dealActErr.message);
    }
  }

  if (params.contactId) {
    await admin
      .from('contacts')
      .update({ last_contacted_at: now, last_activity_at: now, updated_at: now })
      .eq('id', params.contactId)
      .eq('tenant_id', params.tenantId);
  }

  if (params.companyId) {
    await admin
      .from('companies')
      .update({ last_activity_at: now, updated_at: now })
      .eq('id', params.companyId)
      .eq('tenant_id', params.tenantId);
  }

  return activity;
}
