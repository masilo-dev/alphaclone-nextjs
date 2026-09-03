import { applyPersonalizationTemplate, type PersonalizationVariables } from '@/lib/email/personalizationEngine';
import type { EmailLayoutFamily } from '@/lib/email/emailCommunicationClasses';
import { renderEmail, type EmailTemplateType } from '@/lib/email/renderEmail';

export interface AlphaCloneLayoutInput {
  layoutFamily: EmailLayoutFamily;
  subject: string;
  preheader?: string;
  headline: string;
  bodyHtml: string;
  bodyText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  variables?: PersonalizationVariables;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  stats?: Array<{ label: string; value: string }>;
}

function layoutFamilyToType(family: EmailLayoutFamily): EmailTemplateType {
  switch (family) {
    case 'welcome':
      return 'welcome';
    case 'morning_brief':
      return 'digest';
    case 'security':
      return 'account_verification';
    case 'failure':
    case 'action_required':
      return 'system_notification';
    default:
      return 'system_notification';
  }
}

function statsPanel(stats: Array<{ label: string; value: string }>): string {
  if (!stats.length) return '';
  const rows = stats
    .map(
      (s) =>
        `<tr><td style="padding:8px 0;color:#475569;">${s.label}</td><td align="right" style="padding:8px 0;color:#0F172A;font-weight:600;">${s.value}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">${rows}</table>`;
}

/** Platform/system emails — delegates to central renderEmail layout. */
export function renderAlphaCloneEmailLayout(input: AlphaCloneLayoutInput): { html: string; text: string } {
  const vars = input.variables || {};
  const headline = applyPersonalizationTemplate(input.headline, vars);
  const bodyHtml = applyPersonalizationTemplate(input.bodyHtml, vars);
  const bodyText = input.bodyText
    ? applyPersonalizationTemplate(input.bodyText, vars)
    : bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const ctaLabel = input.ctaLabel ? applyPersonalizationTemplate(input.ctaLabel, vars) : '';
  const ctaUrl = input.ctaUrl ? applyPersonalizationTemplate(input.ctaUrl, vars) : '';
  const preheader = input.preheader ? applyPersonalizationTemplate(input.preheader, vars) : '';

  const type = layoutFamilyToType(input.layoutFamily);
  const footerType =
    type === 'digest' ? 'marketing' : type === 'welcome' ? 'transactional' : 'transactional';

  const infoPanel = statsPanel(
    (input.stats || []).map((s) => ({
      label: applyPersonalizationTemplate(s.label, vars),
      value: applyPersonalizationTemplate(s.value, vars),
    })),
  );

  return renderEmail({
    type,
    subject: input.subject,
    preheader,
    heading: headline,
    content: bodyHtml + infoPanel,
    contentIsHtml: true,
    cta: ctaLabel && ctaUrl ? { label: ctaLabel, url: ctaUrl } : undefined,
    footerType,
    unsubscribeUrl: input.unsubscribeUrl,
    preferencesUrl: input.preferencesUrl,
  });
}
