/**
 * Currency Exchange Rate Service
 * Powered by api.frankfurter.app (100% Free, Unlimited, Official ECB Rates)
 */

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY' | 'ZAR' | 'INR';

export interface ExchangeRatesResponse {
  amount: number;
  base: CurrencyCode;
  date: string;
  rates: Record<CurrencyCode, number>;
}

const SUPPORTED_CURRENCIES: { code: CurrencyCode; name: string; symbol: string }[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
];

let rateCache: { rates: Record<string, number>; timestamp: number } | null = null;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

export const currencyService = {
  getSupportedCurrencies() {
    return SUPPORTED_CURRENCIES;
  },

  async getExchangeRates(base: CurrencyCode = 'USD'): Promise<Record<CurrencyCode, number>> {
    if (rateCache && Date.now() - rateCache.timestamp < CACHE_DURATION) {
      return rateCache.rates as Record<CurrencyCode, number>;
    }

    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`);
      if (!res.ok) throw new Error(`Frankfurter API error: ${res.statusText}`);
      const data: ExchangeRatesResponse = await res.json();
      
      const rates = { ...data.rates, [base]: 1.0 } as Record<CurrencyCode, number>;
      rateCache = { rates, timestamp: Date.now() };
      return rates;
    } catch (err) {
      console.warn('[currencyService] Fetch failed, using fallback rates:', err);
      // Reliable fallback rates if offline
      return {
        USD: 1.0,
        EUR: 0.92,
        GBP: 0.79,
        CAD: 1.36,
        AUD: 1.52,
        JPY: 154.5,
        ZAR: 18.4,
        INR: 83.5,
      };
    }
  },

  convertAmount(amount: number, fromRate: number, toRate: number): number {
    if (!fromRate || !toRate) return amount;
    return (amount / fromRate) * toRate;
  },
};
