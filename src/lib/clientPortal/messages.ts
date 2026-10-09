import type { SupabaseClient } from '@supabase/supabase-js';
/** Persist once, then acknowledge. A retry reuses the same UUID and cannot resend. */
export async function persistPortalMessage(admin: SupabaseClient, input: {
  id: string; tenantId: string; clientId: string; projectId?: string | null;
  content: string; authorName: string; authorEmail?: string | null; isClient: boolean;
}) {
  const project = Boolean(input.projectId);
  const table = project ? 'project_comments' : 'client_portal_events';
  const lookup = () => {
    let query = admin.from(table).select('*').eq('tenant_id',input.tenantId).eq('id',input.id);
    query = project ? query.eq('project_id',input.projectId!) : query.eq('client_id',input.clientId).eq('event_type','portal_message_sent');
    return query.maybeSingle();
  };
  const verify = (row:any) => {
    const content = project ? row.content : row.metadata?.content;
    const isClient = project ? row.is_client : row.metadata?.is_client;
    if (content !== input.content || isClient !== input.isClient) throw Object.assign(new Error('This request reference was already used for another message.'),{status:409});
    return {message:row,replayed:true};
  };
  const prior = await lookup(); if (prior.error) throw prior.error; if (prior.data) return verify(prior.data);
  const payload = project ? {id:input.id,tenant_id:input.tenantId,project_id:input.projectId,author_name:input.authorName,author_email:input.authorEmail || null,content:input.content,is_client:input.isClient} : {id:input.id,tenant_id:input.tenantId,client_id:input.clientId,event_type:'portal_message_sent',metadata:{kind:'general_message',content:input.content,author_name:input.authorName,is_client:input.isClient}};
  const saved = await admin.from(table).insert(payload).select('*').single();
  if (saved.error?.code === '23505') { const concurrent = await lookup(); if (concurrent.data) return verify(concurrent.data); }
  if (saved.error) throw saved.error;
  return {message:saved.data,replayed:false};
}
