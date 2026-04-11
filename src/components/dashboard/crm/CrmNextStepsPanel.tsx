'use client';

import Link from 'next/link';
import { ListChecks, ArrowRight } from 'lucide-react';
import type { CrmNextStepItem } from '../../../lib/crmNextSteps';

type ItemWithAction = CrmNextStepItem & { onAction?: () => void };

export function CrmNextStepsPanel({
    heading,
    subheading,
    items,
}: {
    heading: string;
    subheading?: string;
    items: ItemWithAction[];
}) {
    if (items.length === 0) return null;

    return (
        <section
            aria-label={heading}
            className="rounded-xl border border-teal-500/25 bg-gradient-to-br from-teal-950/40 to-slate-900/60 px-4 py-3 mb-4"
        >
            <div className="flex items-start gap-3 mb-3">
                <div className="mt-0.5 p-2 rounded-lg bg-teal-500/15 border border-teal-500/20 shrink-0">
                    <ListChecks className="w-4 h-4 text-teal-400" aria-hidden />
                </div>
                <div className="min-w-0">
                    <h2 className="text-sm font-bold text-white tracking-tight">{heading}</h2>
                    {subheading ? (
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{subheading}</p>
                    ) : null}
                </div>
            </div>
            <ul className="space-y-2.5">
                {items.map((item) => {
                    const border =
                        item.tone === 'urgent'
                            ? 'border-amber-500/30 bg-amber-950/20'
                            : item.tone === 'success'
                              ? 'border-emerald-500/25 bg-emerald-950/15'
                              : 'border-slate-700/80 bg-slate-900/40';
                    return (
                        <li
                            key={item.id}
                            className={`rounded-lg border px-3 py-2.5 ${border}`}
                        >
                            <p className="text-sm font-semibold text-slate-100 leading-snug">{item.title}</p>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.detail}</p>
                            {(item.actionLabel && item.href) || (item.actionLabel && item.onAction) ? (
                                <div className="mt-2">
                                    {item.onAction ? (
                                        <button
                                            type="button"
                                            onClick={item.onAction}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
                                        >
                                            {item.actionLabel}
                                            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                                        </button>
                                    ) : item.href ? (
                                        <Link
                                            href={item.href}
                                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
                                        >
                                            {item.actionLabel}
                                            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                                        </Link>
                                    ) : null}
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
