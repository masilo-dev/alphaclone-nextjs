import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mapWithConcurrency, readConcurrencyEnv } from '@/lib/concurrency/mapWithConcurrency';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { isEmailSuppressed } from '@/lib/email/suppression';
import { ensureEmailProviderReady } from '@/lib/mcp/ensureEmailProviderReady';
import { shouldUseMcpDirectExecution } from '@/lib/mcp/mcpDirectExecution';
import { getCampaignLanguageInstruction, resolveCampaignLanguage } from '@/lib/languageUtils';
import { routeAutonomousTask } from '@/services/aiRouter';

const MAX_BATCH_RECIPIENTS = 120;
const CHUNK_SIZE = 3;

type OutreachEntity = Record<string, unknown> & {
  id?: string;
  email?: string | null;
  contact_email?: string | null;
  emails?: unknown;
  name?: string | null;
  business_name?: string | null;
  industry?: string | null;
  marketing_opt_in?: boolean | null;
  email_opt_in?: boolean | null;
  metadata?: Record<string, unknown> | null;
  country?: string | null;
  country_code?: string | null;
  address?: string | null;
};

export type BatchOutreachArgs = {
  lead_ids?: string[];
  client_ids?: string[];
  tone?: string;
  custom_context?: string;
  delivery_provider?: string;
  language_mode?: string;
  language?: string;
  final_confirmation?: boolean;
  dry_run?: boolean;
};

type BatchContext = { tenantId: string; userId: string };

function resolveDirectEmail(entity: OutreachEntity): string | null {
  const candidates = [
    entity.email,
    entity.contact_email,
    ...(Array.isArray(entity.emails) ? entity.emails : []),
  ];
  const match = candidates.find((value) => typeof value === 'string' && value.trim().includes('@'));
  return typeof match === 'string' ? match.trim().toLowerCase() : null;
}

function hasMarketingConsent(entity: OutreachEntity): boolean {
  const metadata = entity.metadata && typeof entity.metadata === 'object' ? entity.metadata : {};
  return entity.marketing_opt_in === true ||
    entity.email_opt_in === true ||
    metadata.marketing_opt_in === true ||
    metadata.email_opt_in === true ||
    metadata.marketingConsent === true;
}

async function preflightEntity(tenantId: string, entity: OutreachEntity) {
  const name = String(entity.business_name || entity.name || 'Unnamed recipient');
  const email = resolveDirectEmail(entity);
  if (!email) {
    return { name, email: null, status: 'skipped' as const, error: 'No direct email found on this record.' };
  }
  if (!hasMarketingConsent(entity)) {
    return { name, email, status: 'skipped' as const, error: 'Marketing consent is not recorded for this recipient.' };
  }
  if (await isEmailSuppressed(tenantId, email)) {
    return { name, email, status: 'skipped' as const, error: 'Recipient is suppressed or unsubscribed.' };
  }
  return { name, email, status: 'eligible' as const, entity };
}

export async function executeBatchOutreach(args: BatchOutreachArgs, ctx: BatchContext) {
  const leadIds = Array.isArray(args.lead_ids) ? [...new Set(args.lead_ids.map((id) => String(id || '').trim()).filter(Boolean))] : [];
  const clientIds = Array.isArray(args.client_ids) ? [...new Set(args.client_ids.map((id) => String(id || '').trim()).filter(Boolean))] : [];
  const tone = String(args.tone || 'professional');
  const customContext = String(args.custom_context || '');
  const deliveryProvider = String(args.delivery_provider || 'sendgrid');

  const batchLanguage = resolveCampaignLanguage({
    languageMode: args.language_mode,
    language: args.language,
  });

  if (!leadIds.length && !clientIds.length) {
    throw new Error('Provide at least one lead_id or client_id');
  }
  if (batchLanguage.mustAsk) {
    throw new Error(
      'language_mode is "ask". Ask the user which language to use before sending outreach, then call this tool again with language or language_mode set to that language code.',
    );
  }

  const recipientCount = leadIds.length + clientIds.length;
  if (recipientCount > MAX_BATCH_RECIPIENTS) {
    throw new Error(`Batch outreach is limited to ${MAX_BATCH_RECIPIENTS} recipients. Split the selection into smaller batches.`);
  }

  const dryRun = args.dry_run === true || (args.dry_run !== false && args.final_confirmation !== true);
  if (!dryRun && args.final_confirmation !== true) {
    throw new Error('Set final_confirmation: true after reviewing a dry run before sending batch outreach.');
  }
  if (!dryRun) {
    if (!shouldUseMcpDirectExecution('send_batch_outreach')) {
      throw new Error(
        'Batch outreach durable queue is not implemented for MCP. Unset MCP_BULK_OUTREACH_DURABLE to send directly in chat.',
      );
    }
    await ensureEmailProviderReady(ctx.tenantId, ctx.userId);
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: leads }, { data: clients }] = await Promise.all([
    leadIds.length
      ? supabase.from('leads').select('*').in('id', leadIds).eq('tenant_id', ctx.tenantId)
      : Promise.resolve({ data: [] as OutreachEntity[] }),
    clientIds.length
      ? supabase.from('business_clients').select('*').in('id', clientIds).eq('tenant_id', ctx.tenantId)
      : Promise.resolve({ data: [] as OutreachEntity[] }),
  ]);

  const allEntities = [...(leads || []), ...(clients || [])];
  if (!allEntities.length) {
    throw new Error('No valid leads or clients found for the provided IDs');
  }

  const preflightConcurrency = readConcurrencyEnv('OUTREACH_PREFLIGHT_CONCURRENCY', 10);
  const prefetched = await mapWithConcurrency(allEntities, preflightConcurrency, (entity) =>
    preflightEntity(ctx.tenantId, entity)
  );
  const eligible = prefetched.filter((row): row is typeof row & { entity: OutreachEntity; email: string } =>
    row.status === 'eligible');
  const skipped = prefetched.filter((row) => row.status === 'skipped');

  if (dryRun) {
    return {
      dry_run: true,
      execution_mode: 'simulated' as const,
      requested: recipientCount,
      eligible: eligible.length,
      skipped: skipped.length,
      language: batchLanguage.code,
      recipients: eligible.map((row) => ({
        name: row.name,
        email: row.email,
        status: 'dry_run',
      })),
      skipped_recipients: skipped.map((row) => ({
        name: row.name,
        email: row.email,
        error: row.error,
      })),
      next_step: 'Review eligible recipients, then call again with dry_run: false and final_confirmation: true to send.',
    };
  }

  const results: Array<Record<string, unknown>> = [];
  for (let i = 0; i < eligible.length; i += CHUNK_SIZE) {
    const chunk = eligible.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(chunk.map(async ({ entity, name, email }) => {
      try {
        const prompt = `Generate a highly personalized, professional B2B outreach email for ${entity.business_name || entity.name}.
                Industry: ${entity.industry || 'Business'}.
                Target Tone: ${tone}.
                User Context: ${customContext}.
                Business Context: ${JSON.stringify(entity.metadata || {})}.
                ${getCampaignLanguageInstruction({
                  languageMode: batchLanguage.code,
                  country: entity.country,
                  countryCode: entity.country_code,
                  address: entity.address,
                  company: entity.business_name || entity.name,
                })}

                Rules:
                - Max 120 words.
                - Professional, punchy subject line.
                - NO emojis.
                - Clear CTA.`;

        const aiRes = await routeAutonomousTask('social_caption', prompt);
        const subject = `Business Inquiry regarding ${entity.business_name || entity.name}`;
        const emailResult = await sendEmailServer({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          to: email,
          subject,
          html: aiRes.content,
          fromName: 'AlphaClone Outreach',
          preferredProvider: deliveryProvider as 'sendgrid' | 'resend' | 'brevo' | 'zoho' | 'gmail',
          templateName: 'mcpAiOutreach',
        });
        if (!emailResult.success) {
          throw new Error(emailResult.error || 'Outreach email failed');
        }

        await supabase.from('lead_outreach_log').insert({
          tenant_id: ctx.tenantId,
          user_id: ctx.userId,
          lead_name: entity.business_name || entity.name,
          lead_email: email,
          subject,
          body_html: aiRes.content,
          status: 'sent',
          provider: emailResult.provider,
        });

        return {
          name,
          email,
          status: 'sent',
          language: batchLanguage.code,
          provider: emailResult.provider,
          email_id: emailResult.emailId,
        };
      } catch (err) {
        return {
          name,
          email,
          status: 'failed',
          error: err instanceof Error ? err.message : 'send_failed',
        };
      }
    }));
    results.push(...chunkResults);
  }

  const sent = results.filter((row) => row.status === 'sent').length;
  const failed = results.filter((row) => row.status === 'failed').length;

  return {
    dry_run: false,
    execution_mode: 'direct' as const,
    requested: recipientCount,
    eligible: eligible.length,
    processed: results.length,
    sent,
    failed,
    skipped: skipped.length,
    language: batchLanguage.code,
    results,
    skipped_recipients: skipped.map((row) => ({
      name: row.name,
      email: row.email,
      error: row.error,
    })),
  };
}
