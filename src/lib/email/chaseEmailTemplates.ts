/**
 * Branded owner execution brief + critical alert email templates.
 */

import { buildEmail } from '@/lib/email/template';
import { signChaseActionToken } from '@/lib/chaser/chaseActionTokens';
import type { ChaseInstanceRow } from '@/lib/chaser/types';

const CHASE_BODY_STYLES = `
  .chase-section { margin: 24px 0; }
  .chase-section h2 { font-size: 16px; color: #0f172a; margin: 0 0 12px; }
  .chase-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 10px; }
  .chase-item-title { font-weight: 600; color: #0f172a; margin: 0 0 4px; }
  .chase-item-meta { font-size: 13px; color: #64748b; margin: 0; }
  .chase-btn { display: inline-block; margin: 4px 6px 4px 0; padding: 8px 14px; background: #0ea5e9; color: #fff !important; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; }
  .chase-btn-secondary { background: #64748b; }
  .chase-summary { background: #eff6ff; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
`;

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/$/, '');
}

function actionUrl(
  tenantId: string,
  chaseId: string,
  ownerUserId: string,
  action: 'approve' | 'snooze' | 'stop' | 'do_now',
): string {
  const token = signChaseActionToken({ tenantId, chaseId, ownerUserId, action });
  return `${appBaseUrl()}/api/chase/action?token=${encodeURIComponent(token)}`;
}

function renderItem(
  item: ChaseInstanceRow,
  tenantId: string,
  ownerUserId: string,
): string {
  const ctx = (item.context_snapshot || {}) as Record<string, unknown>;
  const title =
    String(ctx.title || ctx.quote_number || ctx.invoice_number || item.reason_code || item.policy_key);
  return `
    <div class="chase-item">
      <p class="chase-item-title">${title}</p>
      <p class="chase-item-meta">${item.policy_key.replace(/_/g, ' ')} · ${item.severity} · waiting on ${item.waiting_on || 'unknown'}</p>
      <p class="chase-item-meta">Attempts: ${item.attempt_count}/${item.max_attempts}</p>
      <div>
        <a class="chase-btn" href="${actionUrl(tenantId, item.id, ownerUserId, 'do_now')}">Do now</a>
        <a class="chase-btn" href="${actionUrl(tenantId, item.id, ownerUserId, 'approve')}">Approve</a>
        <a class="chase-btn chase-btn-secondary" href="${actionUrl(tenantId, item.id, ownerUserId, 'snooze')}">Snooze</a>
        <a class="chase-btn chase-btn-secondary" href="${actionUrl(tenantId, item.id, ownerUserId, 'stop')}">Stop</a>
      </div>
    </div>
  `;
}

function groupItems(items: ChaseInstanceRow[]) {
  const money: ChaseInstanceRow[] = [];
  const sales: ChaseInstanceRow[] = [];
  const delivery: ChaseInstanceRow[] = [];
  const critical: ChaseInstanceRow[] = [];

  for (const item of items) {
    if (item.severity === 'critical') {
      critical.push(item);
      continue;
    }
    if (item.policy_key.includes('invoice') || item.policy_key.includes('quote') || item.policy_key.includes('contract')) {
      money.push(item);
    } else if (item.policy_key.includes('lead') || item.policy_key.includes('prospect') || item.policy_key.includes('contact')) {
      sales.push(item);
    } else {
      delivery.push(item);
    }
  }
  return { money, sales, delivery, critical };
}

export function formatExecutionBriefEmail(params: {
  tenantId: string;
  tenantName: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerName: string;
  items: ChaseInstanceRow[];
  handled?: Array<{ label: string; receipt?: string }>;
  failures?: Array<{ label: string; reason: string }>;
}): { subject: string; html: string } {
  const { money, sales, delivery, critical } = groupItems(params.items);
  const criticalCount = critical.length;
  const actionCount = params.items.length;
  const inboxUrl = `${appBaseUrl()}/dashboard?tenantId=${params.tenantId}`;

  const section = (title: string, rows: ChaseInstanceRow[]) =>
    rows.length
      ? `<div class="chase-section"><h2>${title}</h2>${rows.map((i) => renderItem(i, params.tenantId, params.ownerUserId)).join('')}</div>`
      : '';

  const bodyHtml = `
    <style>${CHASE_BODY_STYLES}</style>
    <div class="chase-summary">
      <p style="margin:0;font-size:16px;color:#0f172a;">Good morning, ${params.ownerName || 'there'}.</p>
      <p style="margin:8px 0 0;color:#475569;">${criticalCount} critical · ${actionCount} actions need attention</p>
    </div>
    ${section('Needs you now', critical)}
    ${section('Money to collect', money)}
    ${section('Sales follow-ups', sales)}
    ${section('Client delivery', delivery)}
    ${
      params.handled?.length
        ? `<div class="chase-section"><h2>AlphaClone handled</h2><ul>${params.handled.map((h) => `<li>${h.label}${h.receipt ? ` — ${h.receipt}` : ''}</li>`).join('')}</ul></div>`
        : ''
    }
    ${
      params.failures?.length
        ? `<div class="chase-section"><h2>Could not complete</h2><ul>${params.failures.map((f) => `<li>${f.label}: ${f.reason}</li>`).join('')}</ul></div>`
        : ''
    }
    <p style="text-align:center;margin:24px 0;">
      <a class="chase-btn" href="${inboxUrl}">Open Execution Inbox</a>
    </p>
  `;

  const subject = `Your AlphaClone execution brief — ${criticalCount} critical, ${actionCount} actions`;
  return {
    subject,
    html: buildEmail({
      subject,
      bodyHtml,
      tenantName: params.tenantName,
      tenantId: params.tenantId,
      recipientEmail: params.ownerEmail,
    }),
  };
}

export function formatCriticalChaseAlertEmail(params: {
  tenantId: string;
  tenantName: string;
  ownerUserId: string;
  ownerEmail: string;
  item: ChaseInstanceRow;
}): { subject: string; html: string } {
  const bodyHtml = `
    <style>${CHASE_BODY_STYLES}</style>
    <p>A high-risk chase item needs immediate attention:</p>
    ${renderItem(params.item, params.tenantId, params.ownerUserId)}
  `;
  const subject = `Critical: ${String((params.item.context_snapshot as Record<string, unknown>)?.invoice_number || params.item.policy_key)}`;
  return {
    subject,
    html: buildEmail({
      subject,
      bodyHtml,
      tenantName: params.tenantName,
      tenantId: params.tenantId,
      recipientEmail: params.ownerEmail,
    }),
  };
}

export function formatEndOfDayBriefEmail(params: {
  tenantId: string;
  tenantName: string;
  ownerEmail: string;
  unresolvedItems: ChaseInstanceRow[];
  attemptedToday: number;
}): { subject: string; html: string } {
  const subject = `End of day — ${params.unresolvedItems.length} items still open`;
  const list = params.unresolvedItems
    .slice(0, 15)
    .map(
      (i) =>
        `<li><strong>${i.policy_key}</strong> — ${i.reason_code || 'open'} (${i.state})</li>`,
    )
    .join('');
  const bodyHtml = `
    <style>${CHASE_BODY_STYLES}</style>
    <p>${params.attemptedToday} chase actions attempted today.</p>
    <p>These items remain unresolved:</p>
    <ul>${list || '<li>None — good day.</li>'}</ul>
  `;
  return {
    subject,
    html: buildEmail({
      subject,
      bodyHtml,
      tenantName: params.tenantName,
      tenantId: params.tenantId,
      recipientEmail: params.ownerEmail,
    }),
  };
}

export function formatWeeklyAccountabilityEmail(params: {
  tenantId: string;
  tenantName: string;
  ownerEmail: string;
  opened: number;
  resolved: number;
  failedAttempts: number;
  criticalOpen: number;
}): { subject: string; html: string } {
  const subject = `Weekly accountability — ${params.resolved} resolved, ${params.criticalOpen} critical open`;
  const bodyHtml = `
    <style>${CHASE_BODY_STYLES}</style>
    <div class="chase-summary">
      <p>Opened: ${params.opened} · Resolved: ${params.resolved} · Failed attempts: ${params.failedAttempts}</p>
      <p>Critical still open: ${params.criticalOpen}</p>
    </div>
  `;
  return {
    subject,
    html: buildEmail({
      subject,
      bodyHtml,
      tenantName: params.tenantName,
      tenantId: params.tenantId,
      recipientEmail: params.ownerEmail,
    }),
  };
}
