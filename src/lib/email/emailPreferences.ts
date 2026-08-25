import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { EMAIL_PREFERENCE_CATEGORIES } from '@/lib/email/emailPurposeRegistry';

export type RecipientEmailPreferences = {
  email_enabled: boolean;
  marketing_enabled: boolean;
  outreach_enabled: boolean;
  newsletter_enabled: boolean;
  categories: Record<string, boolean>;
};

const DEFAULT_CATEGORIES = Object.fromEntries(
  EMAIL_PREFERENCE_CATEGORIES.map((c) => [c.key, true]),
) as Record<string, boolean>;

export async function getRecipientEmailPreferences(
  userId: string,
  tenantId: string,
): Promise<RecipientEmailPreferences> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('notification_preferences')
    .select('email_enabled, event_types')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const eventTypes = (data?.event_types && typeof data.event_types === 'object')
    ? data.event_types as Record<string, unknown>
    : {};

  const categories: Record<string, boolean> = { ...DEFAULT_CATEGORIES };
  for (const [key, value] of Object.entries(eventTypes)) {
    if (key.startsWith('email_category_') && typeof value === 'boolean') {
      categories[key.replace('email_category_', '')] = value;
    }
  }

  return {
    email_enabled: data?.email_enabled !== false,
    marketing_enabled: eventTypes.marketing !== false,
    outreach_enabled: eventTypes.outreach !== false,
    newsletter_enabled: eventTypes.newsletter !== false,
    categories,
  };
}

export async function isCategoryEmailEnabled(
  userId: string,
  tenantId: string,
  categoryKey: string,
): Promise<boolean> {
  const prefs = await getRecipientEmailPreferences(userId, tenantId);
  if (!prefs.email_enabled) return false;
  return prefs.categories[categoryKey] !== false;
}

export async function isMarketingGloballyEnabled(userId: string, tenantId: string): Promise<boolean> {
  const prefs = await getRecipientEmailPreferences(userId, tenantId);
  return prefs.email_enabled && prefs.marketing_enabled && prefs.outreach_enabled && prefs.newsletter_enabled;
}

export async function updateRecipientEmailPreferences(
  userId: string,
  tenantId: string,
  patch: Partial<RecipientEmailPreferences> & { unsubscribe_all_marketing?: boolean },
): Promise<RecipientEmailPreferences> {
  const admin = createSupabaseAdminClient();
  const existing = await getRecipientEmailPreferences(userId, tenantId);

  const eventTypes: Record<string, unknown> = {
    marketing: patch.unsubscribe_all_marketing === true ? false : (patch.marketing_enabled ?? existing.marketing_enabled),
    outreach: patch.unsubscribe_all_marketing === true ? false : (patch.outreach_enabled ?? existing.outreach_enabled),
    newsletter: patch.unsubscribe_all_marketing === true ? false : (patch.newsletter_enabled ?? existing.newsletter_enabled),
  };

  const mergedCategories = { ...existing.categories, ...(patch.categories || {}) };
  for (const [key, enabled] of Object.entries(mergedCategories)) {
    eventTypes[`email_category_${key}`] = patch.unsubscribe_all_marketing === true
      && !['account_security', 'invoices_payments', 'meetings'].includes(key)
      ? false
      : enabled;
  }

  const { error } = await admin.from('notification_preferences').upsert(
    {
      user_id: userId,
      tenant_id: tenantId,
      email_enabled: patch.unsubscribe_all_marketing === true ? existing.email_enabled : (patch.email_enabled ?? existing.email_enabled),
      event_types: eventTypes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,tenant_id' },
  );

  if (error) throw error;
  return getRecipientEmailPreferences(userId, tenantId);
}

/** Public (token-based) preferences for outreach recipients without login */
export async function getPublicEmailPreferences(
  tenantId: string,
  email: string,
): Promise<{ marketing: boolean; outreach: boolean; newsletter: boolean; categories: Record<string, boolean> }> {
  const admin = createSupabaseAdminClient();
  const normalized = email.trim().toLowerCase();
  const { data } = await admin
    .from('recipient_email_preferences')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('email', normalized)
    .maybeSingle();

  if (!data) {
    return { marketing: true, outreach: true, newsletter: true, categories: { ...DEFAULT_CATEGORIES } };
  }

  const meta = (data.metadata && typeof data.metadata === 'object') ? data.metadata as Record<string, unknown> : {};
  const categories = { ...DEFAULT_CATEGORIES };
  for (const [key, value] of Object.entries(meta)) {
    if (key.startsWith('category_') && typeof value === 'boolean') {
      categories[key.replace('category_', '')] = value;
    }
  }

  return {
    marketing: data.marketing !== false,
    outreach: data.outreach !== false,
    newsletter: data.newsletter !== false,
    categories,
  };
}

export async function updatePublicEmailPreferences(
  tenantId: string,
  email: string,
  patch: {
    marketing?: boolean;
    outreach?: boolean;
    newsletter?: boolean;
    categories?: Record<string, boolean>;
    unsubscribe_all_marketing?: boolean;
  },
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const normalized = email.trim().toLowerCase();
  const existing = await getPublicEmailPreferences(tenantId, normalized);

  const metadata: Record<string, unknown> = {};
  const categories = patch.unsubscribe_all_marketing
    ? Object.fromEntries(Object.keys(existing.categories).map((k) => [k, false]))
    : { ...existing.categories, ...(patch.categories || {}) };

  for (const [key, enabled] of Object.entries(categories)) {
    metadata[`category_${key}`] = enabled;
  }

  await admin.from('recipient_email_preferences').upsert(
    {
      tenant_id: tenantId,
      email: normalized,
      marketing: patch.unsubscribe_all_marketing ? false : (patch.marketing ?? existing.marketing),
      outreach: patch.unsubscribe_all_marketing ? false : (patch.outreach ?? existing.outreach),
      newsletter: patch.unsubscribe_all_marketing ? false : (patch.newsletter ?? existing.newsletter),
      metadata,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'tenant_id,email' },
  );
}
