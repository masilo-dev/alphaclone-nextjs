import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

/**
 * Enterprise Billing Service
 * Handles advanced billing features for enterprise customers
 */

export interface PurchaseOrder {
    id: string;
    tenantId: string;
    poNumber: string;
    amount: number;
    currency: string;
    status: 'pending' | 'approved' | 'rejected' | 'paid';
    approvedBy?: string;
    approvedAt?: string;
    items: POLineItem[];
    notes?: string;
    attachments?: string[];
}

export interface POLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export interface CustomContract {
    id: string;
    tenantId: string;
    contractType: 'annual' | 'multi-year' | 'custom';
    duration: number; // months
    monthlyPrice: number;
    totalValue: number;
    discountPercent: number;
    paymentTerms: 'net-0' | 'net-30' | 'net-60' | 'net-90';
    billingCycle: 'monthly' | 'quarterly' | 'annual' | 'upfront';
    startDate: string;
    endDate: string;
    autoRenew: boolean;
}

export interface VolumeDiscount {
    minUsers: number;
    maxUsers?: number;
    discountPercent: number;
}

export const enterpriseBillingService = {
    /**
     * Create purchase order
     */
    async createPurchaseOrder(
        tenantId: string,
        poData: Omit<PurchaseOrder, 'id' | 'status'>
    ): Promise<{ success: boolean; poId?: string; error?: string }> {
        try {
            // Calculate total
            const total = poData.items.reduce((sum, item) => sum + item.totalPrice, 0);

            const { data, error } = await supabase
                .from('purchase_orders')
                .insert({
                    tenant_id: tenantId,
                    po_number: poData.poNumber,
                    amount: total,
                    currency: poData.currency,
                    status: 'pending',
                    items: poData.items,
                    notes: poData.notes,
                })
                .select('id')
                .single();

            if (error) throw error;

            return { success: true, poId: data.id };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create PO',
            };
        }
    },

    /**
     * Create custom enterprise contract
     */
    async createCustomContract(
        tenantId: string,
        contract: Omit<CustomContract, 'id'>
    ): Promise<{ success: boolean; contractId?: string; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('enterprise_contracts')
                .insert({
                    tenant_id: tenantId,
                    contract_type: contract.contractType,
                    duration_months: contract.duration,
                    monthly_price_cents: contract.monthlyPrice,
                    total_value_cents: contract.totalValue,
                    discount_percent: contract.discountPercent,
                    payment_terms: contract.paymentTerms,
                    billing_cycle: contract.billingCycle,
                    start_date: contract.startDate,
                    end_date: contract.endDate,
                    auto_renew: contract.autoRenew,
                })
                .select('id')
                .single();

            if (error) throw error;

            return { success: true, contractId: data.id };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create contract',
            };
        }
    },

    /**
     * Calculate volume discount
     */
    calculateVolumeDiscount(userCount: number): number {
        const tiers: VolumeDiscount[] = [
            { minUsers: 1, maxUsers: 10, discountPercent: 0 },
            { minUsers: 11, maxUsers: 25, discountPercent: 10 },
            { minUsers: 26, maxUsers: 50, discountPercent: 15 },
            { minUsers: 51, maxUsers: 100, discountPercent: 20 },
            { minUsers: 101, discountPercent: 25 },
        ];

        const tier = tiers.find(
            t => userCount >= t.minUsers && (!t.maxUsers || userCount <= t.maxUsers)
        );

        return tier?.discountPercent || 0;
    },

    /**
     * Calculate multi-year discount
     */
    calculateMultiYearDiscount(years: number): number {
        switch (years) {
            case 1:
                return 0;
            case 2:
                return 15; // 15% off
            case 3:
                return 25; // 25% off
            case 5:
                return 35; // 35% off
            default:
                return Math.min(35, years * 5); // Max 35%
        }
    },

    /**
     * Generate enterprise quote
     */
    async generateEnterpriseQuote(params: {
        basePricePerUser: number;
        userCount: number;
        years: number;
        features: string[];
        supportLevel: 'standard' | 'priority' | '24/7';
    }): Promise<{
        monthlyTotal: number;
        annualTotal: number;
        contractTotal: number;
        volumeDiscount: number;
        multiYearDiscount: number;
        finalDiscount: number;
        savings: number;
    }> {
        const { basePricePerUser, userCount, years, supportLevel } = params;

        // Base calculation
        const baseMonthly = basePricePerUser * userCount;
        const baseAnnual = baseMonthly * 12;
        const baseTotal = baseAnnual * years;

        // Calculate discounts
        const volumeDiscount = this.calculateVolumeDiscount(userCount);
        const multiYearDiscount = this.calculateMultiYearDiscount(years);

        // Combine discounts (not additive - apply sequentially)
        let finalPrice = baseTotal;

        // Apply volume discount
        if (volumeDiscount > 0) {
            finalPrice = finalPrice * (1 - volumeDiscount / 100);
        }

        // Apply multi-year discount
        if (multiYearDiscount > 0) {
            finalPrice = finalPrice * (1 - multiYearDiscount / 100);
        }

        // Support tier pricing
        const supportPricing = {
            standard: 0,
            priority: baseMonthly * 0.1 * 12 * years, // +10% per year
            '24/7': baseMonthly * 0.2 * 12 * years, // +20% per year
        };

        finalPrice += supportPricing[supportLevel];

        const savings = baseTotal - finalPrice;
        const finalDiscountPercent = ((savings / baseTotal) * 100).toFixed(1);

        return {
            monthlyTotal: Math.round(finalPrice / years / 12),
            annualTotal: Math.round(finalPrice / years),
            contractTotal: Math.round(finalPrice),
            volumeDiscount,
            multiYearDiscount,
            finalDiscount: parseFloat(finalDiscountPercent),
            savings: Math.round(savings),
        };
    },

    /**
     * Generate PDF invoice (would use a PDF library in production)
     */
    async generatePDFInvoice(invoiceId: string): Promise<Buffer | null> {
        try {
            // Get invoice data
            const { data: invoice } = await supabase
                .from('invoices')
                .select('*, tenants(*), profiles(*)')
                .eq('id', invoiceId)
                .single();

            if (!invoice) throw new Error('Invoice not found');

            // In production, use a PDF library like pdfkit or puppeteer
            // For now, return a placeholder
            console.log('Generate PDF for invoice:', invoice.invoice_number);

            // Would generate actual PDF here
            return null;
        } catch (error) {
            console.error('Error generating PDF:', error);
            return null;
        }
    },

    /**
     * Create payment plan for large invoices
     */
    async createPaymentPlan(
        invoiceId: string,
        installments: number
    ): Promise<{ success: boolean; plan?: any; error?: string }> {
        try {
            const { data: invoice } = await supabase
                .from('invoices')
                .select('amount, due_date')
                .eq('id', invoiceId)
                .single();

            if (!invoice) throw new Error('Invoice not found');

            const installmentAmount = Math.round(invoice.amount / installments);
            const plan = [];

            for (let i = 0; i < installments; i++) {
                const dueDate = new Date(invoice.due_date);
                dueDate.setMonth(dueDate.getMonth() + i);

                plan.push({
                    installment: i + 1,
                    amount: installmentAmount,
                    dueDate: format(dueDate, 'yyyy-MM-dd'),
                    status: 'pending',
                });
            }

            // Store payment plan
            const { error } = await supabase
                .from('payment_plans')
                .insert({
                    invoice_id: invoiceId,
                    installments: plan,
                    total_installments: installments,
                });

            if (error) throw error;

            return { success: true, plan };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create payment plan',
            };
        }
    },

    /**
     * Get enterprise pricing tiers
     */
    getEnterpriseT iers() {
        return {
            enterprise_basic: {
                name: 'Enterprise Basic',
                basePrice: 299,
                minUsers: 50,
                features: [
                    'SSO/SAML',
                    'Priority support',
                    'Custom onboarding',
                    'Dedicated account manager',
                    'SLA guarantee',
                ],
            },
            enterprise_plus: {
                name: 'Enterprise Plus',
                basePrice: 599,
                minUsers: 100,
                features: [
                    'Everything in Basic',
                    'White-label branding',
                    'Custom integrations',
                    'Advanced analytics',
                    '24/7 phone support',
                    'Custom contract terms',
                ],
            },
            enterprise_premium: {
                name: 'Enterprise Premium',
                basePrice: 999,
                minUsers: 250,
                features: [
                    'Everything in Plus',
                    'On-premise deployment option',
                    'Custom development',
                    'Dedicated infrastructure',
                    'Executive business reviews',
                    'Custom SLA',
                ],
            },
        };
    },
};
