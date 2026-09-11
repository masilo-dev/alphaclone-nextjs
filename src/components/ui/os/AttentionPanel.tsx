'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export interface AttentionItem {
  id: string;
  reason: string;
  record?: string;
  owner?: string;
  dueDate?: string;
  href: string;
  actionLabel?: string;
  severity?: 'high' | 'medium' | 'low';
}

interface AttentionPanelProps {
  items: AttentionItem[];
  className?: string;
  emptyMessage?: string;
}

export function AttentionPanel({
  items,
  className,
  emptyMessage = 'Nothing needs attention right now.',
}: AttentionPanelProps) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <section className={cn(WORKSPACE.panel.base, 'p-4 md:p-5', className)}>
      <h2 className={WORKSPACE.typography.sectionTitle}>{t('Needs attention')}</h2>
      <p className="mt-1 text-sm text-[var(--ws-text-muted)]">
        Actionable items that should be handled next.
      </p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--ws-text-secondary)]">{t(emptyMessage)}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.slice(0, 6).map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                onClick={(event) => {
                  event.preventDefault();
                  router.push(item.href);
                }}
                className={cn(
                  'flex items-start gap-3 rounded-[12px] border px-3 py-3 transition-colors duration-150',
                  item.severity === 'high'
                    ? 'border-[var(--warning-border)] bg-[var(--warning-surface)]'
                    : 'border-[var(--ws-border)] hover:border-[var(--ws-border-strong)] hover:bg-[var(--ws-hover)]'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--ws-text-primary)]">{t(item.reason)}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--ws-text-muted)]">
                    {item.record ? <span>{t(item.record)}</span> : null}
                    {item.owner ? <span>Owner: {item.owner}</span> : null}
                    {item.dueDate ? <span>Due {item.dueDate}</span> : null}
                  </div>
                  {item.actionLabel ? (
                    <p className="mt-1.5 text-xs font-semibold text-[var(--brand-blue-500)]">
                      {t(item.actionLabel)}
                    </p>
                  ) : null}
                </div>
                <ChevronRight className="w-4 h-4 mt-0.5 text-[var(--ws-text-disabled)] shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
