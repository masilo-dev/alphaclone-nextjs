import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { insertLeadWithSchemaCompat, type LeadInsertInput } from '@/lib/leads/insertLeadCompat';
import { isMissingColumnError } from '@/lib/mcp/schemaCompat';
import { isTerminalLeadStage, normalizeLeadPipelineStage } from '@/lib/crmPipelineStages';
import {
  normalizeCompanyName,
  normalizeContactName,
  normalizeDomain,
  normalizeEmail,
  normalizeExternalAccountId,
  normalizePhone,
  phoneLookupVariants,
} from '@/lib/crm/identityNormalize';
import { emitCrmDomainEvent } from '@/lib/crm/crmDomainEvents';

export type CRMIdentityInput = {
  business_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  company?: string | null;
  industry?: string | null;
  location?: string | null;
  notes?: string | null;
  linkedin_url?: string | null;
  external_id?: string | null;
  platform?: string | null;
  external_account_id?: string | null;
  owner_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type CRMIdentityMatchReason =
  | 'idempotency_replay'
  | 'external_id'
  | 'platform_account'
  | 'email'
  | 'phone'
  | 'domain_with_identity'
  | 'possible_fuzzy_name';

export type ResolveCRMIdentityResult = {
  contact_id: string | null;
  lead_id: string;
  company_id: string | null;
  created: boolean;
  matched_existing: boolean;
  possible_duplicate: boolean;
  match_reason: CRMIdentityMatchReason | null;
  source_added: string;
  dashboard_event_emitted: boolean;
  event_id: string | null;
};

type LeadRow = {
  id: string;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
  contact_name?: string | null;
  stage?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
  client_id?: string | null;
  website?: string | null;
  source?: string | null;
  deleted_at?: string | null;
};

function mergeMetadata(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | undefined,
  source: string,
): Record<string, unknown> {
  const base = { ...(existing || {}) };
  const sources = Array.isArray(base.identity_sources)
    ? [...(base.identity_sources as string[])]
    : base.original_source
      ? [String(base.original_source)]
      : [];
  if (!sources.includes(source)) sources.push(source);
  return {
    ...base,
    ...(incoming || {}),
    identity_sources: sources,
    original_source: base.original_source || source,
    latest_source: source,
    last_identity_match_at: new Date().toISOString(),
  };
}

async function findLeadByEmail(
  admin: SupabaseClient,
  tenantId: string,
  email: string,
): Promise<LeadRow | null> {
  const { data, error } = await admin
    .from('leads')
    .select('id, email, phone, business_name, contact_name, stage, status, metadata, client_id, website, source, deleted_at')
    .eq('tenant_id', tenantId)
    .ilike('email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error && !isMissingColumnError(error)) throw error;
  return (data as LeadRow | null) || null;
}

async function findLeadByPhone(
  admin: SupabaseClient,
  tenantId: string,
  phone: string,
): Promise<LeadRow | null> {
  const variants = phoneLookupVariants(phone);
  if (!variants.length) return null;

  for (const variant of variants) {
    const { data, error } = await admin
      .from('leads')
      .select('id, email, phone, business_name, contact_name, stage, status, metadata, client_id, website, source, deleted_at')
      .eq('tenant_id', tenantId)
      .eq('phone', variant)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error && !isMissingColumnError(error)) throw error;
    if (data) return data as LeadRow;
  }
  return null;
}

async function findLeadByExternalId(
  admin: SupabaseClient,
  tenantId: string,
  externalId: string,
): Promise<LeadRow | null> {
  const { data, error } = await admin
    .from('leads')
    .select('id, email, phone, business_name, contact_name, stage, status, metadata, client_id, website, source, deleted_at')
    .eq('tenant_id', tenantId)
    .eq('external_id', externalId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error && !isMissingColumnError(error)) throw error;
  return (data as LeadRow | null) || null;
}

async function findLeadByPlatformAccount(
  admin: SupabaseClient,
  tenantId: string,
  platform: string,
  accountId: string,
): Promise<LeadRow | null> {
  const { data: rows } = await admin
    .from('leads')
    .select('id, email, phone, business_name, contact_name, stage, status, metadata, client_id, website, source, deleted_at')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('metadata', 'is', null)
    .limit(500);

  for (const row of rows || []) {
    const identities = (row.metadata as Record<string, unknown>)?.external_identities;
    if (!Array.isArray(identities)) continue;
    if (identities.some((item) =>
      item &&
      typeof item === 'object' &&
      (item as { platform?: string; external_id?: string }).platform === platform &&
      (item as { platform?: string; external_id?: string }).external_id === accountId,
    )) {
      return row as LeadRow;
    }
  }
  return null;
}

async function findLeadByDomainWithIdentity(
  admin: SupabaseClient,
  tenantId: string,
  domain: string,
  email: string | null,
  phone: string | null,
): Promise<LeadRow | null> {
  if (!email && !phone) return null;
  const { data, error } = await admin
    .from('leads')
    .select('id, email, phone, business_name, contact_name, stage, status, metadata, client_id, website, source, deleted_at')
    .eq('tenant_id', tenantId)
    .ilike('website', `%${domain}%`)
    .is('deleted_at', null)
    .limit(20);
  if (error) return null;
  for (const row of data || []) {
    const rowEmail = normalizeEmail(row.email);
    const rowPhone = normalizePhone(row.phone);
    if (email && rowEmail === email) return row as LeadRow;
    if (phone && rowPhone && rowPhone === phone) return row as LeadRow;
  }
  return null;
}

async function appendIdentityActivity(
  admin: SupabaseClient,
  tenantId: string,
  leadId: string,
  userId: string | null | undefined,
  source: string,
  matchReason: CRMIdentityMatchReason,
): Promise<void> {
  try {
    await admin.from('activity_logs').insert({
      tenant_id: tenantId,
      user_id: userId || null,
      action: 'crm_identity_matched',
      entity_type: 'lead',
      entity_id: leadId,
      metadata: { source, match_reason: matchReason },
    });
  } catch {
    /* non-blocking */
  }
}

async function updateMatchedLead(
  admin: SupabaseClient,
  tenantId: string,
  existing: LeadRow,
  input: CRMIdentityInput,
  source: string,
  userId?: string | null,
  matchReason: CRMIdentityMatchReason = 'email',
): Promise<LeadRow> {
  const now = new Date().toISOString();
  const metadata = mergeMetadata(existing.metadata, input.metadata, source);
  const platform = input.platform?.trim();
  const externalAccountId = normalizeExternalAccountId(input.external_account_id);
  if (platform && externalAccountId) {
    const identities = Array.isArray(metadata.external_identities)
      ? [...(metadata.external_identities as Array<{ platform: string; external_id: string }>)]
      : [];
    if (!identities.some((item) => item.platform === platform && item.external_id === externalAccountId)) {
      identities.push({ platform, external_id: externalAccountId });
    }
    metadata.external_identities = identities;
  }

  const patch: Record<string, unknown> = {
    updated_at: now,
    last_activity_at: now,
    metadata,
  };
  if (!existing.contact_name && input.contact_name) patch.contact_name = input.contact_name;
  if (!existing.email && input.email) patch.email = normalizeEmail(input.email);
  if (!existing.phone && input.phone) patch.phone = normalizePhone(input.phone);
  if (!existing.website && input.website) patch.website = input.website;
  if (input.notes) patch.notes = input.notes;

  let updateResult = await admin
    .from('leads')
    .update(patch)
    .eq('id', existing.id)
    .eq('tenant_id', tenantId)
    .select('id, email, phone, business_name, contact_name, stage, status, metadata, client_id, website, source')
    .single();

  if (updateResult.error && isMissingColumnError(updateResult.error)) {
    const { last_activity_at: _a, updated_at: _b, ...fallbackPatch } = patch;
    updateResult = await admin
      .from('leads')
      .update(fallbackPatch)
      .eq('id', existing.id)
      .eq('tenant_id', tenantId)
      .select('id, email, phone, business_name, contact_name, stage, status, metadata, client_id, website, source')
      .single();
  }

  await appendIdentityActivity(admin, tenantId, existing.id, userId, source, matchReason);
  return (updateResult.data as LeadRow) || existing;
}

/**
 * Single entry point for all CRM lead/contact identity resolution.
 * Deterministic matching: email → phone → platform account → domain+identity.
 * Never auto-merges on name alone.
 */
export async function resolveOrCreateCRMIdentity(
  input: CRMIdentityInput,
  tenantId: string,
  source: string,
  options?: {
    userId?: string | null;
    supabase?: SupabaseClient;
    idempotencyKey?: string | null;
    skipOnLeadCreated?: boolean;
  },
): Promise<ResolveCRMIdentityResult> {
  const admin = options?.supabase ?? createSupabaseAdminClient();
  const userId = options?.userId ?? null;
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);
  const normalizedDomain = normalizeDomain(input.website);
  const externalId = normalizeExternalAccountId(input.external_id);
  const platform = input.platform?.trim() || null;
  const platformAccountId = normalizeExternalAccountId(input.external_account_id);
  const primaryName =
    normalizeContactName(input.business_name) ||
    normalizeContactName(input.company) ||
    normalizeContactName(input.contact_name) ||
    normalizedEmail ||
    normalizedPhone ||
    'Unknown';

  if (options?.idempotencyKey) {
    const { findReceiptByIdempotency } = await import('@/lib/mcp/actionReceipts');
    const prior = await findReceiptByIdempotency({
      tenantId,
      tool: 'create_lead',
      idempotencyKey: options.idempotencyKey,
    });
    if (prior?.entity_id) {
      const event = await emitCrmDomainEvent({
        tenantId,
        eventType: 'crm.lead.matched',
        aggregateType: 'lead',
        aggregateId: String(prior.entity_id),
        payload: { idempotency_replay: true, source },
        actorId: userId || undefined,
        actorType: 'mcp',
      });
      return {
        contact_id: null,
        lead_id: String(prior.entity_id),
        company_id: null,
        created: false,
        matched_existing: true,
        possible_duplicate: false,
        match_reason: 'idempotency_replay',
        source_added: source,
        dashboard_event_emitted: Boolean(event.id),
        event_id: event.id || null,
      };
    }
  }

  let matched: LeadRow | null = null;
  let matchReason: CRMIdentityMatchReason | null = null;
  let possibleDuplicate = false;

  if (externalId) {
    matched = await findLeadByExternalId(admin, tenantId, externalId);
    if (matched) matchReason = 'external_id';
  }

  if (!matched && platform && platformAccountId) {
    matched = await findLeadByPlatformAccount(admin, tenantId, platform, platformAccountId);
    if (matched) matchReason = 'platform_account';
  }

  if (!matched && normalizedEmail) {
    matched = await findLeadByEmail(admin, tenantId, normalizedEmail);
    if (matched) matchReason = 'email';
  }

  if (!matched && normalizedPhone) {
    matched = await findLeadByPhone(admin, tenantId, normalizedPhone);
    if (matched) matchReason = 'phone';
  }

  if (!matched && normalizedDomain && (normalizedEmail || normalizedPhone)) {
    matched = await findLeadByDomainWithIdentity(
      admin,
      tenantId,
      normalizedDomain,
      normalizedEmail,
      normalizedPhone,
    );
    if (matched) matchReason = 'domain_with_identity';
  }

  if (!matched && primaryName && primaryName !== 'Unknown') {
    const companyKey = normalizeCompanyName(input.business_name || input.company);
    if (companyKey) {
      const { data: nameCandidates } = await admin
        .from('leads')
        .select('id, business_name')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .ilike('business_name', `%${companyKey.slice(0, Math.min(companyKey.length, 20))}%`)
        .limit(3);
      if (nameCandidates?.length) possibleDuplicate = true;
    }
  }

  if (matched) {
    const stage = normalizeLeadPipelineStage(matched.stage);
    if (isTerminalLeadStage(stage)) {
      // Preserve lifecycle stage — do not reset won/lost leads
    }
    await updateMatchedLead(admin, tenantId, matched, input, source, userId, matchReason || 'email');
    const event = await emitCrmDomainEvent({
      tenantId,
      eventType: 'crm.lead.matched',
      aggregateType: 'lead',
      aggregateId: matched.id,
      payload: {
        source,
        match_reason: matchReason,
        possible_duplicate: possibleDuplicate,
      },
      actorId: userId || undefined,
      actorType: userId ? 'mcp' : 'system',
    });
    return {
      contact_id: null,
      lead_id: matched.id,
      company_id: matched.client_id || null,
      created: false,
      matched_existing: true,
      possible_duplicate: possibleDuplicate,
      match_reason: matchReason,
      source_added: source,
      dashboard_event_emitted: Boolean(event.id),
      event_id: event.id || null,
    };
  }

  const insertInput: LeadInsertInput = {
    tenant_id: tenantId,
    owner_id: input.owner_id ?? userId,
    business_name: String(primaryName),
    contact_name: normalizeContactName(input.contact_name),
    email: normalizedEmail,
    phone: normalizedPhone,
    industry: input.industry || null,
    location: input.location || null,
    source,
    notes: input.notes || null,
    linkedin_url: input.linkedin_url || null,
    status: 'new',
    stage: 'lead',
  };

  const metadata: Record<string, unknown> = {
    ...(input.metadata || {}),
    identity_sources: [source],
    original_source: source,
    latest_source: source,
    possible_duplicate: possibleDuplicate,
  };
  if (externalId) metadata.external_id = externalId;
  if (platform && platformAccountId) {
    metadata.external_identities = [{ platform, external_id: platformAccountId }];
  }

  const { data, error } = await insertLeadWithSchemaCompat(admin, insertInput);

  if (error) throw error;
  if (!data?.id) throw new Error('Lead insert returned no id');

  const leadId = String((data as { id: string }).id);

  const postInsert: Record<string, unknown> = {
    metadata,
    updated_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
  };
  if (externalId) postInsert.external_id = externalId;

  let patchResult = await admin.from('leads').update(postInsert).eq('id', leadId).eq('tenant_id', tenantId);
  if (patchResult.error && isMissingColumnError(patchResult.error)) {
    const { last_activity_at: _l, ...withoutActivity } = postInsert;
    patchResult = await admin.from('leads').update(withoutActivity).eq('id', leadId).eq('tenant_id', tenantId);
  }

  if (!options?.skipOnLeadCreated) {
    const { onLeadCreated } = await import('@/lib/leads/leadOnCreated');
    try {
      await onLeadCreated({
        tenantId,
        leadId,
        userId: userId || 'system',
        businessName: String(primaryName),
        isNewLead: true,
      });
    } catch (hookErr) {
      console.warn('[resolveOrCreateCRMIdentity] onLeadCreated:', hookErr);
    }
  }

  const event = await emitCrmDomainEvent({
    tenantId,
    eventType: 'crm.lead.created',
    aggregateType: 'lead',
    aggregateId: leadId,
    payload: {
      source,
      possible_duplicate: possibleDuplicate,
      business_name: primaryName,
    },
    actorId: userId || undefined,
    actorType: userId ? 'mcp' : 'system',
  });

  return {
    contact_id: null,
    lead_id: leadId,
    company_id: null,
    created: true,
    matched_existing: false,
    possible_duplicate: possibleDuplicate,
    match_reason: null,
    source_added: source,
    dashboard_event_emitted: Boolean(event.id),
    event_id: event.id || null,
  };
}
