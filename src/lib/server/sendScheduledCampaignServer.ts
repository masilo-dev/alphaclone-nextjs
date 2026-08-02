import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { emailCampaignService } from "@/services/emailCampaignService";
import { isEmailSuppressed } from "@/lib/email/suppression";
import { hasRecipientMarketingConsent } from "@/lib/email/marketingConsent";
import { captureUnifiedMessageFromWebhook } from "@/services/intelligence/signalCaptureAdminService";
import { sendEmail } from "@/lib/email/sendEmail";
import {
  sendWhatsAppMessage,
  isWhatsAppConfigured,
} from "@/lib/whatsapp/sendWhatsApp";
import {
  blocksBonnieSend,
  campaignQualityCheck,
} from "@/lib/bonnie/bonnieBannedLanguage";
import {
  bonnieErrorMessage,
  BONNIE_KNOWN_ERRORS,
} from "@/lib/bonnie/bonnieError";
import { createHash } from "node:crypto";

type CampaignProvider = "sendgrid" | "resend" | "brevo" | "zoho";
type ProviderConfig = {
  id: CampaignProvider;
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  dailyLimit: number;
};

const DEFAULT_DAILY_LIMITS: Record<CampaignProvider, number> = {
  sendgrid: 500,
  resend: 300,
  brevo: 300,
  zoho: 200,
};

function toNonEmptyString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next.length > 0 ? next : null;
}

function toNumberOrDefault(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

type ExperimentVariant = {
  key: string;
  label?: string;
  allocation?: number;
  subject?: string;
  body?: string;
  offer?: string;
};
function selectExperimentVariant(
  variants: ExperimentVariant[],
  identity: string,
): ExperimentVariant | null {
  if (!variants.length) return null;
  const bucket =
    createHash("sha256").update(identity).digest().readUInt32BE(0) / 0xffffffff;
  let cumulative = 0;
  for (const variant of variants) {
    cumulative += Number(variant.allocation || 1 / variants.length);
    if (bucket <= cumulative) return variant;
  }
  return variants[variants.length - 1];
}

function normalizeProviderId(value: unknown): CampaignProvider | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (
    raw === "sendgrid" ||
    raw === "resend" ||
    raw === "brevo" ||
    raw === "zoho"
  )
    return raw;
  return null;
}

function resolveProviderConfig(
  provider: CampaignProvider,
  config: Record<string, unknown>,
): ProviderConfig {
  return {
    id: provider,
    apiKey:
      toNonEmptyString(config.apiKey) ||
      toNonEmptyString(config.api_key) ||
      undefined,
    fromEmail:
      toNonEmptyString(config.fromEmail) ||
      toNonEmptyString(config.from_email) ||
      undefined,
    fromName:
      toNonEmptyString(config.fromName) ||
      toNonEmptyString(config.from_name) ||
      undefined,
    dailyLimit: toNumberOrDefault(
      config.dailyLimit ?? config.daily_limit,
      DEFAULT_DAILY_LIMITS[provider],
    ),
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function timeToMinutes(value: unknown): number | null {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isInQuietHours(
  timezone: string,
  quietHours: Record<string, unknown>,
  now = new Date(),
): boolean {
  const start = timeToMinutes(quietHours.start);
  const end = timeToMinutes(quietHours.end);
  if (start === null || end === null || start === end) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const current =
    Number(parts.find((part) => part.type === "hour")?.value || 0) * 60 +
    Number(parts.find((part) => part.type === "minute")?.value || 0);
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

async function resolvePhoneForRecipient(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  email: string,
): Promise<string | null> {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;

  const { data: lead } = await admin
    .from("leads")
    .select("phone")
    .eq("tenant_id", tenantId)
    .ilike("email", normalized)
    .limit(1)
    .maybeSingle();
  if (lead?.phone) return String(lead.phone);

  const { data: client } = await admin
    .from("business_clients")
    .select("phone")
    .eq("tenant_id", tenantId)
    .ilike("email", normalized)
    .limit(1)
    .maybeSingle();
  if (client?.phone) return String(client.phone);

  const { data: contact } = await admin
    .from("contacts")
    .select("phone, custom_fields")
    .eq("tenant_id", tenantId)
    .ilike("email", normalized)
    .limit(1)
    .maybeSingle();
  if (contact?.phone) return String(contact.phone);

  const customFields = parseJsonObject(contact?.custom_fields);
  const customPhone =
    toNonEmptyString(customFields.phone) ||
    toNonEmptyString(customFields.mobile);
  return customPhone;
}

function selectProviderForRecipient(
  providers: ProviderConfig[],
  providerCountsToday: Map<CampaignProvider, number>,
  balanceByDailyLimit: boolean,
): ProviderConfig | null {
  if (!providers.length) return null;
  const available = providers.filter(
    (provider) =>
      (providerCountsToday.get(provider.id) || 0) < provider.dailyLimit,
  );
  if (!available.length) return null;
  if (!balanceByDailyLimit) return available[0] || null;

  const ranked = [...available].sort((a, b) => {
    const aRemaining = a.dailyLimit - (providerCountsToday.get(a.id) || 0);
    const bRemaining = b.dailyLimit - (providerCountsToday.get(b.id) || 0);
    if (aRemaining !== bRemaining) return bRemaining - aRemaining;
    return (
      (providerCountsToday.get(a.id) || 0) -
      (providerCountsToday.get(b.id) || 0)
    );
  });
  return ranked[0] || null;
}

/**
 * Sends a scheduled campaign from cron/worker context (no browser session).
 * Uses service role for DB and internal API key for /api/email/send.
 */
export async function sendScheduledCampaignServer(campaignId: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  const admin = createSupabaseAdminClient();

  try {
    const { data: campaign, error: cError } = await admin
      .from("email_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (cError || !campaign) {
      return { success: false, error: cError?.message || "Campaign not found" };
    }

    const tenantId = String(campaign.tenant_id || "");
    const { data: sequence } = await admin
      .from("outreach_sequences")
      .select("id, timezone, quiet_hours, frequency_cap, status")
      .eq("tenant_id", tenantId)
      .eq("campaign_id", campaignId)
      .in("status", ["active", "pending_approval"])
      .limit(1)
      .maybeSingle();
    if (sequence?.status === "pending_approval")
      return {
        success: false,
        error: "The linked outreach sequence still requires approval.",
      };
    if (
      sequence &&
      isInQuietHours(sequence.timezone, parseJsonObject(sequence.quiet_hours))
    ) {
      return {
        success: false,
        error: `Campaign is inside the sequence quiet-hours window for ${sequence.timezone}. It remains queued.`,
      };
    }
    const { data: activeExperiment } = sequence?.id
      ? await admin
          .from("outreach_experiments")
          .select("id, variants, metric")
          .eq("tenant_id", tenantId)
          .eq("sequence_id", sequence.id)
          .eq("status", "running")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const { data: recipients, error: rError } = await admin
      .from("campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "pending");

    if (rError) {
      return { success: false, error: rError.message };
    }

    if (!recipients?.length) {
      return {
        success: false,
        error:
          "No pending recipients on this campaign. Add contacts in the campaign builder, or turn off “Skip previously contacted” if everyone was filtered out.",
      };
    }

    const seenRecipients = new Set<string>();
    const eligibleRecipients = [];
    for (const recipient of recipients) {
      const normalizedEmail = String(recipient.email || "")
        .trim()
        .toLowerCase();
      if (!normalizedEmail || seenRecipients.has(normalizedEmail)) {
        await admin
          .from("campaign_recipients")
          .update({
            status: "failed",
            error_message: "Duplicate or invalid recipient removed before send",
          })
          .eq("id", recipient.id);
        continue;
      }
      seenRecipients.add(normalizedEmail);
      eligibleRecipients.push(recipient);
    }
    recipients.splice(0, recipients.length, ...eligibleRecipients);
    if (!recipients.length)
      return {
        success: false,
        error: "No unique eligible recipients remain on this campaign.",
      };

    const c = campaign as Record<string, unknown>;
    const campaignCreatorId = String(c.created_by || "").trim();
    if (!campaignCreatorId) {
      return {
        success: false,
        error:
          "Campaign creator is missing. Recreate the campaign and try again.",
      };
    }
    const rawMeta = c.metadata as Record<string, unknown> | undefined;
    const deliverySettings = parseJsonObject(rawMeta?.deliverySettings);
    const selectedProviders = Array.isArray(deliverySettings.selectedProviders)
      ? deliverySettings.selectedProviders
          .map((value: unknown) => normalizeProviderId(value))
          .filter(
            (value: CampaignProvider | null): value is CampaignProvider =>
              value !== null,
          )
      : [];
    const balanceByDailyLimit = deliverySettings.balanceByDailyLimit !== false;
    const bodySource =
      (rawMeta?.bodyHtml as string) ||
      (c.body_html as string) ||
      (c.html_content as string) ||
      (c.content as string) ||
      "Empty email body";

    const campaignQuality = campaignQualityCheck(bodySource);
    if (blocksBonnieSend(campaignQuality.score)) {
      const err = BONNIE_KNOWN_ERRORS.campaign_quality_failed(
        campaignQuality.score,
        campaignQuality.warnings,
      );
      return { success: false, error: bonnieErrorMessage(err) };
    }

    const campaignFromEmail = String(
      c.from_email || "notifications@alphaclonesystems.com",
    );
    const campaignFromName = String(c.from_name || "AlphaClone Systems");
    const replyTo = (c.reply_to as string) || undefined;
    const campaignLanguage =
      toNonEmptyString(rawMeta?.language) ||
      toNonEmptyString(rawMeta?.languageMode) ||
      undefined;
    const deliveryChannel =
      toNonEmptyString(rawMeta?.deliveryChannel) || "email";
    const sendEmailChannel =
      deliveryChannel === "email" || deliveryChannel === "both";
    const sendWhatsappChannel =
      deliveryChannel === "whatsapp" || deliveryChannel === "both";

    const filters = [];
    if (c.tenant_id) filters.push(`tenant_id.eq.${c.tenant_id}`);
    else if (campaignCreatorId) filters.push(`user_id.eq.${campaignCreatorId}`);

    let query = admin
      .from("integrations")
      .select("type, enabled, config, user_id, tenant_id")
      .eq("enabled", true)
      .in("type", ["sendgrid", "resend", "brevo", "zoho"]);

    if (filters.length > 0) {
      query = query.or(filters.join(","));
    }

    const { data: integrationRows, error: integrationError } = await query;
    if (integrationError)
      return { success: false, error: integrationError.message };

    const providerConfigs = (integrationRows || [])
      .map((row: any) => {
        const provider = normalizeProviderId(row.type);
        if (!provider) return null;
        return resolveProviderConfig(provider, parseJsonObject(row.config));
      })
      .filter(
        (row: ProviderConfig | null): row is ProviderConfig => row !== null,
      );

    let activeProviders = providerConfigs.filter((provider: any) =>
      selectedProviders.length > 0
        ? selectedProviders.includes(provider.id)
        : true,
    );

    const { data: senderControls, error: senderControlError } = await admin
      .from("email_sender_addresses")
      .select(
        "provider, email_address, warmup_status, daily_send_limit, reputation_score, bounce_rate, complaint_rate",
      )
      .eq("tenant_id", tenantId)
      .eq("is_verified", true);
    if (senderControlError)
      return {
        success: false,
        error: `Sender safety settings could not be verified: ${senderControlError.message}`,
      };
    activeProviders = activeProviders.flatMap((provider) => {
      const controls = (senderControls || []).filter(
        (sender) =>
          String(sender.provider).toLowerCase() === provider.id &&
          (!provider.fromEmail ||
            String(sender.email_address).toLowerCase() ===
              provider.fromEmail.toLowerCase()),
      );
      if (!controls.length) return [provider];
      const safe = controls.find(
        (sender) =>
          !["paused", "blocked"].includes(String(sender.warmup_status)) &&
          Number(sender.reputation_score || 0) >= 70 &&
          Number(sender.bounce_rate || 0) < 0.05 &&
          Number(sender.complaint_rate || 0) < 0.001,
      );
      if (!safe) return [];
      return [
        {
          ...provider,
          fromEmail: safe.email_address || provider.fromEmail,
          dailyLimit: Math.min(
            provider.dailyLimit,
            Number(safe.daily_send_limit || provider.dailyLimit),
          ),
        },
      ];
    });

    if (sendEmailChannel && !activeProviders.length) {
      return {
        success: false,
        error:
          "No active email providers are connected for this campaign. Connect SendGrid, Resend, Brevo, or Zoho Mail.",
      };
    }

    if (sendWhatsappChannel) {
      const waReady = await isWhatsAppConfigured(String(c.tenant_id || ""));
      if (!waReady) {
        return {
          success: false,
          error:
            "WhatsApp is not connected. Add your Zernio account ID under Settings → Integrations → WhatsApp.",
        };
      }
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data: sentTodayRows } = await admin
      .from("campaign_recipients")
      .select("metadata")
      .eq("tenant_id", c.tenant_id)
      .gte("sent_at", startOfDay.toISOString())
      .in("status", ["sent", "delivered", "opened", "clicked"]);
    const providerCountsToday = new Map<CampaignProvider, number>();
    for (const row of sentTodayRows || []) {
      const providerId = normalizeProviderId(
        parseJsonObject(row.metadata).provider,
      );
      if (providerId) {
        providerCountsToday.set(
          providerId,
          (providerCountsToday.get(providerId) || 0) + 1,
        );
      }
    }

    await admin
      .from("email_campaigns")
      .update({ status: "sending", sent_at: new Date().toISOString() })
      .eq("id", campaignId);

    let sentCount = 0;
    const whatsappBodyBase =
      `${String(c.subject || "").trim()}\n\n${stripHtml(bodySource)}`.trim();

    if (sendWhatsappChannel) {
      for (const recipient of recipients) {
        const phone = await resolvePhoneForRecipient(
          admin,
          tenantId,
          recipient.email,
        );
        if (!phone) {
          if (!sendEmailChannel) {
            await admin
              .from("campaign_recipients")
              .update({
                status: "failed",
                error_message: "No phone number on file for WhatsApp delivery",
              })
              .eq("id", recipient.id);
          }
          continue;
        }
        const normalizedPhone = String(phone).replace(/[^\d+]/g, "");
        const { data: whatsappSuppression, error: whatsappSuppressionError } =
          await admin
            .from("outreach_suppressions")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("channel", "whatsapp")
            .eq("normalized_recipient", normalizedPhone)
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .maybeSingle();
        if (whatsappSuppressionError || whatsappSuppression) {
          if (!sendEmailChannel)
            await admin
              .from("campaign_recipients")
              .update({
                status: "failed",
                error_message: whatsappSuppressionError
                  ? "WhatsApp suppression safety check unavailable"
                  : "Recipient is suppressed for WhatsApp",
              })
              .eq("id", recipient.id);
          continue;
        }

        const waResult = await sendWhatsAppMessage({
          tenantId,
          phone,
          message: whatsappBodyBase.slice(0, 4000),
          contactId: recipient.contact_id || null,
          metadata: { campaign_id: campaignId, channel: "whatsapp_campaign" },
        });

        if (waResult.success) {
          sentCount++;
          await admin
            .from("campaign_recipients")
            .update({
              status: sendEmailChannel ? "pending" : "sent",
              sent_at: sendEmailChannel ? null : new Date().toISOString(),
              metadata: {
                ...parseJsonObject(recipient.metadata),
                whatsapp_sent: true,
                whatsapp_provider: waResult.provider,
              },
            })
            .eq("id", recipient.id);
        } else if (!sendEmailChannel) {
          await admin
            .from("campaign_recipients")
            .update({
              status: "failed",
              error_message: waResult.error || "WhatsApp send failed",
              metadata: { whatsapp_provider: waResult.provider },
            })
            .eq("id", recipient.id);
        }
      }
    }

    if (!sendEmailChannel) {
      await admin
        .from("email_campaigns")
        .update({
          status: "sent",
          total_sent: sentCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
      return { success: true, error: null };
    }

    const emailRecipients = sendWhatsappChannel
      ? (
          await admin
            .from("campaign_recipients")
            .select("*")
            .eq("campaign_id", campaignId)
            .eq("status", "pending")
        )?.data || []
      : recipients;

    const abTestMeta = parseJsonObject(rawMeta?.abTest);
    const abTestEnabled =
      abTestMeta.enabled === true &&
      String(abTestMeta.subjectB || "").trim().length > 0;
    const abSubjectB = String(abTestMeta.subjectB || "").trim();
    const abSplitPercent = Math.min(
      100,
      Math.max(0, Number(abTestMeta.splitPercent) || 50),
    );
    const experimentVariants = Array.isArray(activeExperiment?.variants)
      ? activeExperiment.variants.filter(
          (variant: unknown): variant is ExperimentVariant =>
            Boolean(variant && typeof variant === "object" && "key" in variant),
        )
      : [];

    if (activeExperiment && experimentVariants.length >= 2) {
      for (const recipient of emailRecipients) {
        const variant = selectExperimentVariant(
          experimentVariants,
          `${activeExperiment.id}:${String(recipient.email).toLowerCase()}`,
        );
        if (!variant) continue;
        const existingMeta = parseJsonObject(recipient.metadata);
        const metadata = {
          ...existingMeta,
          abVariant: variant.key,
          experimentId: activeExperiment.id,
        };
        await admin
          .from("campaign_recipients")
          .update({ metadata })
          .eq("id", recipient.id);
        recipient.metadata = metadata;
      }
    }

    if (!activeExperiment && abTestEnabled && emailRecipients.length > 0) {
      const shuffled = [...emailRecipients];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const bCount = Math.round((shuffled.length * abSplitPercent) / 100);
      for (let i = 0; i < shuffled.length; i++) {
        const variant = i < bCount ? "B" : "A";
        const existingMeta = parseJsonObject(shuffled[i].metadata);
        await admin
          .from("campaign_recipients")
          .update({
            metadata: { ...existingMeta, abVariant: variant },
          })
          .eq("id", shuffled[i].id);
        shuffled[i].metadata = { ...existingMeta, abVariant: variant };
      }
    }

    let failedCount = 0;

    for (const recipient of emailRecipients) {
      if (await isEmailSuppressed(String(c.tenant_id || ""), recipient.email)) {
        await admin
          .from("campaign_recipients")
          .update({
            status: "failed",
            error_message: "Recipient is suppressed",
          })
          .eq("id", recipient.id);
        failedCount += 1;
        continue;
      }

      const tenantId = String(c.tenant_id || "");
      const consentOk = await hasRecipientMarketingConsent(admin, tenantId, {
        email: recipient.email,
        contactId: recipient.contact_id,
      });
      if (!consentOk) {
        await admin
          .from("campaign_recipients")
          .update({
            status: "failed",
            error_message: "Marketing consent not granted (email_opt_in)",
          })
          .eq("id", recipient.id);
        failedCount += 1;
        continue;
      }

      const maxPerSevenDays = Number(
        parseJsonObject(sequence?.frequency_cap).max_per_7_days || 0,
      );
      if (maxPerSevenDays > 0) {
        const since = new Date(Date.now() - 7 * 86400_000).toISOString();
        const { count, error: frequencyError } = await admin
          .from("campaign_recipients")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .ilike("email", recipient.email)
          .gte("sent_at", since)
          .in("status", ["sent", "delivered", "opened", "clicked"]);
        if (frequencyError || Number(count || 0) >= maxPerSevenDays) {
          await admin
            .from("campaign_recipients")
            .update({
              status: "failed",
              error_message: frequencyError
                ? "Frequency safety check unavailable"
                : `Frequency cap reached (${maxPerSevenDays} per 7 days)`,
            })
            .eq("id", recipient.id);
          failedCount += 1;
          continue;
        }
      }

      let contactName = "";
      let companyName = "";
      let customFields: Record<string, unknown> = {};

      if (recipient.contact_id) {
        const { data: contact } = await admin
          .from("contacts")
          .select(
            "id, full_name, email, custom_fields, company:companies(name, website)",
          )
          .eq("id", recipient.contact_id)
          .single();

        contactName = String(contact?.full_name || "").trim();
        const companyRecord = Array.isArray(contact?.company)
          ? contact.company[0]
          : contact?.company;
        companyName = String(
          companyRecord?.name || companyRecord?.website || "",
        ).trim();
        customFields =
          (contact?.custom_fields as Record<string, unknown>) || {};
      } else {
        const meta = parseJsonObject(recipient.metadata);
        const clientId = toNonEmptyString(meta.client_id);
        if (clientId) {
          const { data: client } = await admin
            .from("business_clients")
            .select("name, email, industry, website")
            .eq("id", clientId)
            .maybeSingle();
          contactName = String(client?.name || "").trim();
          companyName = String(
            client?.website || client?.industry || "",
          ).trim();
        }
      }

      const parts = contactName.split(/\s+/).filter(Boolean);

      const recipientData = {
        id: recipient.contact_id,
        email: recipient.email,
        firstName: parts[0] || undefined,
        lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
        company: companyName || undefined,
        ...(customFields || {}),
      };

      const provider = selectProviderForRecipient(
        activeProviders,
        providerCountsToday,
        balanceByDailyLimit,
      );
      if (!provider) {
        await admin
          .from("campaign_recipients")
          .update({
            status: "failed",
            error_message:
              "Daily sending limits reached for all selected providers",
          })
          .eq("id", recipient.id);
        failedCount += 1;
        continue;
      }

      const fromEmail = provider.fromEmail || campaignFromEmail;
      const fromName = provider.fromName || campaignFromName;
      const recipientMeta = parseJsonObject(recipient.metadata);
      const abVariant = String(recipientMeta.abVariant || "A");
      const experimentVariant = experimentVariants.find(
        (variant) => variant.key === abVariant,
      );
      const variantBody = experimentVariant?.body || bodySource;
      const personalizedHtml = emailCampaignService.injectVariables(
        experimentVariant?.offer
          ? `${variantBody}\n\n${experimentVariant.offer}`
          : variantBody,
        {
          ...recipientData,
          fromName,
          senderName: fromName,
        },
      );
      const subjectSource = experimentVariant?.subject
        ? experimentVariant.subject
        : abTestEnabled && abVariant === "B" && abSubjectB
          ? abSubjectB
          : String(c.subject || "");
      const personalizedSubject = emailCampaignService.injectVariables(
        subjectSource,
        {
          ...recipientData,
          fromName,
          senderName: fromName,
        },
      );
      const preferredProvider = provider.id;
      const sendResult = await sendEmail(
        String(c.tenant_id || ""),
        {
          to: recipient.email,
          subject: personalizedSubject,
          html: personalizedHtml,
          from_name: fromName,
          reply_to: replyTo,
          userId: campaignCreatorId,
          templateName: "emailCampaign",
        },
        preferredProvider,
      );

      if (sendResult.success) {
        sentCount++;
        const usedProvider =
          normalizeProviderId(sendResult.provider) || provider.id;
        providerCountsToday.set(
          usedProvider,
          (providerCountsToday.get(usedProvider) || 0) + 1,
        );
        await admin
          .from("campaign_recipients")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: sendResult.emailId || null,
            metadata: {
              provider: sendResult.provider || provider.id,
              provider_from: fromEmail,
              provider_message_id: sendResult.emailId || null,
              language: campaignLanguage,
              abVariant: abVariant || "A",
            },
          })
          .eq("id", recipient.id);
        await admin.from("outreach_events").insert({
          tenant_id: tenantId,
          campaign_id: campaignId,
          sequence_id: sequence?.id || null,
          contact_id: recipient.contact_id || null,
          channel: "email",
          event_type: "sent",
          provider: sendResult.provider || provider.id,
          provider_event_id: sendResult.emailId || null,
          variant: abVariant || "A",
          metadata: {
            sender_email: fromEmail,
            recipient_email: String(recipient.email).toLowerCase(),
            verified_provider_receipt: Boolean(sendResult.emailId),
            experiment_id: activeExperiment?.id || null,
          },
        });
        try {
          await captureUnifiedMessageFromWebhook({
            supabase: admin as any,
            tenantId: String(c.tenant_id || ""),
            source: (sendResult.provider || provider.id) as any,
            channel: "email",
            direction: "outbound",
            externalId: String(recipient.id),
            threadId: String(campaignId),
            from: fromEmail,
            to: recipient.email,
            subject: personalizedSubject,
            text: null,
            html: personalizedHtml,
            sentAt: new Date().toISOString(),
            metadata: {
              campaignId,
              campaignName: String(c.name || ""),
              contactId: recipient.contact_id,
              provider: sendResult.provider || provider.id,
              providerFrom: fromEmail,
              language: campaignLanguage,
            },
          });
        } catch {
          // Non-blocking: campaign delivery should not fail due to analytics capture issues.
        }
      } else {
        failedCount += 1;
        await admin
          .from("campaign_recipients")
          .update({
            status: "failed",
            error_message: sendResult.error || "Provider send failed",
            metadata: {
              provider: provider.id,
              provider_from: fromEmail,
              language: campaignLanguage,
              tried: sendResult.tried,
            },
          })
          .eq("id", recipient.id);
      }
    }

    if (sentCount === 0 && emailRecipients.length > 0) {
      await admin
        .from("email_campaigns")
        .update({
          status: "draft",
          total_sent: 0,
        })
        .eq("id", campaignId);
      return {
        success: false,
        error: `No emails were delivered (${failedCount} failed). Check connected providers under Settings → Integrations and verify recipient emails.`,
      };
    }

    await admin
      .from("email_campaigns")
      .update({
        status: sentCount > 0 ? "sent" : "draft",
        total_sent: sentCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    return { success: true, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}
