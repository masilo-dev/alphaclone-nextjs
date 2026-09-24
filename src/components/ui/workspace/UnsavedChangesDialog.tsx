'use client';

import React from 'react';
import { Modal, Button } from '@/components/ui/UIComponents';
import { AlertTriangle } from 'lucide-react';

export interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onContinueEditing: () => void;
  onDiscard: () => void;
  title?: string;
  description?: string;
}

export function UnsavedChangesDialog({
  isOpen,
  onContinueEditing,
  onDiscard,
  title = 'Unsaved changes',
  description = 'You have unsaved changes that will be lost if you leave now. Do you want to discard your changes or continue editing?',
}: UnsavedChangesDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onContinueEditing} title={title} maxWidth="max-w-md">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-amber-500/10 text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <p className="type-caption text-[var(--ws-text-secondary)] text-sm leading-relaxed">
            {description}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button type="button" variant="outline" onClick={onContinueEditing}>
            Continue editing
          </Button>
          <Button type="button" variant="danger" onClick={onDiscard}>
            Discard changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default UnsavedChangesDialog;
