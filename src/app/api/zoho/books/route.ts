/**
 * Zoho Books API Route
 * Handles sync of invoices, expenses, contacts, and bank accounts
 * between AlphaClone and Zoho Books.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ZohoBooksService } from '../../../../services/zoho/ZohoBooksService';
import { ZohoAuthExpiredError } from '../../../../services/zoho/ZohoService';
import { createSupabaseServerClient } from '@/lib/supabase-server';

async function getUser(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

function handleError(err: unknown): NextResponse {
    if (err instanceof ZohoAuthExpiredError) {
        console.error('[Zoho Books API] auth expired:', err);
        return NextResponse.json(
            { error: 'Zoho Books session expired. Reconnect Zoho.', code: 'ZOHO_BOOKS_RECONNECT', reconnect: true },
            { status: 401 }
        );
    }
    console.error('[Zoho Books API]', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' }, { status: 500 });
}

// GET /api/zoho/books?action=<action>
export async function GET(req: NextRequest) {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const books = new ZohoBooksService(user.id);

    try {
        switch (action) {
            case 'organizations': {
                const orgs = await books.getOrganizations();
                return NextResponse.json(orgs);
            }
            case 'invoices': {
                const page = parseInt(searchParams.get('page') || '1');
                const data = await books.getInvoices(page);
                return NextResponse.json(data);
            }
            case 'expenses': {
                const page = parseInt(searchParams.get('page') || '1');
                const data = await books.getExpenses(page);
                return NextResponse.json(data);
            }
            case 'contacts': {
                const type = searchParams.get('type') as 'customer' | 'vendor' | undefined;
                const data = await books.getContacts(type);
                return NextResponse.json(data);
            }
            case 'bank_accounts': {
                const data = await books.getBankAccounts();
                return NextResponse.json(data);
            }
            case 'bank_transactions': {
                const accountId = searchParams.get('accountId');
                if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });
                const fromDate = searchParams.get('from') ?? undefined;
                const toDate   = searchParams.get('to')   ?? undefined;
                const data = await books.getBankTransactions(accountId, fromDate, toDate);
                return NextResponse.json(data);
            }
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (err) {
        return handleError(err);
    }
}

// POST /api/zoho/books — sync operations
export async function POST(req: NextRequest) {
    const user = await getUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, tenantId, ...payload } = await req.json();
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const books = new ZohoBooksService(user.id);

    try {
        switch (action) {
            case 'sync_full': {
                const result = await books.fullSync(tenantId);
                return NextResponse.json({ success: true, result });
            }
            case 'sync_invoices_to_zoho': {
                const result = await books.syncInvoicesToZoho(tenantId);
                return NextResponse.json({ success: true, ...result });
            }
            case 'sync_invoices_from_zoho': {
                const result = await books.syncInvoicesFromZoho(tenantId);
                return NextResponse.json({ success: true, ...result });
            }
            case 'sync_expenses_to_zoho': {
                const result = await books.syncExpensesToZoho(tenantId);
                return NextResponse.json({ success: true, ...result });
            }
            case 'sync_expenses_from_zoho': {
                const result = await books.syncExpensesFromZoho(tenantId, payload.categoryId);
                return NextResponse.json({ success: true, ...result });
            }
            case 'sync_contacts': {
                const result = await books.syncCompaniesToZoho(tenantId);
                return NextResponse.json({ success: true, ...result });
            }
            case 'sync_bank_accounts': {
                const result = await books.syncBankAccountsFromZoho(tenantId);
                return NextResponse.json({ success: true, ...result });
            }
            case 'sync_bank_transactions': {
                const { bankAccountId, zohoAccountId } = payload;
                if (!bankAccountId || !zohoAccountId) {
                    return NextResponse.json({ error: 'bankAccountId and zohoAccountId required' }, { status: 400 });
                }
                const result = await books.syncBankTransactionsFromZoho(tenantId, bankAccountId, zohoAccountId);
                return NextResponse.json({ success: true, ...result });
            }
            case 'save_org_id': {
                const { orgId } = payload;
                if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });
                await books.saveConfig({ booksOrgId: orgId });
                return NextResponse.json({ success: true });
            }
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (err) {
        return handleError(err);
    }
}
