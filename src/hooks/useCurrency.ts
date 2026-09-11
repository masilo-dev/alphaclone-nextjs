'use client';

import { useMemo } from 'react';
import { useTenant } from '@/contexts/TenantContext';

/**
 * useCurrency Hook
 * Provides dynamic, locale-aware currency formatting based on Tenant settings.
 */
export function useCurrency() {
    const { currentTenant } = useTenant();

    // Get currency from tenant settings or default to USD
    // Prepared for future multi-currency support where tenants can choose their base currency.
    const currencyCode = useMemo(() => {
        return currentTenant?.settings?.billing?.currency || 'USD';
    }, [currentTenant]);

    /**
     * Format a numeric amount into a currency string
     */
    const format = useMemo(() => {
        return (amount: number, options: Intl.NumberFormatOptions & { currencyOverride?: string } = {}) => {
            const { currencyOverride, ...intlOptions } = options;
            let safeAmount = Number(amount);
            if (isNaN(safeAmount)) {
                safeAmount = 0;
            }
            try {
                return new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: currencyOverride || currencyCode,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                    ...intlOptions,
                }).format(safeAmount);
            } catch (err) {
                console.error('Currency formatting error:', err);
                // Fallback to simple formatting if Intl fails
                const finalCurrency = currencyOverride || currencyCode;
                const symbol = finalCurrency === 'USD' ? '$' : finalCurrency + ' ';
                return `${symbol}${safeAmount.toLocaleString()}`;
            }
        };
    }, [currencyCode]);

    /**
     * Get the currency symbol (e.g. $, €, £)
     */
    const symbol = useMemo(() => {
        try {
            // Extract symbol from formatted zero
            const formatted = new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: currencyCode,
            }).format(0);
            return formatted.replace(/[0.,\s]/g, '');
        } catch (err) {
            return currencyCode === 'USD' ? '$' : currencyCode;
        }
    }, [currencyCode]);

    return {
        currencyCode,
        symbol,
        format,
    };
}
