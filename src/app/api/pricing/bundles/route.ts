import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const bundleItemSchema = z.object({
    catalogItemId: z.string().uuid(),
    quantity: z.number().positive().default(1),
    unitPriceOverride: z.number().nonnegative().nullable().optional(),
    itemOrder: z.number().int().nonnegative().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
});

const createBundleSchema = z.object({
    tenantId: z.string().uuid(),
    name: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    currency: z.string().min(3).max(8).default('USD'),
    isActive: z.boolean().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    items: z.array(bundleItemSchema).default([]),
});

const updateBundleSchema = z.object({
    tenantId: z.string().uuid(),
    id: z.string().uuid(),
    name: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional(),
    currency: z.string().min(3).max(8).optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
    items: z.array(bundleItemSchema).optional(),
});

const archiveBundleSchema = z.object({
    tenantId: z.string().uuid(),
    id: z.string().uuid(),
});

export async function GET(req: NextRequest) {
    try {
        const tenantId = req.nextUrl.searchParams.get('tenantId');
        const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';
        if (!tenantId) {
            return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
        }

        const { admin } = await requireTenantAccess(tenantId, req);

        let query = admin
            .from('tenant_service_bundles')
            .select(`
                *,
                items:tenant_service_bundle_items(
                    id,
                    catalog_item_id,
                    quantity,
                    unit_price_override,
                    item_order,
                    metadata
                )
            `)
            .eq('tenant_id', tenantId)
            .order('updated_at', { ascending: false });

        if (!includeInactive) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ success: true, bundles: data || [] });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to fetch service bundles', req);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = createBundleSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        }

        const payload = parsed.data;
        const { user, admin } = await requireTenantAccess(payload.tenantId, req);

        const { data: bundle, error: bundleError } = await admin
            .from('tenant_service_bundles')
            .insert({
                tenant_id: payload.tenantId,
                name: payload.name,
                description: payload.description ?? null,
                currency: payload.currency.toUpperCase(),
                is_active: payload.isActive ?? true,
                metadata: payload.metadata ?? {},
                created_by: user.id,
            })
            .select('*')
            .single();

        if (bundleError) throw bundleError;

        if (payload.items.length > 0) {
            const rows = payload.items.map((item, index) => ({
                tenant_id: payload.tenantId,
                bundle_id: bundle.id,
                catalog_item_id: item.catalogItemId,
                quantity: item.quantity,
                unit_price_override: item.unitPriceOverride ?? null,
                item_order: item.itemOrder ?? index,
                metadata: item.metadata ?? {},
            }));
            const { error: itemsError } = await admin.from('tenant_service_bundle_items').insert(rows);
            if (itemsError) throw itemsError;
        }

        return NextResponse.json({ success: true, bundleId: bundle.id });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to create service bundle', req);
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = updateBundleSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        }

        const payload = parsed.data;
        const { admin } = await requireTenantAccess(payload.tenantId, req);

        const updateData: Record<string, unknown> = {};
        if (payload.name !== undefined) updateData.name = payload.name;
        if (payload.description !== undefined) updateData.description = payload.description;
        if (payload.currency !== undefined) updateData.currency = payload.currency.toUpperCase();
        if (payload.isActive !== undefined) updateData.is_active = payload.isActive;
        if (payload.metadata !== undefined) updateData.metadata = payload.metadata;

        if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await admin
                .from('tenant_service_bundles')
                .update(updateData)
                .eq('id', payload.id)
                .eq('tenant_id', payload.tenantId);
            if (updateError) throw updateError;
        }

        if (payload.items) {
            const { error: deleteError } = await admin
                .from('tenant_service_bundle_items')
                .delete()
                .eq('bundle_id', payload.id)
                .eq('tenant_id', payload.tenantId);
            if (deleteError) throw deleteError;

            if (payload.items.length > 0) {
                const rows = payload.items.map((item, index) => ({
                    tenant_id: payload.tenantId,
                    bundle_id: payload.id,
                    catalog_item_id: item.catalogItemId,
                    quantity: item.quantity,
                    unit_price_override: item.unitPriceOverride ?? null,
                    item_order: item.itemOrder ?? index,
                    metadata: item.metadata ?? {},
                }));
                const { error: insertError } = await admin.from('tenant_service_bundle_items').insert(rows);
                if (insertError) throw insertError;
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to update service bundle', req);
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = archiveBundleSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        }

        const payload = parsed.data;
        const { admin } = await requireTenantAccess(payload.tenantId, req);

        const { error } = await admin
            .from('tenant_service_bundles')
            .update({ is_active: false })
            .eq('id', payload.id)
            .eq('tenant_id', payload.tenantId);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to archive service bundle', req);
    }
}
