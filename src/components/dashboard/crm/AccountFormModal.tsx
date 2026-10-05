'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/UIComponents';

type AccountFormModalProps = {
  open: boolean;
  title: string;
  initialName?: string;
  submitLabel: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
};

export function AccountFormModal({
  open,
  title,
  initialName = '',
  submitLabel,
  loading = false,
  onClose,
  onSubmit,
}: AccountFormModalProps) {
  const [name, setName] = useState(initialName);

  React.useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--ws-border)] bg-[var(--ws-panel)] p-5 space-y-4">
        <h2 className="text-lg font-bold text-[var(--ws-text-primary)]">{title}</h2>
        <Input
          label="Account name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Company name"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl type-ui text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]">
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || !name.trim()}
            onClick={() => void onSubmit(name.trim())}
            className="px-4 py-2 rounded-xl bg-teal-600 text-[var(--text-inverse)] type-ui font-semibold disabled:opacity-50"
          >
            {loading ? 'Saving…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
