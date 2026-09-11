'use client';

import React from 'react';
import toast from 'react-hot-toast';
import { getStoredLanguage } from '@/contexts/LanguageContext';
import { uiTranslate } from '@/i18n/uiTranslate';

export type NavigateToTab = (path: string) => void;

type NextPack = {
    headline: string;
    detail: string;
    links: { label: string; path: string }[];
    /** Von Restorff: one primary CTA per toast (index into links). */
    primaryLinkIndex?: number;
};

function localizeNextPack(pack: NextPack): NextPack {
    const lang = getStoredLanguage();
    return {
        headline: uiTranslate(lang, pack.headline),
        detail: uiTranslate(lang, pack.detail),
        primaryLinkIndex: pack.primaryLinkIndex,
        links: pack.links.map((l) => ({ ...l, label: uiTranslate(lang, l.label) })),
    };
}

/**
 * XP progress engine — progress-driven gamification (rituals, not badges).
 * SAFETY: 100% client-side (localStorage per user). Optionally mirrors award_points
 * through the bonnie MCP stack if the network is up — but that path is fire-and-forget
 * (silently swallowed errors), so zero UX breakage from network blips.
 */
const XP_STORAGE_KEY = 'ac-gamification-xp-v1';
const LEVEL_XP = [0, 100, 300, 700, 1500, 3000, 6000, 12000, 25000, 50000];
function levelForXp(xp: number): { level: number; next: number; pct: number } {
    let level = 0;
    for (let i = 0; i < LEVEL_XP.length; i++) {
        if (xp >= LEVEL_XP[i]) level = i;
    }
    const cur = LEVEL_XP[level] ?? 0;
    const next = LEVEL_XP[Math.min(level + 1, LEVEL_XP.length - 1)] ?? cur;
    const pct = next - cur > 0 ? Math.max(0, Math.min(100, ((xp - cur) * 100) / (next - cur))) : 100;
    return { level: level + 1, next, pct };
}
function readXpState(): { xp: number; level: number; next: number; pct: number } {
    if (typeof window === 'undefined') return { xp: 0, level: 1, next: 100, pct: 0 };
    try {
        const raw = window.localStorage.getItem(XP_STORAGE_KEY) || '0';
        const xp = Math.max(0, parseInt(raw, 10) || 0);
        return { xp, ...levelForXp(xp) };
    } catch { return { xp: 0, level: 1, next: 100, pct: 0 }; }
}
function writeXp(xp: number): void {
    try { window.localStorage.setItem(XP_STORAGE_KEY, String(Math.max(0, xp))); } catch {}
}

/**
 * Celebrate a ritual win: award XP, show gold sparkle toast, and (if a new level broke)
 * fire a LEVEL UP banner with shimmering border. This is the "celebration ritual" so
 * saves don't silently drop — user gets a visceral "progress was just made" microfeeling.
 */
export function celebrateWinRitual(args: {
    /** Why points were awarded (human label, used for toast microcopy). */
    reason: string;
    /** Points amount; choose from the ritual tiers below for consistency. */
    points: 10 | 25 | 50 | 100 | 250 | 500;
    /** Mirror award_points to bonnie/MCP in the background (fire-and-forget, no error UI). */
    tenantId?: string | null;
    userId?: string | null;
}): { xp: number; level: number; next: number; pct: number; leveledUp: boolean } {
    const before = readXpState();
    const newXp = before.xp + args.points;
    writeXp(newXp);
    const after = { ...levelForXp(newXp), xp: newXp };
    const leveledUp = after.level > before.level;

    const lang = getStoredLanguage();
    // Mirror through bonnie MCP /award_points backend tool if available
    if (typeof window !== 'undefined' && args.tenantId && args.userId) {
        void Promise.resolve().then(async () => {
            try {
                const mcpReq = {
                    jsonrpc: '2.0',
                    id: `xp-${Date.now()}`,
                    method: 'tools/call',
                    params: { name: 'award_points', arguments: { tenant_id: args.tenantId, user_id: args.userId, points: args.points, reason: args.reason } },
                };
                await fetch('/api/mcp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mcpReq),
                    keepalive: true,
                }).catch(() => void 0);
            } catch { /* backend award is best-effort only; localStorage is source of UX truth */ }
        });
    }

    toast.custom((tid) => {
        const headline = leveledUp
            ? uiTranslate(lang, `Level ${after.level} — unlocked!`)
            : `+${args.points} XP`;
        const subhead = leveledUp
            ? uiTranslate(lang, args.reason)
            : uiTranslate(lang, args.reason);
        return (
            <div
                role="status"
                className={
                    leveledUp
                        ? 'pointer-events-auto w-[min(100vw-2rem,22rem)] rounded-2xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-500/15 via-[var(--surface-elevated)] to-purple-500/10 dark:via-slate-900 p-4 shadow-2xl shadow-amber-500/20 relative overflow-hidden'
                        : 'pointer-events-auto w-[min(100vw-2rem,20rem)] rounded-xl border border-emerald-400/30 bg-[var(--surface-elevated)] dark:bg-slate-900 p-3.5 shadow-xl'
                }
            >
                {leveledUp && (
                    <span aria-hidden className="pointer-events-none absolute inset-0 animate-[pulse_2.2s_ease-in-out_infinite] bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.18),_transparent_55%)]" />
                )}
                <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className={leveledUp ? 'text-base font-black text-amber-300 tracking-wide' : 'text-sm font-bold text-emerald-300'}>
                            {headline}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] dark:text-slate-300 mt-1 leading-snug">{subhead}</p>
                        <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-hover)] dark:bg-slate-800 overflow-hidden">
                            <div
                                className={
                                    leveledUp
                                        ? 'h-full bg-gradient-to-r from-amber-400 to-purple-400'
                                        : 'h-full bg-gradient-to-r from-emerald-400 to-teal-400'
                                }
                                style={{ width: `${after.pct}%` }}
                            />
                        </div>
                        <p className="mt-1.5 text-[10px] text-[var(--text-muted)] dark:text-slate-500 tabular-nums">
                            Level {after.level} · {after.xp.toLocaleString()} XP · next at {after.next.toLocaleString()}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => toast.dismiss(tid.id)}
                        className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:text-slate-500 dark:hover:text-slate-300 flex-shrink-0"
                        aria-label="Dismiss"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    }, { duration: leveledUp ? 6000 : 3200 });

    return { xp: after.xp, level: after.level, next: after.next, pct: after.pct, leveledUp };
}

/** Standard XP ritual tiers — pick the closest one rather than inventing new numbers. */
export const XP_TIERS = {
    SAVE_EDIT: 10 as const,     // Save button pressed on existing record (lead/client/project)
    SAVE_CREATE: 25 as const,   // New record created
    STAGE_WIN: 50 as const,     // Deal moved forward / stage bumped / contract signed
    SEND_OUTBOUND: 50 as const, // Campaign sent / invoice sent / outreach run
    MONEY_CLOSED: 250 as const, // Invoice paid / deal closed won / cash in
    LANDMARK: 500 as const,     // Milestones: 1st client, 10th lead, etc.
} as const;

const PACKS: Record<string, NextPack> = {
    contract_saved: {
        headline: 'Contract saved — revenue comes next',
        detail:
            'Finish signature if it is still draft, then bill against what you agreed. Link the account to a deal so collection stays visible.',
        links: [
            { label: 'Billing', path: '/dashboard/business/billing' },
            { label: 'Deals', path: '/dashboard/deals' },
            { label: 'Documents', path: '/dashboard/business/documents' },
        ],
    },
    invoice_created: {
        headline: 'Invoice created — drive payment',
        detail:
            'Send the PDF or payment link, log when it went out, and set a follow-up. Unpaid invoices are not revenue yet.',
        links: [
            { label: 'Billing', path: '/dashboard/business/billing' },
            { label: 'Accounting', path: '/dashboard/accounting' },
            { label: 'Tasks', path: '/dashboard/tasks' },
        ],
    },
    after_invoice_sent: {
        headline: 'Logged as sent — now close the money loop',
        detail:
            'When payment lands, record it in Accounting and move the deal to Closed won if this was the last step. Review revenue in Reports.',
        links: [
            { label: 'Billing', path: '/dashboard/business/billing' },
            { label: 'Accounting', path: '/dashboard/accounting' },
            { label: 'Deals', path: '/dashboard/deals' },
            { label: 'Reports', path: '/dashboard/business/reports' },
        ],
    },
    invoice_not_sent_yet: {
        headline: 'Send it before it goes stale',
        detail:
            'Open Billing to download the PDF or share a payment link. Use Messages or SMS for a direct ask, then set a follow-up task.',
        links: [
            { label: 'Billing', path: '/dashboard/business/billing' },
            { label: 'Messages', path: '/dashboard/business/messages' },
            { label: 'SMS', path: '/dashboard/business/sms' },
            { label: 'Tasks', path: '/dashboard/tasks' },
        ],
    },
    quote_to_invoice: {
        headline: 'Quote is now an invoice',
        detail:
            'Confirm the client received it and align the deal stage with reality. Chase payment on a schedule, not hope.',
        links: [
            { label: 'Billing', path: '/dashboard/business/billing' },
            { label: 'Deals', path: '/dashboard/deals' },
        ],
    },
    project_created: {
        headline: 'Project live — ship, invoice, repeat',
        detail:
            'Add tasks with owners and due dates, calendar milestones, then bill against delivered scope. Same services every time belong in Settings as priced line items.',
        links: [
            { label: 'Tasks', path: '/dashboard/tasks' },
            { label: 'Calendar', path: '/dashboard/business/calendar' },
            { label: 'Billing', path: '/dashboard/business/billing' },
            { label: 'Settings', path: '/dashboard/business/settings' },
        ],
    },
    proposal_project_created: {
        headline: 'Proposal work started',
        detail:
            'Next is signed agreement and clear price: contract or quote, then invoice when you win.',
        links: [
            { label: 'Contracts', path: '/dashboard/business/contracts' },
            { label: 'Quotes', path: '/dashboard/business/quotes' },
            { label: 'Projects', path: '/dashboard/business/projects' },
        ],
    },
    task_created: {
        headline: 'Task saved — tie it to money or delivery',
        detail:
            'Link the task to a project or deal when possible, set a real due date, and block time on the calendar so it does not die in a list.',
        links: [
            { label: 'Calendar', path: '/dashboard/business/calendar' },
            { label: 'Projects', path: '/dashboard/business/projects' },
            { label: 'Deals', path: '/dashboard/deals' },
        ],
    },
    campaign_created: {
        headline: 'Campaign saved — launch and watch pipeline',
        detail:
            'Send when ready, then within 48 hours check Contact Submissions and Deals so replies become qualified opportunities.',
        links: [
            { label: 'Campaigns', path: '/dashboard/business/campaigns' },
            { label: 'Submissions', path: '/dashboard/business/contact-submissions' },
            { label: 'Deals', path: '/dashboard/deals' },
        ],
    },
    campaign_sent: {
        headline: 'Campaign sent — own the replies',
        detail:
            'Assign who answers inbound, tag source to the campaign, and convert real interest into contacts and deals.',
        links: [
            { label: 'Submissions', path: '/dashboard/business/contact-submissions' },
            { label: 'Contacts', path: '/dashboard/contacts' },
            { label: 'Deals', path: '/dashboard/deals' },
        ],
    },
    zoho_sync_done: {
        headline: 'Zoho sync done — reconcile in AlphaClone',
        detail:
            'Remote records changed. Spot-check Deals and Contacts for duplicates, stages, and anything that should hit billing.',
        links: [
            { label: 'Deals', path: '/dashboard/deals' },
            { label: 'Contacts', path: '/dashboard/contacts' },
            { label: 'CRM overview', path: '/dashboard/crm' },
        ],
    },
    lead_qualified: {
        headline: 'Lead qualified — conduct the opportunity',
        detail:
            'Deal is live. Schedule the next touch, move toward proposal, and set a close date so revenue timing is real.',
        links: [
            { label: 'Deals', path: '/dashboard/deals' },
            { label: 'Calendar', path: '/dashboard/business/calendar' },
            { label: 'Tasks', path: '/dashboard/tasks' },
        ],
    },
    deal_qualified: {
        headline: 'Qualified — time to engage',
        detail:
            'Confirm budget and decision maker, then advance to proposal with a clear offer and timeline.',
        links: [
            { label: 'Quotes', path: '/dashboard/business/quotes' },
            { label: 'Messages', path: '/dashboard/business/messages' },
            { label: 'Deals', path: '/dashboard/deals' },
        ],
    },
    deal_proposal: {
        headline: 'Proposal stage — send and confirm',
        detail:
            'Create or send the quote/proposal, log when it went out, and book a follow-up for acceptance or objections.',
        links: [
            { label: 'Quotes', path: '/dashboard/business/quotes' },
            { label: 'Contracts', path: '/dashboard/business/contracts' },
            { label: 'Deals', path: '/dashboard/deals' },
        ],
    },
    deal_closed_won: {
        headline: 'Deal won — contract before delivery',
        detail:
            'Send the agreement next, then invoice after signature, then create the project. Do not skip to delivery without billing.',
        links: [
            { label: 'Contracts', path: '/dashboard/business/contracts' },
            { label: 'Billing', path: '/dashboard/business/billing' },
            { label: 'Projects', path: '/dashboard/business/projects' },
        ],
    },
    deal_closed_lost: {
        headline: 'Deal lost — capture the lesson',
        detail:
            'Log why you lost, tag the reason on the deal, and decide if this contact belongs in nurture or is done.',
        links: [
            { label: 'Deals', path: '/dashboard/deals' },
            { label: 'Campaigns', path: '/dashboard/business/campaigns' },
            { label: 'Contacts', path: '/dashboard/contacts' },
        ],
    },
    contract_signed: {
        headline: 'Contract signed — bill then deliver',
        detail:
            'Send the invoice while momentum is high, then spin up the project with tasks and owners.',
        links: [
            { label: 'Billing', path: '/dashboard/business/billing' },
            { label: 'Projects', path: '/dashboard/business/projects' },
            { label: 'Tasks', path: '/dashboard/tasks' },
        ],
    },
    project_updated: {
        headline: 'Project saved — keep scope aligned with cash',
        detail:
            'If scope expanded, check if the change order belongs in a new invoice or milestone. Push updates to the client portal so nothing surprises them.',
        links: [
            { label: 'Tasks', path: '/dashboard/tasks' },
            { label: 'Billing', path: '/dashboard/business/billing' },
            { label: 'Client portal', path: '/dashboard/business/clients' },
        ],
    },
    lead_saved: {
        headline: 'Lead saved — move them towards qualified',
        detail:
            'Enrich what you know with email, phone, company size, or LinkedIn context. Set a clear follow-up; leads that sit die quiet deaths.',
        primaryLinkIndex: 1,
        links: [
            { label: 'Lead Finder', path: '/dashboard/business/lead-finder' },
            { label: 'Qualify in CRM', path: '/dashboard/crm' },
            { label: 'Outreach', path: '/dashboard/business/campaigns' },
        ],
    },
    lead_finder_accepted: {
        headline: 'Prospect saved to CRM',
        detail:
            'No outreach was sent automatically. Review the record, qualify fit, then start outreach when you are ready.',
        primaryLinkIndex: 0,
        links: [
            { label: 'Qualify in CRM', path: '/dashboard/crm' },
            { label: 'Add to list', path: '/dashboard/leads/campaigns' },
            { label: 'Start outreach', path: '/dashboard/business/campaigns' },
        ],
    },
    client_saved: {
        headline: 'Client updated — mirror reality in the money chain',
        detail:
            'Confirm the active deal stage still matches the relationship, update any invoice contacts, and set the next 30-day check-in so retention stays visible.',
        links: [
            { label: 'Deals', path: '/dashboard/deals' },
            { label: 'Billing', path: '/dashboard/business/billing' },
            { label: 'Calendar', path: '/dashboard/business/calendar' },
        ],
    },
};

export type ActionNextStepKey = keyof typeof PACKS;

export { emitCrossModulePropagation, propagation } from '@/lib/behavioral/propagationBridge';

export function showActionNextSteps(
    key: ActionNextStepKey,
    navigate: NavigateToTab,
    options?: { duration?: number }
): void {
    const raw = PACKS[key];
    if (!raw) return;
    const pack = localizeNextPack(raw);
    const lang = getStoredLanguage();

    toast.custom(
        (tid) => (
            <div
                role="status"
                className="max-w-sm w-[min(100vw-2rem,22rem)] rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] dark:border-slate-500 dark:bg-slate-900 shadow-xl p-4 text-left pointer-events-auto"
            >
                <div className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide next-step-highlight">
                    What next
                </div>
                <p className="text-sm font-bold text-[var(--text-primary)] dark:text-white leading-snug mt-2">{pack.headline}</p>
                <p className="text-xs text-[var(--text-secondary)] dark:text-slate-300 mt-2 leading-relaxed">{pack.detail}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                    {pack.links.map((l, index) => {
                        const isPrimary = (pack.primaryLinkIndex ?? 0) === index;
                        return (
                        <button
                            key={l.path + l.label}
                            type="button"
                            onClick={() => {
                                navigate(l.path);
                                toast.dismiss(tid.id);
                            }}
                            className={
                                isPrimary
                                    ? 'text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors'
                                    : 'text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] dark:border-white/10 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 transition-colors'
                            }
                        >
                            {l.label}
                        </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={() => toast.dismiss(tid.id)}
                    className="mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:text-slate-500 dark:hover:text-slate-400 uppercase tracking-wide"
                >
                    {uiTranslate(lang, 'Dismiss')}
                </button>
            </div>
        ),
        { duration: options?.duration ?? 14000 }
    );
}

/**
 * After any invoice is created: ask if it was sent to the client, then chain the right next steps.
 */
export function showInvoiceCreatedWithSendPrompt(navigate: NavigateToTab): void {
    const id = `invoice-send-prompt-${Date.now()}`;
    const lang = getStoredLanguage();
    toast.custom(
        (t) => (
            <div
                role="dialog"
                aria-labelledby="inv-next-title"
                className="max-w-sm w-[min(100vw-2rem,22rem)] rounded-xl border border-teal-500/40 bg-[var(--surface-elevated)] dark:bg-slate-900 shadow-xl p-4 text-left pointer-events-auto"
            >
                <div className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide next-step-highlight">
                    What next
                </div>
                <p id="inv-next-title" className="text-sm font-bold text-[var(--text-primary)] dark:text-white leading-snug">
                    {uiTranslate(lang, 'Invoice saved')}
                </p>
                <p className="text-xs text-[var(--text-secondary)] dark:text-slate-300 mt-2 leading-relaxed">
                    {uiTranslate(
                        lang,
                        'Did you already send this to the client (email, SMS, portal, or handoff)?'
                    )}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                    <button
                        type="button"
                        onClick={() => {
                            toast.dismiss(t.id);
                            toast.success(
                                uiTranslate(
                                    lang,
                                    'Noted. Follow up until paid, then record cash in Accounting.'
                                )
                            );
                            showActionNextSteps('after_invoice_sent', navigate);
                        }}
                        className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors"
                    >
                        {uiTranslate(lang, 'Yes, sent')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            toast.dismiss(t.id);
                            showActionNextSteps('invoice_not_sent_yet', navigate);
                        }}
                        className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white transition-colors"
                    >
                        {uiTranslate(lang, 'Not yet')}
                    </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-[var(--border-default)] dark:border-slate-700">
                    <button
                        type="button"
                        onClick={() => {
                            navigate('/dashboard/business/billing');
                            toast.dismiss(t.id);
                        }}
                        className="text-[11px] font-semibold px-2 py-1 rounded-md text-teal-700 hover:text-teal-600 dark:text-teal-400 dark:hover:text-teal-300"
                    >
                        {uiTranslate(lang, 'Open Billing')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            navigate('/dashboard/business/messages');
                            toast.dismiss(t.id);
                        }}
                        className="text-[11px] font-semibold px-2 py-1 rounded-md text-teal-700 hover:text-teal-600 dark:text-teal-400 dark:hover:text-teal-300"
                    >
                        {uiTranslate(lang, 'Messages')}
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => toast.dismiss(t.id)}
                    className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:text-slate-500 dark:hover:text-slate-400 uppercase tracking-wide"
                >
                    {uiTranslate(lang, 'Dismiss')}
                </button>
            </div>
        ),
        { id, duration: 20000 }
    );
}

