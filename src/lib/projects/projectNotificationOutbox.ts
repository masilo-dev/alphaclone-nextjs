import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { loadTenantEmailBrandingProfile } from '@/lib/email/tenantEmailBranding';
import { escapeHtml } from '@/lib/email/escapeHtml';
import { buildCanonicalProjectPortalUrl } from '@/lib/projects/portalLinks';

export function projectNotificationSuppression(project: any, settings: any, categories: any, eventType: string): string | null {
  const policy = settings?.project_notifications || {};
  if (project.metadata?.is_test_data || /^(QA TEST|TEST ONLY)\b/i.test(project.name || '') || project.metadata?.historical_import) {
    if (policy.allow_test_notifications !== true) return 'test_or_historical_record';
  }
  if (policy.enabled !== true || policy.transactional_authorized !== true) return 'transactional_notifications_not_authorized';
  if (categories?.projects?.disabled || categories?.projects?.email_client === false) return 'tenant_client_notifications_disabled';
  if (policy.events?.[eventType] === false) return 'event_disabled';
  return null;
}

export function projectEventCopy(event: any): {title:string;body:string} | null {
  switch(event.action) {
    case 'project_created':return {title:'Your project has been created',body:'Your project has been created successfully. We will keep you informed as it moves forward.'};
    case 'milestone_completed':return {title:'Project milestone completed',body:`Milestone completed: ${event.new_value?.name || 'Project milestone'}.`};
    case 'client_approval_required':return {title:'Your approval is required',body:'Please review the item shared in your client workspace.'};
    case 'document_shared':return {title:'A project document is available',body:'A document has been shared with you in your client workspace.'};
    case 'project_delayed':return {title:'Project schedule updated',body:'The project schedule has changed. Please review the latest update.'};
    case 'client_message_received':return {title:'New project message',body:'You have received a new message in your client workspace.'};
    case 'project_status_changed':
      if (['Active','in_progress'].includes(event.new_value?.status) && event.new_value?.execution_authorized === true) return {title:'Work on your project has started',body:'Your project has been activated for delivery.'};
      if (['Completed','done'].includes(event.new_value?.status)) return {title:'Your project is complete',body:'Your project has been marked complete by the business.'};
      return null;
    default:return null;
  }
}

export async function processProjectNotificationOutbox(limit=20, db: SupabaseClient=createSupabaseAdminClient(), services={send:sendEmailServer,branding:loadTenantEmailBrandingProfile}) {
  const now = new Date().toISOString();
  // Expired claims could have reached the provider: reconciliation, never blind resend.
  const expired = await db.from('project_notification_outbox').update({status:'needs_reconciliation',last_error:'Worker claim expired; reconcile provider evidence before retry',updated_at:now}).eq('status','sending').lt('locked_at',new Date(Date.now()-10*60_000).toISOString());
  if(expired.error) throw expired.error;
  const evidenceRows=await db.from('project_notification_outbox').select('*').eq('status','provider_accepted').not('canonical_message_id','is',null).limit(limit);
  if(evidenceRows.error) throw evidenceRows.error;
  for(const row of evidenceRows.data || []) {
    const evidence=await db.from('email_messages').select('delivery_status,delivered_at,bounced_at,failed_at').eq('tenant_id',row.tenant_id).eq('id',row.canonical_message_id).maybeSingle();
    if(evidence.error) throw evidence.error;
    const status=evidence.data?.bounced_at?'bounced':evidence.data?.delivered_at?'delivered':evidence.data?.failed_at?'failed':null;
    if(status) {const saved=await db.from('project_notification_outbox').update({status,updated_at:now}).eq('tenant_id',row.tenant_id).eq('id',row.id);if(saved.error)throw saved.error;}
  }
  const selected = await db.from('project_notification_outbox').select('*').eq('status','queued').lte('next_attempt_at',now).order('created_at').limit(limit);
  if(selected.error) throw selected.error;
  const counts={accepted:0,suppressed:0,failed:0,reconciliation:0};
  for(const row of selected.data || []) {
    const claim=await db.from('project_notification_outbox').update({status:'sending',locked_at:now,attempts:row.attempts+1,updated_at:now}).eq('tenant_id',row.tenant_id).eq('id',row.id).eq('status','queued').select('id').maybeSingle();
    if(claim.error) throw claim.error;
    if(!claim.data)continue;
    let contactedProvider=false;
    const save=async(patch:Record<string,unknown>)=>{const result=await db.from('project_notification_outbox').update({...patch,updated_at:new Date().toISOString()}).eq('tenant_id',row.tenant_id).eq('id',row.id);if(result.error)throw result.error;};
    try {
      const results=await Promise.all([
        db.from('projects').select('*').eq('tenant_id',row.tenant_id).eq('id',row.project_id).is('deleted_at',null).maybeSingle(),
        db.from('tenants').select('settings').eq('id',row.tenant_id).maybeSingle(),
        db.from('tenant_notification_policies').select('categories').eq('tenant_id',row.tenant_id).maybeSingle(),
        db.from('project_activity').select('*').eq('tenant_id',row.tenant_id).eq('id',row.event_id).maybeSingle(),
      ]);
      for(const result of results)if(result.error)throw result.error;
      const project=results[0].data;const event=results[3].data;
      const reason=!project?'project_missing':projectNotificationSuppression(project,results[1].data?.settings,results[2].data?.categories,row.event_type);
      const copy=event?projectEventCopy(event):null;
      if(reason || !copy){await save({status:'suppressed',last_error:reason || 'not_a_client_event'});counts.suppressed++;continue;}
      const client=await db.from('business_clients').select('name,email,is_active').eq('tenant_id',row.tenant_id).eq('id',project.client_id || '00000000-0000-0000-0000-000000000000').maybeSingle();
      if(client.error)throw client.error;
      if(!client.data?.email || client.data.is_active===false){await save({status:'suppressed',last_error:'client_recipient_unavailable'});counts.suppressed++;continue;}
      const brand=await services.branding(row.tenant_id);
      if(brand.isPlatformFallback)throw new Error('Tenant branding is incomplete');
      const name=brand.brand.tradingName || brand.brand.legalCompanyName;
      const portal=project.portal_enabled && project.is_public && project.metadata?.client_visible===true && (!project.portal_expires_at || new Date(project.portal_expires_at).getTime()>Date.now()) && project.portal_token ? buildCanonicalProjectPortalUrl(project.portal_token):null;
      const intro=results[1].data?.settings?.project_notifications?.templates?.[row.event_type]?.body || copy!.body;
      const text=[`Hi ${client.data.name || 'there'},`,'',intro,`Project: ${project.name}`,`Status: ${project.status}`,project.due_date?`Expected completion: ${project.due_date}`:'',portal?`Client workspace: ${portal}`:'',brand.replyToEmail?`Contact us: ${brand.replyToEmail}`:'','Best regards,',name].filter(Boolean).join('\n');
      const subject=`${copy!.title} — ${name}`;
      contactedProvider=true;
      const sent=await services.send({tenantId:row.tenant_id,to:client.data.email,subject,text,html:text.split('\n').map(line=>`<p>${escapeHtml(line)}</p>`).join(''),fromName:name,replyTo:brand.replyToEmail,category:'transactional',templateName:`project_${row.event_type}`,idempotencyKey:`project-notification:${row.tenant_id}:${row.event_id}`,relatedRecord:{type:'project',id:row.project_id},initiationSource:'projects.transactional_notification'});
      if(!sent.success){await save({status:'needs_reconciliation',last_error:sent.error || 'Provider outcome unconfirmed'});counts.reconciliation++;continue;}
      await save({status:sent.deliveryStatus==='delivered' && sent.deliveredAt?'delivered':'provider_accepted',canonical_message_id:sent.canonicalMessageId || null,provider:sent.provider || null,provider_reference:sent.emailId || null,last_error:null});counts.accepted++;
    }catch(error){
      const message=error instanceof Error?error.message:String(error);
      const retry=!contactedProvider && row.attempts<4;
      await save({status:contactedProvider?'needs_reconciliation':retry?'queued':'failed',last_error:message,next_attempt_at:new Date(Date.now()+60_000*2**row.attempts).toISOString()});
      if(contactedProvider)counts.reconciliation++;else counts.failed++;
    }
  }
  return counts;
}

export async function enqueueProjectNotification(params: {
  db?: SupabaseClient;
  tenantId: string;
  projectId: string;
  eventType: string;
  action: string;
  payload?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  previousValue?: Record<string, unknown>;
}): Promise<{ eventId: string | null; outboxId: string | null; error?: string }> {
  const db = params.db || createSupabaseAdminClient();
  const now = new Date().toISOString();
  try {
    const activityInsert = await db
      .from('project_activity')
      .insert({
        tenant_id: params.tenantId,
        project_id: params.projectId,
        action: params.action,
        new_value: params.newValue || params.payload || {},
        previous_value: params.previousValue || null,
        created_at: now,
      })
      .select('id')
      .single();

    if (activityInsert.error) {
      return { eventId: null, outboxId: null, error: activityInsert.error.message };
    }

    const eventId = activityInsert.data.id;
    const outboxInsert = await db
      .from('project_notification_outbox')
      .insert({
        tenant_id: params.tenantId,
        project_id: params.projectId,
        event_id: eventId,
        event_type: params.eventType,
        status: 'queued',
        attempts: 0,
        next_attempt_at: now,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (outboxInsert.error) {
      return { eventId, outboxId: null, error: outboxInsert.error.message };
    }

    return { eventId, outboxId: outboxInsert.data.id };
  } catch (error) {
    return { eventId: null, outboxId: null, error: error instanceof Error ? error.message : String(error) };
  }
}

