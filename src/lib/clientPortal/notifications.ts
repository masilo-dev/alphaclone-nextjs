import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { escapeHtml } from '@/lib/email/escapeHtml';
import { AppUrls, buildValidatedPublicUrl } from '@/lib/urls';

export async function loadMessageProject(admin:SupabaseClient,tenantId:string,projectId:string) {
  const results=await Promise.all(['projects','business_projects'].map(table=>admin.from(table).select('*').eq('tenant_id',tenantId).eq('id',projectId).maybeSingle()));
  for(const result of results) if(result.error && !['42P01','PGRST205'].includes(result.error.code)) throw result.error;
  return results.map(result=>result.data).find(row=>row && !row.deleted_at) || null;
}
/** Notifications accompany a persisted conversation; provider acceptance is not inbox delivery. */
export async function notifyPortalProjectMessage(input:{admin:SupabaseClient;tenantId:string;projectId:string;messageId:string;content:string;authorName:string;direction:'to_creator'|'to_client'}) {
  const {admin,tenantId,projectId,messageId,content,authorName,direction}=input;
  const project=await loadMessageProject(admin,tenantId,projectId);
  if(!project)return {sent:false,error:'project_not_found'};
  let email:string|undefined;let url:string;
  if(direction==='to_creator') {
    let recipientId=project.created_by || project.owner_id;
    if(!recipientId){const result=await admin.from('tenants').select('owner_id').eq('id',tenantId).maybeSingle();if(result.error)throw result.error;recipientId=result.data?.owner_id;}
    if(!recipientId)return {sent:false,error:'project_creator_not_configured'};
    const result=await admin.from('profiles').select('email').eq('id',recipientId).maybeSingle();if(result.error)throw result.error;
    email=result.data?.email;
    url=`${buildValidatedPublicUrl('/dashboard/business/projects/manage')}?project=${encodeURIComponent(projectId)}`;
  } else {
    if(!project.client_id)return {sent:false,error:'project_client_not_configured'};
    const result=await admin.from('business_clients').select('email,finance_portal_token,is_active').eq('tenant_id',tenantId).eq('id',project.client_id).maybeSingle();if(result.error)throw result.error;
    if(!result.data || result.data.is_active===false)return {sent:false,error:'client_inactive_or_missing'};
    email=result.data.email;
    url=result.data.finance_portal_token ? AppUrls.clientFinancePortal(result.data.finance_portal_token) : buildValidatedPublicUrl('/portal-login');
  }
  if(!email)return {sent:false,error:direction==='to_creator'?'project_creator_email_missing':'client_email_missing'};
  const result=await sendEmailServer({tenantId,to:email,category:'transactional',idempotencyKey:`portal-project-message:${messageId}:${direction}`,templateName:'projectConversationMessage',fromName:authorName,
    subject:`New message: ${project.name || 'Project'}`,
    html:`<p>${escapeHtml(authorName)} sent a message about ${escapeHtml(project.name || 'your project')}:</p><blockquote>${escapeHtml(content).replace(/\n/g,'<br/>')}</blockquote><p><a href="${escapeHtml(url)}">Open the conversation to reply</a></p>`,
    text:`${authorName} sent a message about ${project.name || 'your project'}:\n\n${content}\n\nOpen the conversation to reply: ${url}`});
  return {sent:result.success,error:result.error};
}
