/** Approved production offer. Annual and future plan checkout are not configured. */
export const STARTER_MONTHLY_USD = 15;
export const STARTER_MONTHLY_CENTS = STARTER_MONTHLY_USD * 100;

export const PLATFORM_MONTHLY_USD = { starter: 15, pro: 45, enterprise: 85 } as const;
export type PlatformPlan = keyof typeof PLATFORM_MONTHLY_USD;
export const PLATFORM_PRICE_ENV = { starter: 'STRIPE_STARTER_MONTHLY_PRICE_ID', pro: 'STRIPE_PRO_MONTHLY_PRICE_ID', enterprise: 'STRIPE_ENTERPRISE_MONTHLY_PRICE_ID' } as const;
