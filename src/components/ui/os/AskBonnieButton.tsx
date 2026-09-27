'use client';

import { IconBonnie } from '@/components/icons/alphaclone';
import { useBonnieDrawerOptional, type BonnieMode, type BonnieRecordContext } from '@/contexts/BonnieDrawerContext';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';
import { useRelationshipOptional } from '@/contexts/RelationshipContext';
import { relationshipBonnieContexts } from '@/lib/crm/relationshipNavigation';

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
  const relationship = useRelationshipOptional();
  if (!drawer) return null;
  const inheritedContexts = relationshipBonnieContexts(relationship);
  const effectiveContexts = contexts?.length ? contexts : inheritedContexts;

  return (
    <button
      type="button"
      onClick={() => drawer.openDrawer({ mode, contexts: effectiveContexts })}
      className={cn(
        compact
          ? 'inline-flex items-center gap-1.5 min-h-8 px-2.5 rounded-[8px] type-caption font-semibold text-[var(--brand-violet-500)] border border-[var(--ws-border)] hover:bg-[var(--ws-hover)]'
          : WORKSPACE.action.bonnie,
        className
      )}
    >
      <IconBonnie size={compact ? 14 : 16} variant="duotone" decorative />
      {label}
    </button>
  );
}
