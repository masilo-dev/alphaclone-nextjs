export type PricingUnit = 'hour' | 'project' | 'month' | 'day';

export interface PricingCatalogItem {
    id: string;
    tenant_id: string;
    name: string;
    description: string | null;
    service_code: string | null;
    unit: PricingUnit;
    default_price: number;
    currency: string;
    tax_rate: number;
    is_active: boolean;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface PricingBundleItemInput {
    catalogItemId: string;
    quantity: number;
    unitPriceOverride?: number | null;
    itemOrder?: number;
    metadata?: Record<string, unknown>;
}

export interface PricingBundle {
    id: string;
    tenant_id: string;
    name: string;
    description: string | null;
    currency: string;
    is_active: boolean;
    metadata: Record<string, unknown>;
    items: Array<{
        id: string;
        catalog_item_id: string;
        quantity: number;
        unit_price_override: number | null;
        item_order: number;
        metadata: Record<string, unknown>;
    }>;
}

async function parseJson<T>(response: Response): Promise<T> {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = (payload as { error?: string })?.error || 'Request failed';
        throw new Error(message);
    }
    return payload as T;
}

export const pricingCatalogService = {
    async getCatalog(tenantId: string, includeInactive = false): Promise<PricingCatalogItem[]> {
        const response = await fetch(
            `/api/pricing/catalog?tenantId=${encodeURIComponent(tenantId)}&includeInactive=${String(includeInactive)}`
        );
        const payload = await parseJson<{ success: boolean; items: PricingCatalogItem[] }>(response);
        return payload.items || [];
    },

    async createCatalogItem(input: {
        tenantId: string;
        name: string;
        description?: string;
        serviceCode?: string;
        unit: PricingUnit;
        defaultPrice: number;
        currency?: string;
        taxRate?: number;
        metadata?: Record<string, unknown>;
    }): Promise<PricingCatalogItem> {
        const response = await fetch('/api/pricing/catalog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const payload = await parseJson<{ success: boolean; item: PricingCatalogItem }>(response);
        return payload.item;
    },

    async updateCatalogItem(input: {
        tenantId: string;
        id: string;
        name?: string;
        description?: string;
        serviceCode?: string | null;
        unit?: PricingUnit;
        defaultPrice?: number;
        currency?: string;
        taxRate?: number;
        isActive?: boolean;
        metadata?: Record<string, unknown>;
    }): Promise<PricingCatalogItem> {
        const response = await fetch('/api/pricing/catalog', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const payload = await parseJson<{ success: boolean; item: PricingCatalogItem }>(response);
        return payload.item;
    },

    async archiveCatalogItem(tenantId: string, id: string): Promise<void> {
        const response = await fetch('/api/pricing/catalog', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, id }),
        });
        await parseJson<{ success: boolean }>(response);
    },

    async getBundles(tenantId: string, includeInactive = false): Promise<PricingBundle[]> {
        const response = await fetch(
            `/api/pricing/bundles?tenantId=${encodeURIComponent(tenantId)}&includeInactive=${String(includeInactive)}`
        );
        const payload = await parseJson<{ success: boolean; bundles: PricingBundle[] }>(response);
        return payload.bundles || [];
    },

    async createBundle(input: {
        tenantId: string;
        name: string;
        description?: string;
        currency?: string;
        isActive?: boolean;
        metadata?: Record<string, unknown>;
        items?: PricingBundleItemInput[];
    }): Promise<string> {
        const response = await fetch('/api/pricing/bundles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        const payload = await parseJson<{ success: boolean; bundleId: string }>(response);
        return payload.bundleId;
    },

    async updateBundle(input: {
        tenantId: string;
        id: string;
        name?: string;
        description?: string;
        currency?: string;
        isActive?: boolean;
        metadata?: Record<string, unknown>;
        items?: PricingBundleItemInput[];
    }): Promise<void> {
        const response = await fetch('/api/pricing/bundles', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
        await parseJson<{ success: boolean }>(response);
    },

    async archiveBundle(tenantId: string, id: string): Promise<void> {
        const response = await fetch('/api/pricing/bundles', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId, id }),
        });
        await parseJson<{ success: boolean }>(response);
    },
};
