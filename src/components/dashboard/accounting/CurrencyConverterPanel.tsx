'use client';

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
            <h4 className="text-xs font-black text-white uppercase tracking-wider">Multi-Currency FX Engine</h4>
            <p className="text-[11px] text-slate-400">Real-time European Central Bank rates</p>
          </div>
        </div>
        <button
          onClick={loadRates}
          disabled={loading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Refresh Rates"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center pt-1">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs text-slate-500">{baseSymbol}</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            From
          </label>
          <select
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-indigo-500/50"
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            To
          </label>
          <select
            value={targetCurrency}
            onChange={(e) => setTargetCurrency(e.target.value as CurrencyCode)}
            className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-indigo-500/50"
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase font-bold text-indigo-300">Converted Value</p>
          <p className="text-lg font-black text-white mt-0.5">
            {targetSymbol} {Number(convertedAmount).toLocaleString()} <span className="text-xs text-indigo-300 font-normal">{targetCurrency}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500">Exchange Rate</p>
          <p className="text-xs font-bold text-slate-300 mt-0.5">
            1 {baseCurrency} = {rates[targetCurrency] ? rates[targetCurrency].toFixed(4) : '...'} {targetCurrency}
          </p>
        </div>
      </div>
    </div>
  );
}
