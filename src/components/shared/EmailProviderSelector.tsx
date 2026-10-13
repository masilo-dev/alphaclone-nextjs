'use client';

import React from 'react';
import { Check, Mail } from 'lucide-react';
import {
  DELIVERY_PROVIDER_LABELS,
  type DeliveryEmailProvider,
} from '@/lib/email/emailProviderOptions';

export type EmailProviderOption = {
  id: DeliveryEmailProvider;
  label: string;
  connected: boolean;
  native?: boolean;
  campaigns?: boolean;
};

type EmailProviderSelectorProps = {
  value: DeliveryEmailProvider;
  onChange: (provider: DeliveryEmailProvider) => void;
  providers: EmailProviderOption[];
  /** Show "Auto" chip using workspace default */
  showAuto?: boolean;
  compact?: boolean;
  disabled?: boolean;
};

export default function EmailProviderSelector({
  value,
  onChange,
  providers,
  showAuto = true,
  compact = false,
  disabled = false,
}: EmailProviderSelectorProps) {
  const options: EmailProviderOption[] = showAuto
    ? [{ id: 'auto', label: DELIVERY_PROVIDER_LABELS.auto, connected: true }, ...providers]
    : providers;

  const visible = options.filter((p) => p.id === 'auto' || p.connected);

  if (!visible.length) return <p role="status" className="text-sm text-[var(--ws-text-secondary)]">Connect an email account to choose a sender.</p>;

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <label className="type-caption text-[var(--ws-text-muted)] uppercase font-black tracking-widest block px-0.5">
        Send via
      </label>
      {!visible.some(provider => provider.id === value) ? <p role="status" className="text-sm text-[var(--warning-text)]">The previously selected sender is not connected. Choose an available sender.</p> : null}
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'pb-1'}`}>
        {visible.map((provider) => {
          const selected = value === provider.id;
          const isDisabled = disabled || (provider.id !== 'auto' && !provider.connected);
          return (
            <button
              key={provider.id}
              type="button"
              disabled={isDisabled}
              aria-pressed={selected}
              onClick={() => !isDisabled && onChange(provider.id)}
              className={`inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-xl type-caption font-medium border transition-all ${
                selected
                  ? 'bg-teal-600/20 border-teal-500/40 text-[var(--brand-blue-300)]'
                  : isDisabled
                    ? 'border-white/5 text-slate-600 cursor-not-allowed opacity-50'
                    : 'border-[var(--ws-border)] text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]'
              }`}
            >
              {provider.native && <Mail className="w-3 h-3" />}
              {provider.label}
              {provider.campaigns && (
                <span className="type-ui px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 normal-case font-bold">
                  + campaigns
                </span>
              )}
              {selected && <Check className="w-3 h-3" />}
            </button>
          );
        })}
      </div>
      <p className="type-card-description text-[var(--ws-text-muted)] leading-relaxed">
        Choose the connected account for replies, invoices, and document email. Campaign delivery is configured separately.
      </p>
    </div>
  );
}
