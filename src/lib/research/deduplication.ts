/**
 * Deduplication Engine for Lead Discovery and Web Research.
 * Checks existing CRM leads, contacts, companies, and research records.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeBusinessName, normalizeDomain, normalizeEmail, normalizePhone } from './normalization';

export type DedupeCheckResult = {
  isDuplicate: boolean;
  duplicateReason?: string | null;
  matchedEntityId?: string | null;
  matchType?: 'crm_lead' | 'crm_contact' | 'crm_company' | 'staged_result' | 'batch_duplicate' | null;
};

export type DedupeTarget = {
  business_name?: string | null;
  website?: string | null;
  domain?: string | null;
  email?: string | null;
  phone?: string | null;
};

/**
 * Check an in-memory batch for intra-batch duplicate records.
 */
export function checkBatchDuplicate(
  candidate: DedupeTarget,
  seenKeys: Set<string>
): DedupeCheckResult {
  const normDomain = normalizeDomain(candidate.website || candidate.domain);
  const normEmail = normalizeEmail(candidate.email);
  const normPhone = normalizePhone(candidate.phone);
  const normName = normalizeBusinessName(candidate.business_name).toLowerCase();

  const keys: Array<{ key: string; reason: string }> = [];
  if (normDomain) keys.push({ key: `domain:${normDomain}`, reason: `domain match (${normDomain})` });
  if (normEmail) keys.push({ key: `email:${normEmail}`, reason: `email match (${normEmail})` });
  if (normPhone) keys.push({ key: `phone:${normPhone}`, reason: `phone match (${normPhone})` });
  if (normName && normName !== 'discovered business') {
    keys.push({ key: `name:${normName}`, reason: `business name match (${normName})` });
  }

  for (const { key, reason } of keys) {
    if (seenKeys.has(key)) {
      return {
        isDuplicate: true,
        duplicateReason: `Duplicate in current research batch: ${reason}`,
        matchType: 'batch_duplicate',
      };
    }
  }

  // Register keys for subsequent records in the batch
  for (const { key } of keys) {
    seenKeys.add(key);
  }

  return { isDuplicate: false };
}

/**
 * Check a candidate against existing CRM data (leads, contacts, companies) and staged results.
 */
export async function checkCrmDuplicate(
  supabase: SupabaseClient,
  tenantId: string,
  candidate: DedupeTarget
): Promise<DedupeCheckResult> {
  if (!tenantId) return { isDuplicate: false };

  const normDomain = normalizeDomain(candidate.website || candidate.domain);
  const normEmail = normalizeEmail(candidate.email);
  const normPhone = normalizePhone(candidate.phone);
  const normName = normalizeBusinessName(candidate.business_name);

  // 1. Check CRM leads by email, phone, or business name
  try {
    if (normEmail) {
      const { data: leadMatch } = await supabase
        .from('leads')
        .select('id, business_name, email')
        .eq('tenant_id', tenantId)
        .ilike('email', normEmail)
        .limit(1)
        .maybeSingle();

      if (leadMatch) {
        return {
          isDuplicate: true,
          duplicateReason: `Duplicate of existing CRM Lead (${leadMatch.business_name || leadMatch.id}): matching email ${normEmail}`,
          matchedEntityId: leadMatch.id,
          matchType: 'crm_lead',
        };
      }
    }

    if (normPhone) {
      const { data: leadPhoneMatch } = await supabase
        .from('leads')
        .select('id, business_name, phone')
        .eq('tenant_id', tenantId)
        .ilike('phone', `%${normPhone.slice(-8)}%`)
        .limit(1)
        .maybeSingle();

      if (leadPhoneMatch) {
        return {
          isDuplicate: true,
          duplicateReason: `Duplicate of existing CRM Lead (${leadPhoneMatch.business_name || leadPhoneMatch.id}): matching phone`,
          matchedEntityId: leadPhoneMatch.id,
          matchType: 'crm_lead',
        };
      }
    }

    // 2. Check CRM contacts by email
    if (normEmail) {
      const { data: contactMatch } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email')
        .eq('tenant_id', tenantId)
        .ilike('email', normEmail)
        .limit(1)
        .maybeSingle();

      if (contactMatch) {
        const contactName = [contactMatch.first_name, contactMatch.last_name].filter(Boolean).join(' ');
        return {
          isDuplicate: true,
          duplicateReason: `Duplicate of existing CRM Contact (${contactName || contactMatch.id}): matching email ${normEmail}`,
          matchedEntityId: contactMatch.id,
          matchType: 'crm_contact',
        };
      }
    }

    // 3. Check CRM companies by domain or name
    if (normDomain) {
      const { data: companyMatch } = await supabase
        .from('companies')
        .select('id, name, domain, website')
        .eq('tenant_id', tenantId)
        .or(`domain.ilike.%${normDomain}%,website.ilike.%${normDomain}%`)
        .limit(1)
        .maybeSingle();

      if (companyMatch) {
        return {
          isDuplicate: true,
          duplicateReason: `Duplicate of existing CRM Company (${companyMatch.name || companyMatch.id}): matching domain ${normDomain}`,
          matchedEntityId: companyMatch.id,
          matchType: 'crm_company',
        };
      }
    }

    // 4. Check previous staged research results
    if (normDomain) {
      const { data: stagedMatch } = await supabase
        .from('lead_research_results')
        .select('id, business_name, domain')
        .eq('tenant_id', tenantId)
        .eq('domain', normDomain)
        .limit(1)
        .maybeSingle();

      if (stagedMatch) {
        return {
          isDuplicate: true,
          duplicateReason: `Duplicate of previously researched business (${stagedMatch.business_name}): matching domain ${normDomain}`,
          matchedEntityId: stagedMatch.id,
          matchType: 'staged_result',
        };
      }
    }
  } catch {
    // If optional CRM tables are absent in an environment, fail open so research continues safely
  }

  return { isDuplicate: false };
}
