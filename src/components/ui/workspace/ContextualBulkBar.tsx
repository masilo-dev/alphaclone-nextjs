'use client';

import React from 'react';
import { X, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface ContextualBulkBarProps {
  /** Number of selected items. If 0, the bar is completely hidden */
  selectedCount: number;
  /** Action buttons slot (e.g. Change Status, Assign, Email, Delete) */
  actions: React.ReactNode;
  /** Handler to clear current selection */
  onClearSelection: () => void;
  /** Singular and plural item name (default: "item" / "items") */
  itemLabel?: { singular: string; plural: string };
  className?: string;
  /** Position variant: inline at table top (default) or sticky bottom */
  position?: 'inline' | 'floating';
}

/**
 * ContextualBulkBar.
 * Only appears when selectedCount > 0.
 * Completely disappears when nothing is selected so zero workspace space is wasted.
 */
export function ContextualBulkBar({
  selectedCount,
  actions,
  onClearSelection,
  itemLabel = { singular: 'item', plural: 'items' },
  className,
  position = 'inline',
}: ContextualBulkBarProps) {
  if (selectedCount === 0) return null;

  const countText = `${selectedCount} ${
    selectedCount === 1 ? itemLabel.singular : itemLabel.plural
  } selected`;

  const content = (
    <div
      role="region"
      aria-label="Bulk actions"
      aria-live="polite"
      className={cn(
        'flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-[var(--brand-blue-500)]/30 bg-[var(--brand-blue-500)]/10 text-[var(--ws-text-primary)] shadow-sm animate-fade-in',
        position === 'floating' &&
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[90vw] bg-[var(--ws-panel)] border-[var(--brand-blue-500)]/40 shadow-2xl backdrop-blur-md',
        className
      )}
    >
      {/* Left: Count indicator + Deselect button */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm text-[var(--brand-blue-400)] shrink-0">
          <CheckSquare className="w-4 h-4" aria-hidden="true" />
          <span>{countText}</span>
        </div>

        <button
          type="button"
          onClick={onClearSelection}
          className="inline-flex items-center gap-1 text-xs text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] transition-colors py-0.5 px-2 rounded-md hover:bg-[var(--ws-hover)]"
          aria-label="Deselect all"
        >
          <X className="w-3 h-3" aria-hidden="true" />
          <span>Deselect</span>
        </button>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {actions}
      </div>
    </div>
  );

  return content;
}

export default ContextualBulkBar;
