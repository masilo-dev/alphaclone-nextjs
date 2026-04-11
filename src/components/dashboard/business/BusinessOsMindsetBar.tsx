'use client';

import { Route } from 'lucide-react';
import { getBusinessOsGuidance } from '@/lib/businessOsGuidance';

type Props = {
    activeTab: string;
    setActiveTab: (tab: string) => void;
};

export function BusinessOsMindsetBar({ activeTab, setActiveTab }: Props) {
    const g = getBusinessOsGuidance(activeTab);
    const compact = g.variant === 'compact';

    return (
        <aside
            aria-label="Business operating guidance"
            className={`rounded-xl border border-slate-800/80 bg-slate-900/70 shrink-0 ${
                compact ? 'px-3 py-2.5 mb-3' : 'px-4 py-3 mb-4 md:mb-6'
            }`}
        >
            <div className="flex items-start gap-2.5">
                <div
                    className={`rounded-lg bg-violet-500/10 border border-violet-500/20 shrink-0 ${compact ? 'p-1.5' : 'p-2'}`}
                >
                    <Route className={`text-violet-400 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Business OS mindset
                    </p>
                    <p
                        className={`text-slate-200 font-medium leading-snug ${compact ? 'text-xs' : 'text-sm'}`}
                    >
                        {g.mindset}
                    </p>
                    {!compact && (
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{g.outcome}</p>
                    )}
                    {compact && (
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{g.outcome}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2.5">
                        {g.actions.map((a) => (
                            <button
                                key={a.tab + a.label}
                                type="button"
                                onClick={() => setActiveTab(a.tab)}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/80 text-teal-400 hover:text-teal-300 hover:border-teal-500/40 transition-colors"
                            >
                                {a.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
}
