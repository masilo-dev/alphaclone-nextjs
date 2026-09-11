'use client';

import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import {
  DELIVERY_PROVIDER_LABELS,
  resolveAutoProvider,
  type DeliveryEmailProvider,
} from '@/lib/email/emailProviderOptions';
import type { EmailProviderOption } from '@/components/shared/EmailProviderSelector';

interface DeliveryProviderIndicatorProps {
  value: DeliveryEmailProvider;
  onChange: (provider: DeliveryEmailProvider) => void;
  providers: EmailProviderOption[];
  disabled?: boolean;
}

export default function DeliveryProviderIndicator({
  value,
  onChange,
  providers,
  disabled = false,
}: DeliveryProviderIndicatorProps) {
  const [expanded, setExpanded] = useState(false);

  const connected = providers.filter((p) => p.connected).map((p) => p.id);
  const resolved =
    value === 'auto'
      ? resolveAutoProvider(connected, null)
      : value;

  const resolvedLabel =
    resolved === 'auto'
      ? 'No provider connected'
      : DELIVERY_PROVIDER_LABELS[resolved] || resolved;

  const manualOptions: DeliveryEmailProvider[] = ['auto', ...connected];

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest block">
        Delivery
      </label>
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-slate-300">
          {value === 'auto' ? (
            <>
              Automatic · <span className="text-teal-400">{resolvedLabel}</span>
            </>
          ) : (
            <span className="text-teal-400">{DELIVERY_PROVIDER_LABELS[value]}</span>
          )}
        </span>
        {manualOptions.length > 1 && !disabled ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-slate-500 hover:text-slate-300 uppercase font-semibold tracking-wide inline-flex items-center gap-0.5"
          >
            Change
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        ) : null}
      </div>
      {expanded && manualOptions.length > 1 ? (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {manualOptions.map((id) => {
            const selected = value === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onChange(id);
                  setExpanded(false);
                }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                  selected
                    ? 'bg-teal-600/20 border-teal-500/40 text-teal-300'
                    : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                {id === 'auto' ? 'Automatic' : DELIVERY_PROVIDER_LABELS[id]}
                {selected ? <Check className="w-3 h-3" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
