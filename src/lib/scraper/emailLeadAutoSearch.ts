import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { extractEmailAddress } from '@/lib/email/parseEmailHeader';
import { shouldProxyHeavyWorkToRailway } from '@/config/railwayWorkload';
import { callScraperService } from '@/lib/scraper/scraperServiceClient';

export type EmailContextMatch = {
  type: 'crm_lead' | 'contact' | 'scraper_lead' | 'account';
  id: string;
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  status?: string;
  score?: number;
  href: string;
};

export type EmailContextResult = {
  email: string;
  domain: string;
  senderName?: string;
  matches: EmailContextMatch[];
  suggestedActions: Array<{ label: string; href: string }>;
  enrichmentQueued: boolean;
};

function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  return at > 0 ? email.slice(at + 1).toLowerCase() : '';
}

function isPersonalDomain(domain: string): boolean {
  const personal = new Set([
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'icloud.com',
    'aol.com',
    'proton.me',
    'protonmail.com',
  ]);
  return personal.has(domain);
}

export async function searchEmailContext(
  tenantId: string,
  rawFrom: string,
  options: { subject?: string; queueEnrichment?: boolean } = {}
): Promise<EmailContextResult> {
  const email = extractEmailAddress(rawFrom);
  const domain = emailDomain(email);
  const senderName = rawFrom.replace(/<[^>]+>/, '').trim() || undefined;
  const matches: EmailContextMatch[] = [];
  const supabase = createSupabaseAdminClient();

  if (!email.includes('@')) {
    return { email, domain, senderName, matches: [], suggestedActions: [], enrichmentQueued: false };
  }

  const domainPattern = domain && !isPersonalDomain(domain) ? `%@${domain}` : null;

  const [leadsRes, contactsRes, scraperRes, accountsRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, contact_name, email, business_name, phone, status, lead_score')
      .eq('tenant_id', tenantId)
      .or(
        domainPattern
          ? `email.ilike.${email},email.ilike.${domainPattern}`
          : `email.ilike.${email}`
      )
      .limit(8),
    supabase
      .from('contacts')
      .select('id, first_name, last_name, full_name, email, phone, custom_fields')
      .eq('tenant_id', tenantId)
      .or(
        domainPattern
          ? `email.ilike.${email},email.ilike.${domainPattern}`
          : `email.ilike.${email}`
      )
      .limit(8),
    supabase
      .from('scraper_leads')
      .select('id, name, email, company, phone, status, score')
      .eq('tenant_id', tenantId)
      .or(
        domainPattern
          ? `email.ilike.${email},email.ilike.${domainPattern}`
          : `email.ilike.${email}`
      )
      .limit(8),
    !isPersonalDomain(domain)
      ? supabase
          .from('accounts')
          .select('id, name, website, industry')
          .eq('tenant_id', tenantId)
          .ilike('website', `%${domain}%`)
          .limit(4)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const row of leadsRes.data || []) {
    matches.push({
      type: 'crm_lead',
      id: row.id,
      name: row.contact_name,
      email: row.email,
      company: row.business_name,
      phone: row.phone,
      status: row.status,
      score: row.lead_score,
      href: `/dashboard/leads?id=${row.id}`,
    });
  }

  for (const row of contactsRes.data || []) {
    const name = [row.first_name, row.last_name].filter(Boolean).join(' ');
    matches.push({
      type: 'contact',
      id: row.id,
      name: name || undefined,
      email: row.email,
      company: row.company,
      phone: row.phone,
      href: `/dashboard/contacts?id=${row.id}`,
    });
  }

  for (const row of scraperRes.data || []) {
    matches.push({
      type: 'scraper_lead',
      id: row.id,
      name: row.name,
      email: row.email,
      company: row.company,
      phone: row.phone,
      status: row.status,
      score: row.score,
      href: `/dashboard/leads/campaigns?lead=${row.id}`,
    });
  }

  for (const row of accountsRes.data || []) {
    matches.push({
      type: 'account',
      id: row.id,
      name: row.name,
      company: row.name,
      href: `/dashboard/crm/accounts?id=${row.id}`,
    });
  }

  const suggestedActions: EmailContextResult['suggestedActions'] = [];

  if (matches.length === 0) {
    const query = encodeURIComponent(
      domain && !isPersonalDomain(domain) ? domain : email
    );
    suggestedActions.push({
      label: 'Find similar SMB leads',
      href: `/dashboard/leads/campaigns?q=${query}`,
    });
  }

  suggestedActions.push({
    label: 'Open Lead Finder Chat',
    href: '/dashboard/leads/campaigns',
  });

  let enrichmentQueued = false;
  if (
    options.queueEnrichment &&
    shouldProxyHeavyWorkToRailway() &&
    domain &&
    !isPersonalDomain(domain) &&
    matches.length === 0
  ) {
    try {
      await callScraperService('/enrich/domain', {
        method: 'POST',
        body: { tenant_id: tenantId, domain, email, subject: options.subject },
      });
      enrichmentQueued = true;
    } catch {
      // Railway enrich is best-effort; CRM search still returned
    }
  }

  return { email, domain, senderName, matches, suggestedActions, enrichmentQueued };
}
