'use client';

import { IconBonnie } from '@/components/icons/alphaclone';
import { useBonnieDrawerOptional, type BonnieMode, type BonnieRecordContext } from '@/contexts/BonnieDrawerContext';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';

interface AskBonnieButtonProps {
  contexts?: BonnieRecordContext[];
  mode?: BonnieMode;
  label?: string;
  className?: string;
  compact?: boolean;
}

export function AskBonnieButton({
  contexts,
  mode = 'ask',
  label = 'Ask Bonnie',
  className,
  compact,
}: AskBonnieButtonProps) {
  const drawer = useBonnieDrawerOptional();
  if (!drawer) return null;

  return (
    <button
      type="button"
      onClick={() => drawer.openDrawer({ mode, contexts })}
      className={cn(
        compact
          ? 'inline-flex items-center gap-1.5 min-h-8 px-2.5 rounded-[8px] text-xs font-semibold text-[var(--brand-violet-500)] border border-[var(--ws-border)] hover:bg-[var(--ws-hover)]'
          : WORKSPACE.action.bonnie,
        className
      )}
    >
      <IconBonnie size={compact ? 14 : 16} variant="duotone" decorative />
      {label}
    </button>
  );
}
