import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
<<<<<<< HEAD
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
=======
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
>>>>>>> origin/main

const catalogItemSchema = z.object({
    tenantId: z.string().uuid(),
    name: z.string().min(2).max(200),
    description: z.string().max(2000).optional(),
    serviceCode: z.string().max(100).optional(),
    unit: z.enum(['hour', 'project', 'month', 'day']).default('project'),
    defaultPrice: z.number().nonnegative(),
    currency: z.string().min(3).max(8).default('USD'),
    taxRate: z.number().min(0).max(100).default(0),
    isActive: z.boolean().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
});

const updateCatalogItemSchema = z.object({
    tenantId: z.string().uuid(),
    id: z.string().uuid(),
    name: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional(),
    serviceCode: z.string().max(100).nullable().optional(),
    unit: z.enum(['hour', 'project', 'month', 'day']).optional(),
    defaultPrice: z.number().nonnegative().optional(),
    currency: z.string().min(3).max(8).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
});

const deleteCatalogItemSchema = z.object({
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

<<<<<<< HEAD
        const { admin } = await requireTenantAccess(tenantId, req);
=======
        await requireTenantAccess(tenantId);
        const admin = createAdminSupabaseClientOrThrow();
>>>>>>> origin/main

        let query = admin
            .from('tenant_service_catalog_items')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('updated_at', { ascending: false });

        if (!includeInactive) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ success: true, items: data || [] });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to fetch pricing catalog', req);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = catalogItemSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        }

        const payload = parsed.data;
<<<<<<< HEAD
        const { user, admin } = await requireTenantAccess(payload.tenantId, req);
=======
        const { user } = await requireTenantAccess(payload.tenantId);
        const admin = createAdminSupabaseClientOrThrow();
>>>>>>> origin/main

        const { data, error } = await admin
            .from('tenant_service_catalog_items')
            .insert({
                tenant_id: payload.tenantId,
                name: payload.name,
                description: payload.description ?? null,
                service_code: payload.serviceCode ?? null,
                unit: payload.unit,
                default_price: payload.defaultPrice,
                currency: payload.currency.toUpperCase(),
                tax_rate: payload.taxRate,
                is_active: payload.isActive ?? true,
                metadata: payload.metadata ?? {},
                created_by: user.id,
            })
            .select('*')
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, item: data });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to create pricing item', req);
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = updateCatalogItemSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        }

        const payload = parsed.data;
<<<<<<< HEAD
        const { admin } = await requireTenantAccess(payload.tenantId, req);
=======
        await requireTenantAccess(payload.tenantId);
        const admin = createAdminSupabaseClientOrThrow();
>>>>>>> origin/main

        const updateData: Record<string, unknown> = {};
        if (payload.name !== undefined) updateData.name = payload.name;
        if (payload.description !== undefined) updateData.description = payload.description;
        if (payload.serviceCode !== undefined) updateData.service_code = payload.serviceCode;
        if (payload.unit !== undefined) updateData.unit = payload.unit;
        if (payload.defaultPrice !== undefined) updateData.default_price = payload.defaultPrice;
        if (payload.currency !== undefined) updateData.currency = payload.currency.toUpperCase();
        if (payload.taxRate !== undefined) updateData.tax_rate = payload.taxRate;
        if (payload.isActive !== undefined) updateData.is_active = payload.isActive;
        if (payload.metadata !== undefined) updateData.metadata = payload.metadata;

        const { data, error } = await admin
            .from('tenant_service_catalog_items')
            .update(updateData)
            .eq('id', payload.id)
            .eq('tenant_id', payload.tenantId)
            .select('*')
            .single();

        if (error) throw error;
        return NextResponse.json({ success: true, item: data });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to update pricing item', req);
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json();
        const parsed = deleteCatalogItemSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        }

        const payload = parsed.data;
<<<<<<< HEAD
        const { admin } = await requireTenantAccess(payload.tenantId, req);
=======
        await requireTenantAccess(payload.tenantId);
        const admin = createAdminSupabaseClientOrThrow();
>>>>>>> origin/main

        const { error } = await admin
            .from('tenant_service_catalog_items')
            .update({ is_active: false })
            .eq('id', payload.id)
            .eq('tenant_id', payload.tenantId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to archive pricing item', req);
    }
}
