'use client';

import { ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { analyzeFunnel, type FunnelStage, getSemanticStyles } from '@/lib/analytics/funnelAndPriority';
import { WORKSPACE } from '@/constants/design';

export function FunnelVisualization({
  stages,
  multiplierName = 'records',
  showBenchmarks = true,
  onStageClick,
  className,
}: {
  stages: FunnelStage[];
  multiplierName?: string;
  showBenchmarks?: boolean;
  onStageClick?: (stageKey: string) => void;
  className?: string;
}) {
  const analysis = analyzeFunnel(stages, { multiplierName });
  const maxCount = Math.max(...analysis.stages.map((s) => s.count), 1);
  const topCount = analysis.stages[0]?.count ?? 0;

  return (
    <div className={cn(WORKSPACE.panel.base, 'p-4 md:p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className={WORKSPACE.typography.sectionTitle}>Funnel & conversion</h2>
          <p className="text-[11.5px] text-[var(--ws-text-muted)] mt-0.5">
            {topCount > 0 ? (
              <>
                {topCount.toLocaleString()} {multiplierName} at top · {analysis.overallConversionPct}% end-to-end
              </>
            ) : (
              <>Add {multiplierName} to begin tracking the funnel</>
            )}
          </p>
        </div>
        {(() => {
          const bn = analysis.bottleneck;
          if (!bn) {
            return (
              <div className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10.5px] font-bold uppercase border',
                getSemanticStyles('success').bg, getSemanticStyles('success').text, getSemanticStyles('success').border,
              )}>
                <CheckCircle2 className="w-3 h-3" />
                No severe drop-offs
              </div>
            );
          }
          const styleStr =
            bn.severity === 'critical'
              ? getSemanticStyles('critical').bg + ' ' + getSemanticStyles('critical').text + ' ' + getSemanticStyles('critical').border
              : getSemanticStyles('warning').bg + ' ' + getSemanticStyles('warning').text + ' ' + getSemanticStyles('warning').border;
          return (
            <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10.5px] font-bold uppercase border', styleStr)}>
              <AlertCircle className="w-3 h-3" />
              Bottleneck
            </div>
          );
        })()}
      </div>

      <ol className="space-y-1.5">
        {analysis.stages.map((stage, i) => {
          const next = analysis.stages[i + 1];
          const conversion = next
            ? stage.count > 0
              ? Math.round((next.count / stage.count) * 1000) / 10
              : 0
            : null;
          const drop = conversion != null ? 100 - conversion : null;
          const isBottleneck = analysis.bottleneck?.stageKey === stage.key;
          const severity = isBottleneck
            ? analysis.bottleneck?.severity === 'critical'
              ? 'critical'
              : 'warning'
            : 'neutral';
          const sem = getSemanticStyles(severity);
          const widthPct = Math.max(8, (stage.count / maxCount) * 100);
          const cumulative =
            topCount > 0 ? Math.round((stage.count / topCount) * 1000) / 10 : 0;
          const benchmarkGap =
            showBenchmarks && stage.benchmarkConversion != null && conversion != null
              ? Math.round((conversion - stage.benchmarkConversion) * 10) / 10
              : null;

          return (
            <li key={stage.key}>
              <button
                type="button"
                disabled={!onStageClick}
                onClick={() => onStageClick?.(stage.key)}
                className={cn(
                  'w-full text-left rounded-lg p-3 border transition-colors',
                  isBottleneck ? sem.border + ' ' + sem.bg : 'border-[var(--ws-border)] hover:bg-white/[0.03]',
                  onStageClick ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-[var(--ws-text-primary)] truncate">
                        {stage.label}
                      </p>
                      {isBottleneck ? (
                        <span className={cn(
                          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase border',
                          sem.bg, sem.text, sem.border,
                        )}>
                          {severity === 'critical' ? 'Severe' : 'Moderate'} drop
                        </span>
                      ) : null}
                      {stage.description ? (
                        <span className="text-[10.5px] text-[var(--ws-text-muted)]">
                          · {stage.description}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden max-w-[320px]">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          isBottleneck ? sem.dot : 'bg-[var(--brand-blue-500)]',
                        )}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="min-w-[90px] text-right">
                    <p className="text-[15px] font-black tabular-nums text-[var(--ws-text-primary)]">
                      {stage.count.toLocaleString()}
                    </p>
                    <p className="text-[10.5px] text-[var(--ws-text-muted)] tabular-nums">
                      {cumulative}% of top
                    </p>
                  </div>
                </div>

                {next ? (
                  <div className="mt-2 pt-2 border-t border-white/[0.03] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="inline-flex items-center gap-1 text-[var(--ws-text-secondary)]">
                      <ChevronRight className="w-3 h-3" />
                      <span className="font-semibold text-[var(--ws-text-primary)] tabular-nums">
                        {conversion}%
                      </span>
                      <span>to {next.label.toLowerCase()}</span>
                    </span>
                    {drop != null ? (
                      <span className={cn(
                        'tabular-nums font-medium',
                        drop >= 50 ? 'text-[var(--error-text)]' : drop >= 30 ? 'text-[var(--warning-text)]' : 'text-[var(--ws-text-muted)]',
                      )}>
                        {drop}% drop-off
                      </span>
                    ) : null}
                    {benchmarkGap != null ? (
                      <span className={cn(
                        'tabular-nums font-bold',
                        benchmarkGap >= 0
                          ? 'text-[var(--success-text)]'
                          : 'text-[var(--error-text)]',
                      )}>
                        {benchmarkGap >= 0 ? '+' : ''}{benchmarkGap}pp vs benchmark
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      {analysis.bottleneck ? (
        <div className="mt-4 pt-4 border-t border-white/[0.04]">
          <p className="text-[12px] font-semibold text-[var(--ws-text-primary)] mb-1">
            Where to focus first
          </p>
          <p className="text-[11.5px] text-[var(--ws-text-secondary)] leading-relaxed">
            {analysis.bottleneck.recommendation}
          </p>
        </div>
      ) : null}
    </div>
  );
}
