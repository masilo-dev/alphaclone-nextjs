import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { expenseService } from '../../../../services/finance/ExpenseService';
import { requireTenantAccess, requireTenantRole } from '@/lib/apiAuth';
import { findIdempotentPayload, recordIdempotentPayload } from '@/lib/api/offlineIdempotency';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { enforceQuota } from '@/lib/quotaMiddleware';
import { quotaEnforcementService } from '@/services/quotaEnforcementService';
import { z } from 'zod';

const tenantIdSchema = z.string().uuid();
const expenseInputSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amount: z.coerce.number().positive().max(100_000_000),
    tax_amount: z.coerce.number().min(0).max(100_000_000).optional(),
    currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
    description: z.string().trim().max(1000).optional(),
    vendor_name: z.string().trim().max(300).optional(),
    payment_method: z.enum(['card', 'cash', 'bank_transfer', 'check', 'other']).optional(),
    billable: z.boolean().optional(),
    client_id: z.string().uuid().nullable().optional().transform(val => val ?? undefined),
    category_id: z.string().uuid().nullable().optional().transform(val => val ?? undefined),
    asset_account_id: z.string().uuid().nullable().optional().transform(val => val ?? undefined),
    receipt_url: z.string().max(2000).nullable().optional().transform(val => val ?? undefined),
    notes: z.string().max(5000).nullable().optional().transform(val => val ?? undefined),
});

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    let user;
    try {
        ({ user } = await requireTenantAccess(tenantId, req));
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quotaResponse = await enforceQuota(req, tenantId, {
        metric: 'api_calls',
        action: 'get_expenses'
    });
    if (quotaResponse) return quotaResponse;

    const action = searchParams.get('action');

    try {
        if (action === 'categories') {
            const categories = await expenseService.getCategories(tenantId);
            await quotaEnforcementService.trackAPICall(tenantId, '/api/finance/expenses?action=categories', user.id).catch(console.error);
            return NextResponse.json(categories);
        }

        if (action === 'summary') {
            const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
            const summary = await expenseService.getExpenseSummary(tenantId, year);
            await quotaEnforcementService.trackAPICall(tenantId, '/api/finance/expenses?action=summary', user.id).catch(console.error);
            return NextResponse.json(summary);
        }

        const filters = {
            status:      searchParams.get('status')      || undefined,
            category_id: searchParams.get('category_id') || undefined,
            from_date:   searchParams.get('from_date')   || undefined,
            to_date:     searchParams.get('to_date')     || undefined,
            billable:    searchParams.get('billable') === 'true' ? true
                       : searchParams.get('billable') === 'false' ? false
                       : undefined,
        };

        const expenses = await expenseService.getExpenses(tenantId, filters);
        await quotaEnforcementService.trackAPICall(tenantId, '/api/finance/expenses', user.id).catch(console.error);
        return NextResponse.json(expenses);
    } catch (err: any) {
        return clientErrorResponse(err, { request: req, scope: 'finance/expenses' });
    }
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}));
    const { action, tenantId, ...payload } = body;

    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    let user;
    try {
        ({ user } = await requireTenantAccess(tenantId, req));
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quotaResponse = await enforceQuota(req, tenantId, {
        metric: 'api_calls',
        action: `mutate_expenses_${action}`
    });
    if (quotaResponse) return quotaResponse;

    try {
        switch (action) {
            case 'create': {
                const parsed = expenseInputSchema.safeParse(payload);
                if (!parsed.success) return NextResponse.json({ error: 'Invalid expense details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
                const idempotencyKey = typeof payload.idempotencyKey === 'string' ? payload.idempotencyKey : undefined;
                if (idempotencyKey && z.string().uuid().safeParse(idempotencyKey).success) {
                    const admin = createSupabaseAdminClient();
                    const existing = await findIdempotentPayload(admin, tenantId, idempotencyKey, 'offline_expense_create');
                    if (existing?.expenseId) {
                        const expense = await expenseService.getExpense(tenantId, String(existing.expenseId));
                        if (expense) return NextResponse.json(expense);
                    }
                }
                const expense = await expenseService.createExpense(tenantId, user.id, parsed.data);
                if (idempotencyKey && z.string().uuid().safeParse(idempotencyKey).success) {
                    const admin = createSupabaseAdminClient();
                    await recordIdempotentPayload(admin, tenantId, idempotencyKey, 'offline_expense_create', { expenseId: expense.id }, user.id);
                }
                await quotaEnforcementService.trackAPICall(tenantId, '/api/finance/expenses?action=create', user.id).catch(console.error);
                return NextResponse.json(expense, { status: 201 });
            }
            case 'approve': {
                await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
                const { expenseId } = payload;
                if (!expenseId) return NextResponse.json({ error: 'expenseId required' }, { status: 400 });
                const expense = await expenseService.approveExpense(tenantId, expenseId, user.id);
                await quotaEnforcementService.trackAPICall(tenantId, '/api/finance/expenses?action=approve', user.id).catch(console.error);
                return NextResponse.json(expense);
            }
            case 'reject': {
                await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
                const { expenseId, reason } = payload;
                if (!expenseId) return NextResponse.json({ error: 'expenseId required' }, { status: 400 });
                const expense = await expenseService.rejectExpense(tenantId, expenseId, reason);
                await quotaEnforcementService.trackAPICall(tenantId, '/api/finance/expenses?action=reject', user.id).catch(console.error);
                return NextResponse.json(expense);
            }
            case 'seed_categories': {
                await expenseService.seedDefaultCategories(tenantId);
                await quotaEnforcementService.trackAPICall(tenantId, '/api/finance/expenses?action=seed_categories', user.id).catch(console.error);
                return NextResponse.json({ success: true });
            }
            case 'create_category': {
                const category = await expenseService.createCategory(tenantId, payload);
                await quotaEnforcementService.trackAPICall(tenantId, '/api/finance/expenses?action=create_category', user.id).catch(console.error);
                return NextResponse.json(category, { status: 201 });
            }
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (err: any) {
        return clientErrorResponse(err, { request: req, scope: 'finance/expenses' });
    }
}

export async function PATCH(req: NextRequest) {
    const { tenantId, expenseId, ...updates } = await req.json().catch(() => ({}));
    if (!tenantId || !expenseId) return NextResponse.json({ error: 'tenantId and expenseId required' }, { status: 400 });

    let user;
    try {
        ({ user } = await requireTenantAccess(tenantId, req));
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quotaResponse = await enforceQuota(req, tenantId, {
        metric: 'api_calls',
        action: 'update_expense'
    });
    if (quotaResponse) return quotaResponse;

    try {
        const parsed = expenseInputSchema.partial().safeParse(updates);
        if (!parsed.success || !tenantIdSchema.safeParse(tenantId).success || !z.string().uuid().safeParse(expenseId).success) {
            return NextResponse.json({ error: 'Invalid expense update' }, { status: 400 });
        }
        const expense = await expenseService.updateExpense(tenantId, expenseId, parsed.data);
        await quotaEnforcementService.trackAPICall(tenantId, '/api/finance/expenses?action=update', user.id).catch(console.error);
        return NextResponse.json(expense);
    } catch (err: any) {
        return clientErrorResponse(err, { request: req, scope: 'finance/expenses' });
    }
}

export async function DELETE(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const tenantId  = searchParams.get('tenantId');
    const expenseId = searchParams.get('expenseId');

    if (!tenantId || !expenseId) return NextResponse.json({ error: 'tenantId and expenseId required' }, { status: 400 });

    let user;
    try {
        ({ user } = await requireTenantAccess(tenantId, req));
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quotaResponse = await enforceQuota(req, tenantId, {
        metric: 'api_calls',
        action: 'delete_expense'
    });
    if (quotaResponse) return quotaResponse;

    try {
        await expenseService.deleteExpense(tenantId, expenseId);
        await quotaEnforcementService.trackAPICall(tenantId, '/api/finance/expenses?action=delete', user.id).catch(console.error);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return clientErrorResponse(err, { request: req, scope: 'finance/expenses' });
    }
}
