import { supabase } from '../../lib/supabase';

/**
 * Exchange Rate Service
 * Provides real-time currency conversion using frankfurter.app API
 * with database caching to minimize external requests.
 */
export const exchangeRateService = {
  /**
   * Get the current exchange rate between two currencies
   * @param base The source currency code (e.g., 'USD')
   * @param target The target currency code (e.g., 'EUR')
   */
  async getRate(base: string, target: string): Promise<number> {
    if (base === target) return 1;

    const baseCode = base.toUpperCase();
    const targetCode = target.toUpperCase();

    // 1. Check local cache (exchange_rates table)
    const { data: cached, error: fetchError } = await supabase
      .from('exchange_rates')
      .select('rate, last_updated')
      .eq('base_currency', baseCode)
      .eq('target_currency', targetCode)
      .single();

    // Cache valid for 6 hours to stay within free API usage patterns
    const CACHE_TTL = 1000 * 60 * 60 * 6; 
    const isStale = !cached || (Date.now() - new Date(cached.last_updated).getTime() > CACHE_TTL);

    if (!isStale && cached) {
      return cached.rate;
    }

    // 2. Fetch fresh rates from public API (Frankfurter)
    try {
      const response = await fetch(`https://api.frankfurter.app/latest?from=${baseCode}&to=${targetCode}`);
      
      if (!response.ok) {
        throw new Error(`Frankfurter API returned ${response.status}`);
      }

      const data = await response.json();
      const freshRate = data.rates[targetCode];

      if (freshRate) {
        // Update cache asynchronously
        supabase
          .from('exchange_rates')
          .upsert({
            base_currency: baseCode,
            target_currency: targetCode,
            rate: freshRate,
            last_updated: new Date().toISOString()
          }, { onConflict: 'base_currency,target_currency' })
          .then(({ error }: { error: unknown }) => {
            if (error) console.error('[ExchangeRate] Cache update failed:', error);
          });
        
        return freshRate;
      }
    } catch (err) {
      console.warn(`[ExchangeRate] API fetch failed for ${baseCode}->${targetCode}:`, err);
    }

    // 3. Final fallback: Use stale cache or parity (1.0)
    return cached?.rate || 1.0;
  },

  /**
   * Convert an amount from one currency to another
   */
  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    const rate = await this.getRate(from, to);
    return Number((amount * rate).toFixed(2));
  },

  /**
   * Batch convert multiple amounts (optimization)
   */
  async convertMultiple(items: { amount: number, from: string }[], to: string): Promise<number> {
    let total = 0;
    // Sequential for simplicity, could be parallelized with Promise.all
    for (const item of items) {
      total += await this.convert(item.amount, item.from, to);
    }
    return total;
  }
};
