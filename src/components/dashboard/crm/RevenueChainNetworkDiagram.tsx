'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RevenueChainNetworkNode } from '@/lib/revenueLifecycle';

type RevenueChainNetworkDiagramProps = {
    nodes: RevenueChainNetworkNode[];
    healthScore: number;
    urgentCount: number;
    className?: string;
};

const TONE_STYLES: Record<RevenueChainNetworkNode['tone'], { ring: string; fill: string; text: string }> = {
    ok: { ring: 'stroke-teal-400/70', fill: 'fill-teal-500/20', text: 'text-teal-200' },
    warn: { ring: 'stroke-amber-400/80', fill: 'fill-amber-500/25', text: 'text-amber-200' },
    urgent: { ring: 'stroke-rose-400/90', fill: 'fill-rose-500/30', text: 'text-rose-200' },
    idle: { ring: 'stroke-slate-600/80', fill: 'fill-slate-800/60', text: 'text-slate-400' },
};

export function RevenueChainNetworkDiagram({
    nodes,
    healthScore,
    urgentCount,
    className = '',
}: RevenueChainNetworkDiagramProps) {
    const router = useRouter();
    const [activeStep, setActiveStep] = useState<string | null>(null);

    const layout = useMemo(() => {
        const cx = 160;
        const cy = 160;
        const radius = 118;
        const nodeRadius = 28;
        return nodes.map((node, index) => {
            const angle = (-Math.PI / 2) + (index / nodes.length) * Math.PI * 2;
            return {
                node,
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius,
                angle,
                nodeRadius,
            };
        });
    }, [nodes]);

    const activeNode = layout.find((l) => l.node.step === activeStep)?.node ?? null;

    return (
        <div className={`space-y-3 ${className}`}>
            <div className="relative mx-auto w-full max-w-[320px]">
                <svg viewBox="0 0 320 320" className="h-auto w-full" role="img" aria-label="Revenue chain network">
                    <defs>
                        <radialGradient id="chainHealthGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="rgb(45 212 191 / 0.35)" />
                            <stop offset="100%" stopColor="rgb(15 23 42 / 0)" />
                        </radialGradient>
                    </defs>

                    <circle cx="160" cy="160" r="92" fill="url(#chainHealthGlow)" />

                    {layout.map((entry, index) => {
                        const next = layout[(index + 1) % layout.length];
                        return (
                            <line
                                key={`edge-${entry.node.step}`}
                                x1={entry.x}
                                y1={entry.y}
                                x2={next.x}
                                y2={next.y}
                                stroke="rgb(148 163 184 / 0.25)"
                                strokeWidth="1.5"
                                strokeDasharray={entry.node.tone === 'idle' && next.node.tone === 'idle' ? '4 4' : undefined}
                            />
                        );
                    })}

                    <circle cx="160" cy="160" r="52" className="fill-slate-900/80 stroke-white/10" strokeWidth="1" />
                    <text x="160" y="152" textAnchor="middle" className="fill-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                        Health
                    </text>
                    <text x="160" y="178" textAnchor="middle" className="fill-teal-300 text-[22px] font-black">
                        {healthScore}%
                    </text>

                    {layout.map((entry) => {
                        const styles = TONE_STYLES[entry.node.tone];
                        const isActive = activeStep === entry.node.step;
                        return (
                            <g
                                key={entry.node.step}
                                className="cursor-pointer"
                                onClick={() => setActiveStep(entry.node.step)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        setActiveStep(entry.node.step);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label={`${entry.node.label}: ${entry.node.volume} items${entry.node.leakCount ? `, ${entry.node.leakCount} issues` : ''}`}
                            >
                                <circle
                                    cx={entry.x}
                                    cy={entry.y}
                                    r={entry.nodeRadius + (isActive ? 4 : 0)}
                                    className={`${styles.ring} ${styles.fill}`}
                                    strokeWidth={isActive ? 3 : 2}
                                />
                                <text
                                    x={entry.x}
                                    y={entry.y - 4}
                                    textAnchor="middle"
                                    className={`${styles.text} text-[9px] font-bold uppercase tracking-wide`}
                                >
                                    {entry.node.shortLabel}
                                </text>
                                <text
                                    x={entry.x}
                                    y={entry.y + 10}
                                    textAnchor="middle"
                                    className="fill-white text-[11px] font-black tabular-nums"
                                >
                                    {entry.node.volume}
                                </text>
                                {entry.node.leakCount > 0 && (
                                    <g>
                                        <circle
                                            cx={entry.x + 18}
                                            cy={entry.y - 18}
                                            r="9"
                                            className="fill-rose-500 stroke-slate-950"
                                            strokeWidth="1.5"
                                        />
                                        <text
                                            x={entry.x + 18}
                                            y={entry.y - 14.5}
                                            textAnchor="middle"
                                            className="fill-white text-[8px] font-black"
                                        >
                                            {entry.node.leakCount > 9 ? '9+' : entry.node.leakCount}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {urgentCount > 0 && (
                <p className="text-center text-[10px] text-amber-400/90">
                    {urgentCount} urgent leak{urgentCount === 1 ? '' : 's'} — click a highlighted node to fix.
                </p>
            )}

            {activeNode ? (
                <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold text-white">{activeNode.label}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500 tabular-nums">
                                {activeNode.volume} in pipeline
                                {activeNode.leakCount > 0 ? ` · ${activeNode.leakCount} issue${activeNode.leakCount === 1 ? '' : 's'}` : ''}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push(activeNode.href)}
                            className="shrink-0 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-teal-300 hover:bg-teal-500/20"
                        >
                            {activeNode.actionLabel || 'Open'} →
                        </button>
                    </div>
                    {activeNode.detail && (
                        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{activeNode.detail}</p>
                    )}
                </div>
            ) : (
                <p className="text-center text-[10px] text-slate-500">
                    Click any node to jump to that step in your revenue chain.
                </p>
            )}
        </div>
    );
}
