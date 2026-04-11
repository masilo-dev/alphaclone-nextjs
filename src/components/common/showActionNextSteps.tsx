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
};

function localizeNextPack(pack: NextPack): NextPack {
    const lang = getStoredLanguage();
    return {
        headline: uiTranslate(lang, pack.headline),
        detail: uiTranslate(lang, pack.detail),
        links: pack.links.map((l) => ({ ...l, label: uiTranslate(lang, l.label) })),
    };
}

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
            'When payment lands, record it in Accounting and move the deal to Closed won if this was the last step. Review revenue in Daily summary.',
        links: [
            { label: 'Billing', path: '/dashboard/business/billing' },
            { label: 'Accounting', path: '/dashboard/accounting' },
            { label: 'Deals', path: '/dashboard/deals' },
            { label: 'Daily summary', path: '/dashboard/business/daily-summary' },
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
};

export type ActionNextStepKey = keyof typeof PACKS;

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
                className="max-w-sm w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-600 bg-slate-900 shadow-xl p-4 text-left pointer-events-auto"
            >
                <p className="text-sm font-bold text-white leading-snug">{pack.headline}</p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">{pack.detail}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                    {pack.links.map((l) => (
                        <button
                            key={l.path + l.label}
                            type="button"
                            onClick={() => {
                                navigate(l.path);
                                toast.dismiss(tid.id);
                            }}
                            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors"
                        >
                            {l.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={() => toast.dismiss(tid.id)}
                    className="mt-3 text-[10px] text-slate-500 hover:text-slate-400 uppercase tracking-wide"
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
                className="max-w-sm w-[min(100vw-2rem,22rem)] rounded-xl border border-teal-500/40 bg-slate-900 shadow-xl p-4 text-left pointer-events-auto"
            >
                <p id="inv-next-title" className="text-sm font-bold text-white leading-snug">
                    {uiTranslate(lang, 'Invoice saved')}
                </p>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
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
                        className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                    >
                        {uiTranslate(lang, 'Not yet')}
                    </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-slate-700">
                    <button
                        type="button"
                        onClick={() => {
                            navigate('/dashboard/business/billing');
                            toast.dismiss(t.id);
                        }}
                        className="text-[11px] font-semibold px-2 py-1 rounded-md text-teal-400 hover:text-teal-300"
                    >
                        {uiTranslate(lang, 'Open Billing')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            navigate('/dashboard/business/messages');
                            toast.dismiss(t.id);
                        }}
                        className="text-[11px] font-semibold px-2 py-1 rounded-md text-teal-400 hover:text-teal-300"
                    >
                        {uiTranslate(lang, 'Messages')}
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => toast.dismiss(t.id)}
                    className="mt-2 text-[10px] text-slate-500 hover:text-slate-400 uppercase tracking-wide"
                >
                    {uiTranslate(lang, 'Dismiss')}
                </button>
            </div>
        ),
        { id, duration: 20000 }
    );
}
