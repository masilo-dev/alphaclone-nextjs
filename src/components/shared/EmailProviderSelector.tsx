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

  if (visible.length <= 1) return null;

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block px-0.5">
        Send via
      </label>
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'pb-1'}`}>
        {visible.map((provider) => {
          const selected = value === provider.id;
          const isDisabled = disabled || (provider.id !== 'auto' && !provider.connected);
          return (
            <button
              key={provider.id}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(provider.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${
                selected
                  ? 'bg-teal-600/20 border-teal-500/40 text-teal-300'
                  : isDisabled
                    ? 'border-white/5 text-slate-600 cursor-not-allowed opacity-50'
                    : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              {provider.native && <Mail className="w-3 h-3" />}
              {provider.label}
              {provider.campaigns && (
                <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300 normal-case font-bold">
                  + campaigns
                </span>
              )}
              {selected && <Check className="w-3 h-3" />}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        Marketing campaigns use Zoho natively. This choice applies to replies, invoices, and document email.
      </p>
    </div>
  );
}
