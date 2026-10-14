-- One service-role-only transaction. No historical evidence is rewritten.
create or replace function public.record_contract_signature_atomic(p_request jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_token public.contract_signing_tokens%rowtype;
  v_contract public.contracts%rowtype;
  v_party public.contract_parties%rowtype;
  v_old_event public.signature_events%rowtype;
  v_contract_id uuid := nullif(p_request->>'contractId','')::uuid;
  v_actor uuid := nullif(p_request->>'userId','')::uuid;
  v_role text := p_request->>'role';
  v_email text := lower(btrim(coalesce(p_request->>'signerEmail','')));
  v_name text := btrim(coalesce(p_request->>'signerName',''));
  v_signature text := p_request->>'signatureDataUrl';
  v_now timestamptz := clock_timestamp();
  v_event_id uuid := gen_random_uuid();
  v_hash text; v_seal text; v_content text; v_status text;
  v_required integer; v_pending integer; v_party_count integer;
  v_existing_signature text; v_existing_time timestamptz;
begin
  if coalesce((p_request->>'consentGiven')::boolean,false) is not true then
    raise exception 'Electronic signature consent is required';
  end if;
  if v_email = '' or v_name = '' or v_signature is null or length(v_signature) = 0 or length(v_signature) > 2000000 then
    raise exception 'Valid signer identity and signature evidence are required';
  end if;
  if nullif(p_request->>'signingToken','') is not null then
    -- Discover context without a claim; contract lock serializes all its signing links.
    select * into v_token from public.contract_signing_tokens where token = p_request->>'signingToken';
    if not found then raise exception 'Invalid signing token'; end if;
    v_contract_id := v_token.contract_id; v_role := v_token.signer_role;
  end if;
  if v_role not in ('client','admin') or v_role is null then raise exception 'Invalid signer role'; end if;
  select * into v_contract from public.contracts where id = v_contract_id for update;
  if not found then raise exception 'Contract not found'; end if;
  if nullif(p_request->>'expectedTenantId','') is not null and v_contract.tenant_id is distinct from (p_request->>'expectedTenantId')::uuid then
    raise exception 'Signing link does not belong to this contract tenant';
  end if;
  if v_token.id is not null then
    select * into v_token from public.contract_signing_tokens where id = v_token.id for update;
    v_now := clock_timestamp();
    if v_token.tenant_id is distinct from v_contract.tenant_id or v_token.contract_id is distinct from v_contract.id then
      raise exception 'Signing token tenant mismatch';
    end if;
    if v_token.revoked_at is not null then raise exception 'Signing link revoked'; end if;
    if v_token.expires_at <= v_now then raise exception 'Signing link expired'; end if;
    if lower(btrim(v_token.signer_email)) <> v_email then raise exception 'Signer email does not match this signing link'; end if;
    if coalesce((v_token.metadata->>'review_only')::boolean,false) then raise exception 'This draft is for review only. Signature is not permitted.'; end if;
  elsif v_actor is null then
    raise exception 'Authenticated signer or signing token is required';
  else
    -- Actor id/email come only from the server's verified JWT. This service-role-only
    -- invoker must not receive broad SELECT privileges on auth.users.
    if v_role = 'admin' and not exists(select 1 from public.tenant_users where tenant_id=v_contract.tenant_id and user_id=v_actor and role in ('owner','admin','tenant_admin','super_admin')) then
      raise exception 'Authenticated signer is not an authorized tenant administrator';
    end if;
  end if;
  if v_contract.status in ('rejected','expired','void') then raise exception 'Contract is not available for signing'; end if;
  if jsonb_typeof(v_contract.content) is distinct from 'string' then raise exception 'Contract content must be a canonical text document before signing'; end if;
  v_content := v_contract.content #>> '{}';
  v_hash := encode(sha256(convert_to(v_content,'UTF8')),'hex');
  if nullif(v_contract.metadata->>'content_hash','') is not null and v_contract.metadata->>'content_hash' <> v_hash then
    raise exception 'Contract content integrity check failed';
  end if;
  select count(*) into v_party_count from public.contract_parties where tenant_id=v_contract.tenant_id and contract_id=v_contract.id and lower(btrim(party_snapshot->>'email'))=v_email;
  if v_party_count > 1 then raise exception 'Ambiguous signer party requires reconciliation'; end if;
  select * into v_party from public.contract_parties where tenant_id=v_contract.tenant_id and contract_id=v_contract.id and lower(btrim(party_snapshot->>'email'))=v_email for update;
  if v_party.id is not null and ((v_role='client' and v_party.role not in ('client','customer','counterparty','buyer')) or (v_role='admin' and v_party.role not in ('provider','admin','owner','supplier','service_provider'))) then
    raise exception 'Signing role does not match the agreement party';
  end if;
  if v_party.id is null and exists(select 1 from public.contract_parties where tenant_id=v_contract.tenant_id and contract_id=v_contract.id and signature_required) then
    raise exception 'Signer is not an authorized party to this agreement';
  end if;
  if v_actor is not null and v_role='client' and v_party.id is null and lower(coalesce(v_contract.metadata->>'client_email','')) <> v_email then
    raise exception 'Authenticated signer is not an authorized party to this agreement';
  end if;
  -- Replay only an identical, recorded signature with the same validated identity.
  select * into v_old_event from public.signature_events where contract_id=v_contract.id and event_type='signature_completed' and lower(signer_email)=v_email and signer_role=v_role order by created_at desc limit 1;
  if v_old_event.id is not null then
    if v_old_event.signature_data=v_signature and v_old_event.signer_name=v_name and
       ((v_token.id is not null and v_token.used_at is not null and v_old_event.device_info->>'signing_token_id'=v_token.id::text) or
        (v_token.id is null and v_old_event.signer_id=v_actor)) then
      return jsonb_build_object('contract',to_jsonb(v_contract),'replayed',true,'signature_event_id',v_old_event.id);
    end if;
    raise exception 'This party has already signed. Existing signature evidence cannot be replaced.';
  end if;
  if v_token.used_at is not null then raise exception 'Signing link already used; evidence requires reconciliation'; end if;
  v_existing_signature := case when v_role='client' then v_contract.client_signature else v_contract.admin_signature end;
  v_existing_time := case when v_role='client' then v_contract.client_signed_at else v_contract.admin_signed_at end;
  if (v_existing_signature is not null or v_existing_time is not null) and not exists(select 1 from public.signature_events where contract_id=v_contract.id and signer_role=v_role and event_type='signature_completed') then
    raise exception 'Existing signature evidence requires reconciliation before this party can sign';
  end if;
  if v_party.signature_status='signed' or (v_party.id is null and (v_existing_signature is not null or v_existing_time is not null)) or v_contract.status in ('fully_signed','signed') then
    raise exception 'This party has already signed. Existing signature evidence cannot be replaced.';
  end if;
  if v_contract.status not in ('sent','client_signed') then raise exception 'Contract is not available for signing'; end if;
  if exists(select 1 from public.contract_parties where tenant_id=v_contract.tenant_id and contract_id=v_contract.id and signature_required and signing_order<v_party.signing_order and signature_status<>'signed') then
    raise exception 'An earlier signer must complete their signature first';
  end if;
  v_seal := encode(sha256(convert_to(v_event_id::text || '|' || v_hash || '|' || v_email || '|' || v_now::text,'UTF8')),'hex');
  insert into public.signature_events(id,contract_id,signer_id,signer_role,signer_name,signer_email,signer_ip,event_type,signature_data,authentication_method,intent_statement,device_info,content_hash_at_signing,tamper_seal,created_at)
  values(v_event_id,v_contract.id,v_actor,v_role,v_name,v_email,p_request->>'ipAddress','signature_completed',v_signature,case when v_actor is null then 'email_token' else 'session' end,
    'I, ' || v_name || ', intend to sign this document and agree to be legally bound by its terms.',
    jsonb_build_object('user_agent',p_request->>'userAgent','timestamp',v_now,'signing_token_id',v_token.id),v_hash,v_seal,v_now);
  insert into public.esignature_consents(user_id,contract_id,consent_given,consent_text,consent_method,ip_address,user_agent,created_at)
  values(v_actor,v_contract.id,true,'Electronic Signature Disclosure and Consent accepted at time of signing.','checkbox',p_request->>'ipAddress',p_request->>'userAgent',v_now);
  insert into public.contract_signature_events(tenant_id,contract_id,party_id,event_type,signer_email,signing_order,provider,provider_event_id,ip_address,user_agent,document_hash,evidence,occurred_at)
  values(v_contract.tenant_id,v_contract.id,v_party.id,'signed',v_email,v_party.signing_order,'bonnie_esign',v_event_id::text,nullif(p_request->>'ipAddress','')::inet,p_request->>'userAgent',v_hash,
    jsonb_build_object('signature_event_id',v_event_id,'authentication_method',case when v_actor is null then 'email_token' else 'session' end,'consent_given',true,'tamper_seal',v_seal),v_now);
  if v_party.id is not null then
    update public.contract_parties set signature_status='signed' where id=v_party.id and tenant_id=v_contract.tenant_id;
  end if;
  select count(*),count(*) filter(where signature_status<>'signed') into v_required,v_pending from public.contract_parties where tenant_id=v_contract.tenant_id and contract_id=v_contract.id and signature_required;
  v_status := case when v_required>0 then case when v_pending=0 then 'fully_signed' else 'sent' end
    when v_role='client' then case when v_contract.admin_signature is not null then 'fully_signed' else 'client_signed' end
    else case when v_contract.client_signature is not null then 'fully_signed' else 'sent' end end;
  update public.contracts set
    client_signature=case when v_role='client' then coalesce(client_signature,v_signature) else client_signature end,
    client_signed_at=case when v_role='client' then coalesce(client_signed_at,v_now) else client_signed_at end,
    admin_signature=case when v_role='admin' then coalesce(admin_signature,v_signature) else admin_signature end,
    admin_signed_at=case when v_role='admin' then coalesce(admin_signed_at,v_now) else admin_signed_at end,
    status=v_status,lifecycle_status=case when v_status='fully_signed' then 'signed' else 'sent' end,
    metadata=coalesce(metadata,'{}') || jsonb_build_object('content_hash',v_hash,'last_signing_ip',p_request->>'ipAddress','history',coalesce(metadata->'history','[]') || jsonb_build_array(jsonb_build_object('action','signed_by_'||v_role,'sub',coalesce(v_actor::text,'external_signer'),'ts',v_now))),updated_at=v_now
    where id=v_contract.id and tenant_id=v_contract.tenant_id returning * into v_contract;
  insert into public.contract_audit_trail(contract_id,action,actor_id,actor_role,actor_name,actor_email,ip_address,user_agent,details,created_at)
  values(v_contract.id,'signature_completed',v_actor,v_role,v_name,v_email,p_request->>'ipAddress',p_request->>'userAgent',jsonb_build_object('tenant_id',v_contract.tenant_id,'signature_event_id',v_event_id,'status',v_status),v_now);
  if v_token.id is not null then
    update public.contract_signing_tokens set used_at=v_now,metadata=metadata || jsonb_build_object('signature_event_id',v_event_id,'signed_at',v_now) where id=v_token.id;
  end if;
  return jsonb_build_object('contract',to_jsonb(v_contract),'replayed',false,'signature_event_id',v_event_id);
end;
$$;
revoke all on function public.record_contract_signature_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.record_contract_signature_atomic(jsonb) to service_role;
