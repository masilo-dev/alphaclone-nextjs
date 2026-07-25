'use client';

import Link from 'next/link';
import { IconBonnie } from '@/components/icons/alphaclone';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface BonnieInsightCardProps {
  message: string;
  actionLabel?: string;
  href?: string;
  onAction?: () => void;
  className?: string;
}

export function BonnieInsightCard({
  message,
  actionLabel = 'Review',
  href,
  onAction,
  className,
}: BonnieInsightCardProps) {
  const action = href ? (
    <Link
      href={href}
      className="text-sm font-semibold text-[var(--brand-violet-500)] hover:text-[var(--brand-violet-400)]"
    >
      {actionLabel}
    </Link>
  ) : onAction ? (
    <button
      type="button"
      onClick={onAction}
      className="text-sm font-semibold text-[var(--brand-violet-500)] hover:text-[var(--brand-violet-400)]"
    >
      {actionLabel}
    </button>
  ) : null;

  return (
    <aside
      className={cn(WORKSPACE.panel.base, 'ac-bonnie-insight p-4 flex items-start gap-3', className)}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] ac-bonnie-insight__icon text-[var(--brand-violet-500)] shrink-0">
        <IconBonnie size={18} variant="duotone" decorative />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[var(--brand-violet-500)] mb-1">Bonnie insight</p>
        <p className="text-sm text-[var(--ws-text-primary)]">{message}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </aside>
  );
}
