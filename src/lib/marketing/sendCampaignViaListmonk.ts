import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { hasRecipientMarketingConsent } from '@/lib/email/marketingConsent';
import { changeListmonkCampaignStatus } from '@/lib/marketing/listmonkClient';
import {
  createMappedListmonkCampaign,
  ensureListmonkList,
  syncListmonkSubscriber,
} from '@/lib/marketing/listmonkIntegration';

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function sendCampaignViaListmonk(input: {
  tenantId: string;
  campaignId: string;
}): Promise<{ success: boolean; error: string | null; listmonkCampaignId?: number }> {
  const admin = createSupabaseAdminClient();

  try {
    const { data: campaign, error: campaignError } = await admin
      .from('email_campaigns')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.campaignId)
      .maybeSingle();
    if (campaignError) throw campaignError;
    if (!campaign) return { success: false, error: 'Campaign not found' };

    const { data: recipients, error: recipientError } = await admin
      .from('campaign_recipients')
      .select('id, contact_id, email, metadata')
      .eq('tenant_id', input.tenantId)
      .eq('campaign_id', input.campaignId)
      .eq('status', 'pending');
    if (recipientError) throw recipientError;
    if (!recipients?.length) return { success: false, error: 'No pending recipients on this campaign' };

    const metadata = objectValue(campaign.metadata);
    const bodyHtml = String(
      metadata.bodyHtml || campaign.body_html || campaign.html_content || campaign.content || ''
    ).trim();
    if (!bodyHtml) return { success: false, error: 'Campaign body is empty' };

    const list = await ensureListmonkList(admin, {
      tenantId: input.tenantId,
      segmentKey: `campaign:${input.campaignId}`,
      name: `AlphaClone campaign ${String(campaign.name || input.campaignId)}`,
      correlationId: `campaign:${input.campaignId}`,
    });
    const listId = Number((list as any).listmonkListId ?? (list as any).listmonk_list_id);
    if (!Number.isFinite(listId)) return { success: false, error: 'Listmonk list mapping is invalid' };

    let eligible = 0;
    for (const recipient of recipients) {
      const email = String(recipient.email || '').trim().toLowerCase();
      if (!email) continue;

      const suppressed = await isEmailSuppressed(input.tenantId, email);
      const consent = suppressed
        ? false
        : await hasRecipientMarketingConsent(admin, input.tenantId, {
            email,
            contactId: recipient.contact_id,
          });

      if (suppressed || !consent) {
        await admin
          .from('campaign_recipients')
          .update({
            status: 'failed',
            error_message: suppressed
              ? 'Recipient is suppressed'
              : 'Marketing consent not granted (email_opt_in)',
          })
          .eq('tenant_id', input.tenantId)
          .eq('id', recipient.id);
        continue;
      }

      await syncListmonkSubscriber(admin, {
        tenantId: input.tenantId,
        contactId: recipient.contact_id,
        email,
        name: email,
        listIds: [listId],
        suppressed: false,
        attributes: {
          alphaclone_campaign_id: input.campaignId,
          ...objectValue(recipient.metadata),
        },
        correlationId: `campaign:${input.campaignId}`,
      });
      eligible += 1;
    }

    if (eligible === 0) return { success: false, error: 'No eligible recipients remain after suppression and consent checks' };

    const mapped = await createMappedListmonkCampaign(admin, {
      tenantId: input.tenantId,
      campaignId: input.campaignId,
      name: String(campaign.name || input.campaignId),
      subject: String(campaign.subject || ''),
      bodyHtml,
      listIds: [listId],
      fromEmail: String(campaign.from_email || 'notifications@alphaclonesystems.com'),
      correlationId: `campaign:${input.campaignId}`,
    });
    const listmonkCampaignId = Number((mapped as any).listmonkCampaignId);
    if (!Number.isFinite(listmonkCampaignId)) return { success: false, error: 'Listmonk campaign mapping is invalid' };

    await changeListmonkCampaignStatus(listmonkCampaignId, 'running');

    const now = new Date().toISOString();
    await admin
      .from('listmonk_campaign_mappings')
      .update({ status: 'running', last_synced_at: now, updated_at: now })
      .eq('tenant_id', input.tenantId)
      .eq('campaign_id', input.campaignId);
    await admin
      .from('email_campaigns')
      .update({ status: 'sending', sent_at: now })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.campaignId);

    return { success: true, error: null, listmonkCampaignId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Listmonk campaign send failed',
    };
  }
}
