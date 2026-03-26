import { NextRequest, NextResponse } from 'next/server';
import { expenseService } from '../../../../services/finance/ExpenseService';
import { createSupabaseServerClient } from '@/lib/supabase-server';

async function getUser(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function GET(req: NextRequest) {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const action = searchParams.get('action');

    try {
        if (action === 'categories') {
            const categories = await expenseService.getCategories(tenantId);
            return NextResponse.json(categories);
        }

        if (action === 'summary') {
            const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
            const summary = await expenseService.getExpenseSummary(tenantId, year);
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
        return NextResponse.json(expenses);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, tenantId, ...payload } = body;

    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    try {
        switch (action) {
            case 'create': {
                const expense = await expenseService.createExpense(tenantId, user.id, payload);
                return NextResponse.json(expense, { status: 201 });
            }
            case 'approve': {
                const { expenseId } = payload;
                if (!expenseId) return NextResponse.json({ error: 'expenseId required' }, { status: 400 });
                const expense = await expenseService.approveExpense(tenantId, expenseId, user.id);
                return NextResponse.json(expense);
            }
            case 'reject': {
                const { expenseId, reason } = payload;
                if (!expenseId) return NextResponse.json({ error: 'expenseId required' }, { status: 400 });
                const expense = await expenseService.rejectExpense(tenantId, expenseId, reason);
                return NextResponse.json(expense);
            }
            case 'seed_categories': {
                await expenseService.seedDefaultCategories(tenantId);
                return NextResponse.json({ success: true });
            }
            case 'create_category': {
                const category = await expenseService.createCategory(tenantId, payload);
                return NextResponse.json(category, { status: 201 });
            }
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { tenantId, expenseId, ...updates } = await req.json();
    if (!tenantId || !expenseId) return NextResponse.json({ error: 'tenantId and expenseId required' }, { status: 400 });

    try {
        const expense = await expenseService.updateExpense(tenantId, expenseId, updates);
        return NextResponse.json(expense);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId  = searchParams.get('tenantId');
    const expenseId = searchParams.get('expenseId');

    if (!tenantId || !expenseId) return NextResponse.json({ error: 'tenantId and expenseId required' }, { status: 400 });

    try {
        await expenseService.deleteExpense(tenantId, expenseId);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
