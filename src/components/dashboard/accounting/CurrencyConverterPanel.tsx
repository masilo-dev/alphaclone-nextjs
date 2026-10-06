'use client';

import { Input as AlphaCloneInput } from '@/components/ui/input';
import { Select as AlphaCloneSelect } from '@/components/ui/select';


import React, { useState, useEffect } from 'react';
import { currencyService, CurrencyCode } from '@/services/currencyService';
import { ArrowRightLeft, DollarSign, Globe, RefreshCw } from 'lucide-react';

export function CurrencyConverterPanel() {
  const currencies = currencyService.getSupportedCurrencies();
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('USD');
  const [targetCurrency, setTargetCurrency] = useState<CurrencyCode>('EUR');
  const [amount, setAmount] = useState<number>(1000);
  const [rates, setRates] = useState<Record<CurrencyCode, number>>({} as any);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadRates();
  }, [baseCurrency]);

  async function loadRates() {
    setLoading(true);
    const r = await currencyService.getExchangeRates(baseCurrency);
    setRates(r);
    setLoading(false);
  }

  const convertedAmount = rates[targetCurrency]
    ? (amount * rates[targetCurrency]).toFixed(2)
    : '0.00';

  const baseSymbol = currencies.find(c => c.code === baseCurrency)?.symbol || '$';
  const targetSymbol = currencies.find(c => c.code === targetCurrency)?.symbol || '€';

  return (
    <div className="ac-workspace-panel rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Globe size={16} />
          </div>
          <div>
            <h4 className="type-caption font-black text-[var(--ws-text-primary)] uppercase tracking-wider">Multi-Currency FX Engine</h4>
            <p className="type-caption text-[var(--ws-text-muted)]">Real-time European Central Bank rates</p>
          </div>
        </div>
        <button
          onClick={loadRates}
          disabled={loading}
          className="p-1.5 rounded-lg text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)] transition-colors"
          title="Refresh Rates"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
        <div>
          <label className="block type-caption font-bold uppercase tracking-wider text-[var(--ws-text-muted)] mb-1">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 type-caption text-[var(--ws-text-muted)]">{baseSymbol}</span>
            <AlphaCloneInput
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full pl-8 pr-3 py-2 font-bold"
            />
          </div>
        </div>

        <div>
          <label className="block type-caption font-bold uppercase tracking-wider text-[var(--ws-text-muted)] mb-1">
            From
          </label>
          <AlphaCloneSelect
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
            className="w-full px-3 py-2 font-bold"
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </AlphaCloneSelect>
        </div>

        <div>
          <label className="block type-caption font-bold uppercase tracking-wider text-[var(--ws-text-muted)] mb-1">
            To
          </label>
          <AlphaCloneSelect
            value={targetCurrency}
            onChange={(e) => setTargetCurrency(e.target.value as CurrencyCode)}
            className="w-full px-3 py-2 font-bold"
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </AlphaCloneSelect>
        </div>
      </div>

      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between">
        <div>
          <p className="type-caption uppercase font-bold text-indigo-300">Converted Value</p>
          <p className="text-lg font-black text-[var(--ws-text-primary)] mt-0.5">
            {targetSymbol} {Number(convertedAmount).toLocaleString()} <span className="type-caption text-indigo-300 font-normal">{targetCurrency}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="type-card-description text-[var(--ws-text-muted)]">Exchange Rate</p>
          <p className="type-card-description font-bold text-[var(--ws-text-secondary)] mt-0.5">
            1 {baseCurrency} = {rates[targetCurrency] ? rates[targetCurrency].toFixed(4) : '...'} {targetCurrency}
          </p>
        </div>
      </div>
    </div>
  );
}
