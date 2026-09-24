'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, CircleDot, PlayCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SEMANTIC_STATUS_STYLES, type SemanticStatus } from '@/lib/ui/statusSemantics';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProgressiveGuidance } from '@/hooks/useProgressiveGuidance';
import { resolveCanonicalPath } from '@/lib/dashboard/canonicalRoutes';

export interface ExecutionDecisionStep {
  id: string;
  label: string;
  title: string;
  description: string;
  status?: SemanticStatus;
  href?: string;
}

interface ExecutionDecisionGuideProps {
  title?: string;
  description?: string;
  steps: ExecutionDecisionStep[];
  onNavigate?: (href: string) => void;
  className?: string;
}

function StepIcon({ status }: { status: SemanticStatus }) {
  if (status === 'success') return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (status === 'active' || status === 'running') return <PlayCircle className="h-4 w-4" aria-hidden />;
  if (status === 'blocked' || status === 'danger') return <ShieldCheck className="h-4 w-4" aria-hidden />;
  return <CircleDot className="h-4 w-4" aria-hidden />;
}

export function ExecutionDecisionGuide({
  title = 'Execution guide',
  description = 'Follow the steps in order. Colors mean the same thing across the workspace.',
  steps,
  onNavigate,
  className,
}: ExecutionDecisionGuideProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const guideKey = steps[0]?.id ? `${title}:${steps[0].id}` : title;
  const { showGuidance } = useProgressiveGuidance(guideKey);

  const handleNavigate = onNavigate ?? ((href: string) => {
    router.push(resolveCanonicalPath(href));
  });

  if (!steps.length || !showGuidance) return null;

  return (
    <section className={cn('ac-workspace-panel rounded-lg p-3', className)} aria-label={t(title)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="type-caption font-black uppercase tracking-widest text-[var(--brand-blue-400)]">{t(title)}</p>
          <p className="mt-0.5 type-card-description leading-5 text-slate-400">{t(description)}</p>
        </div>
        <div className="flex flex-wrap gap-2 type-caption font-bold uppercase tracking-wider">
          {(['success', 'running', 'warning', 'danger'] as SemanticStatus[]).map((status) => {
            const style = SEMANTIC_STATUS_STYLES[status];
            return (
              <span key={status} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1', style.badge)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
                {t(style.label)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {steps.map((step, index) => {
          const status = step.status || (index === 0 ? 'active' : 'neutral');
          const style = SEMANTIC_STATUS_STYLES[status];
          const content = (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className={cn('inline-flex items-center gap-2 type-caption font-black uppercase tracking-widest', style.text)}>
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-full border', style.badge)}>
                    <StepIcon status={status} />
                  </span>
                  {t(step.label)}
                </span>
                {step.href ? <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden /> : null}
              </div>
              <h3 className="mt-2 type-ui font-semibold text-white">{t(step.title)}</h3>
              <p className="mt-0.5 type-card-description leading-5 text-slate-400">{t(step.description)}</p>
            </>
          );

          if (step.href) {
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleNavigate(step.href!)}
                className={cn('min-h-0 rounded-lg border p-3 text-left transition-all hover:bg-slate-900/70 cursor-pointer', style.border, style.bg)}
              >
                {content}
              </button>
            );
          }

          return (
            <div key={step.id} className={cn('min-h-0 rounded-lg border p-3', style.border, style.bg)}>
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
