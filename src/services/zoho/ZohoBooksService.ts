/**
 * Zoho Books Integration Service
 * Syncs invoices, expenses, contacts, and bank transactions
 * between AlphaClone and Zoho Books.
 *
 * Zoho Books API docs: https://www.zoho.com/books/api/v3/
 */
import { ZohoService, ZohoAuthExpiredError } from './ZohoService';
import { supabase as defaultSupabase } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

export interface ZohoBooksInvoice {
    invoice_id: string;
    invoice_number: string;
    customer_id: string;
    customer_name: string;
    status: string; // draft | sent | overdue | paid | void
    date: string;
    due_date: string;
    total: number;
    balance: number;
    currency_code: string;
    line_items?: ZohoBooksLineItem[];
}

export interface ZohoBooksExpense {
    expense_id: string;
    account_id: string;
    account_name: string;
    paid_through_account_id?: string;
    vendor_id?: string;
    vendor_name?: string;
    date: string;
    total: number;
    description?: string;
    status: string; // unbilled | invoiced | reimbursed
    currency_code: string;
}

export interface ZohoBooksContact {
    contact_id: string;
    contact_name: string;
    contact_type: string; // customer | vendor
    email?: string;
    phone?: string;
    company_name?: string;
    currency_code: string;
    outstanding_receivable_amount?: number;
    outstanding_payable_amount?: number;
}

export interface ZohoBooksBankAccount {
    account_id: string;
    account_name: string;
    account_type: string;
    currency_code: string;
    current_balance: number;
    bank_name?: string;
    account_number?: string;
}

export interface ZohoBooksTransaction {
    transaction_id: string;
    date: string;
    amount: number;
    transaction_type: string; // debit | credit
    reference_number?: string;
    description?: string;
    matched: boolean;
}

export interface ZohoBooksLineItem {
    item_id?: string;
    name: string;
    description?: string;
    quantity: number;
    rate: number;
    amount: number;
    tax_id?: string;
}

export class ZohoBooksService extends ZohoService {

    private getBooksHost(): string {
        // Zoho Books uses a different subdomain pattern per region
        // stored in config.crmApiHost -> we derive books host from the region
        return 'books.zoho.com'; // Default; will be overridden by config if set
    }

    private async getBooksBase(): Promise<string> {
        const config = await this.getConfig();
        // Derive books host from accountsServer region
        const accounts = config?.accountsServer || 'https://accounts.zoho.com';
        let booksHost = 'books.zoho.com';
        if (accounts.includes('.zoho.eu'))     booksHost = 'books.zoho.eu';
        if (accounts.includes('.zoho.in'))     booksHost = 'books.zoho.in';
        if (accounts.includes('.zoho.com.au')) booksHost = 'books.zoho.com.au';
        if (accounts.includes('.zoho.jp'))     booksHost = 'books.zoho.jp';
        if (accounts.includes('.zoho.ca'))     booksHost = 'books.zoho.ca';

        if (!config?.booksOrgId) {
            throw new Error('Zoho Books not configured: missing booksOrgId. Please reconnect with Books scope.');
        }

        return `https://${booksHost}/api/v3`;
    }

    private async booksRequest(path: string, options: RequestInit = {}): Promise<any> {
        const config = await this.getConfig();
        const base = await this.getBooksBase();
        const orgId = config?.booksOrgId;

        const separator = path.includes('?') ? '&' : '?';
        const url = `${base}${path}${separator}organization_id=${orgId}`;

        return this.callZohoAPI(url, options);
    }

    // ──────────────────────────────────────────────────────────
    // ORGANIZATION
    // ──────────────────────────────────────────────────────────

    async getOrganizations(): Promise<any[]> {
        const base = await this.getBooksBaseNoOrg();
        const data = await this.callZohoAPI(`${base}/organizations`);
        return data?.organizations ?? [];
    }

    private async getBooksBaseNoOrg(): Promise<string> {
        const config = await this.getConfig();
        const accounts = config?.accountsServer || 'https://accounts.zoho.com';
        let booksHost = 'books.zoho.com';
        if (accounts.includes('.zoho.eu'))     booksHost = 'books.zoho.eu';
        if (accounts.includes('.zoho.in'))     booksHost = 'books.zoho.in';
        if (accounts.includes('.zoho.com.au')) booksHost = 'books.zoho.com.au';
        if (accounts.includes('.zoho.jp'))     booksHost = 'books.zoho.jp';
        if (accounts.includes('.zoho.ca'))     booksHost = 'books.zoho.ca';
        return `https://${booksHost}/api/v3`;
    }

    // ──────────────────────────────────────────────────────────
    // INVOICES
    // ──────────────────────────────────────────────────────────

    async getInvoices(page = 1, perPage = 25): Promise<ZohoBooksInvoice[]> {
        const data = await this.booksRequest(`/invoices?page=${page}&per_page=${perPage}&sort_column=date&sort_order=D`);
        return data?.invoices ?? [];
    }

    async getInvoice(invoiceId: string): Promise<ZohoBooksInvoice> {
        const data = await this.booksRequest(`/invoices/${invoiceId}`);
        return data?.invoice;
    }

    async createInvoice(invoice: Partial<ZohoBooksInvoice> & { line_items: ZohoBooksLineItem[] }): Promise<ZohoBooksInvoice> {
        const data = await this.booksRequest('/invoices', {
            method: 'POST',
            body: JSON.stringify({ JSONString: JSON.stringify(invoice) }),
        });
        return data?.invoice;
    }

    async markInvoiceAsSent(invoiceId: string): Promise<void> {
        await this.booksRequest(`/invoices/${invoiceId}/status/sent`, { method: 'POST' });
    }

    /**
     * Sync AlphaClone business_invoices → Zoho Books
     * Creates new Zoho Books invoices for ones not yet synced.
     */
    async syncInvoicesToZoho(tenantId: string): Promise<{ synced: number; errors: number }> {
        const supabase = this.getSupabaseClient();
        const { data: invoices } = await supabase
            .from('business_invoices')
            .select('*')
            .eq('tenant_id', tenantId)
            .is('zoho_books_id', null)
            .in('status', ['sent', 'paid']);

        let synced = 0, errors = 0;

        for (const inv of invoices ?? []) {
            try {
                const zbInvoice = await this.createInvoice({
                    customer_name: inv.client_name || 'Client',
                    date: inv.issue_date,
                    due_date: inv.due_date,
                    currency_code: inv.currency || 'USD',
                    line_items: (inv.line_items || []).map((li: any) => ({
                        name: li.name || li.description,
                        description: li.description,
                        quantity: li.quantity || 1,
                        rate: li.rate || li.unit_price || 0,
                        amount: li.amount || (li.quantity * li.rate),
                    })),
                });

                await supabase
                    .from('business_invoices')
                    .update({ zoho_books_id: zbInvoice.invoice_id })
                    .eq('id', inv.id);

                synced++;
            } catch (err) {
                console.error('Failed to sync invoice to Zoho Books:', (err as Error).message);
                errors++;
            }
        }

        return { synced, errors };
    }

    /**
     * Pull Zoho Books invoices → AlphaClone (update payment status)
     */
    async syncInvoicesFromZoho(tenantId: string): Promise<{ updated: number }> {
        const supabase = this.getSupabaseClient();
        const zbInvoices = await this.getInvoices(1, 100);
        let updated = 0;

        for (const zbInv of zbInvoices) {
            const { data } = await supabase
                .from('business_invoices')
                .select('id, status')
                .eq('tenant_id', tenantId)
                .eq('zoho_books_id', zbInv.invoice_id)
                .maybeSingle();

            if (data && zbInv.status === 'paid' && data.status !== 'paid') {
                await supabase
                    .from('business_invoices')
                    .update({ status: 'paid', updated_at: new Date().toISOString() })
                    .eq('id', data.id);
                updated++;
            }
        }

        return { updated };
    }

    // ──────────────────────────────────────────────────────────
    // EXPENSES
    // ──────────────────────────────────────────────────────────

    async getExpenses(page = 1, perPage = 25): Promise<ZohoBooksExpense[]> {
        const data = await this.booksRequest(`/expenses?page=${page}&per_page=${perPage}`);
        return data?.expenses ?? [];
    }

    async createExpense(expense: {
        account_id: string;
        paid_through_account_id?: string;
        date: string;
        total: number;
        description?: string;
        currency_code?: string;
        vendor_id?: string;
        line_items?: any[];
    }): Promise<ZohoBooksExpense> {
        const data = await this.booksRequest('/expenses', {
            method: 'POST',
            body: JSON.stringify({ JSONString: JSON.stringify(expense) }),
        });
        return data?.expense;
    }

    /**
     * Sync AlphaClone expenses → Zoho Books
     */
    async syncExpensesToZoho(tenantId: string): Promise<{ synced: number; errors: number }> {
        const supabase = this.getSupabaseClient();
        const { data: expenses } = await supabase
            .from('expenses')
            .select('*, expense_categories(name, account_code)')
            .eq('tenant_id', tenantId)
            .eq('status', 'approved')
            .is('zoho_books_id', null);

        let synced = 0, errors = 0;

        for (const exp of expenses ?? []) {
            try {
                const zbExp = await this.createExpense({
                    account_id: exp.expense_categories?.account_code || '000',
                    date: exp.date,
                    total: exp.total,
                    description: exp.description || '',
                    currency_code: exp.currency || 'USD',
                });

                await supabase
                    .from('expenses')
                    .update({ zoho_books_id: zbExp.expense_id })
                    .eq('id', exp.id);

                synced++;
            } catch (err) {
                console.error('Failed to sync expense to Zoho Books:', (err as Error).message);
                errors++;
            }
        }

        return { synced, errors };
    }

    /**
     * Pull Zoho Books expenses → AlphaClone
     */
    async syncExpensesFromZoho(tenantId: string, categoryId?: string): Promise<{ imported: number }> {
        const supabase = this.getSupabaseClient();
        const zbExpenses = await this.getExpenses(1, 100);
        let imported = 0;

        for (const zbExp of zbExpenses) {
            const { data: existing } = await supabase
                .from('expenses')
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('zoho_books_id', zbExp.expense_id)
                .maybeSingle();

            if (!existing) {
                await supabase.from('expenses').insert({
                    tenant_id: tenantId,
                    category_id: categoryId || null,
                    date: zbExp.date,
                    amount: zbExp.total,
                    currency: zbExp.currency_code,
                    description: zbExp.description || '',
                    vendor_name: zbExp.vendor_name || null,
                    status: 'approved',
                    zoho_books_id: zbExp.expense_id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });
                imported++;
            }
        }

        return { imported };
    }

    // ──────────────────────────────────────────────────────────
    // CONTACTS (Customers + Vendors)
    // ──────────────────────────────────────────────────────────

    async getContacts(type?: 'customer' | 'vendor', page = 1): Promise<ZohoBooksContact[]> {
        const filter = type ? `&contact_type=${type}` : '';
        const data = await this.booksRequest(`/contacts?page=${page}${filter}`);
        return data?.contacts ?? [];
    }

    async createContact(contact: {
        contact_name: string;
        contact_type: string;
        email?: string;
        phone?: string;
        company_name?: string;
        currency_code?: string;
    }): Promise<ZohoBooksContact> {
        const data = await this.booksRequest('/contacts', {
            method: 'POST',
            body: JSON.stringify({ JSONString: JSON.stringify(contact) }),
        });
        return data?.contact;
    }

    /**
     * Sync AlphaClone companies → Zoho Books contacts
     */
    async syncCompaniesToZoho(tenantId: string): Promise<{ synced: number; errors: number }> {
        const supabase = this.getSupabaseClient();
        const { data: companies } = await supabase
            .from('companies')
            .select('*')
            .eq('tenant_id', tenantId)
            .is('zoho_books_id', null)
            .in('stage', ['customer', 'prospect']);

        let synced = 0, errors = 0;

        for (const company of companies ?? []) {
            try {
                const zbContact = await this.createContact({
                    contact_name: company.name,
                    contact_type: company.stage === 'customer' ? 'customer' : 'customer',
                    email: company.email || undefined,
                    phone: company.phone || undefined,
                    company_name: company.name,
                    currency_code: 'USD',
                });

                await supabase
                    .from('companies')
                    .update({ zoho_books_id: zbContact.contact_id })
                    .eq('id', company.id);

                synced++;
            } catch (err) {
                console.error('Failed to sync company to Zoho Books:', (err as Error).message);
                errors++;
            }
        }

        return { synced, errors };
    }

    // ──────────────────────────────────────────────────────────
    // BANK ACCOUNTS
    // ──────────────────────────────────────────────────────────

    async getBankAccounts(): Promise<ZohoBooksBankAccount[]> {
        const data = await this.booksRequest('/bankaccounts');
        return data?.bankaccounts ?? [];
    }

    async getBankTransactions(accountId: string, fromDate?: string, toDate?: string): Promise<ZohoBooksTransaction[]> {
        let url = `/bankaccounts/${accountId}/transactions`;
        const params: string[] = [];
        if (fromDate) params.push(`date_after=${fromDate}`);
        if (toDate)   params.push(`date_before=${toDate}`);
        if (params.length) url += '?' + params.join('&');

        const data = await this.booksRequest(url);
        return data?.banktransactions ?? [];
    }

    /**
     * Sync Zoho Books bank accounts → AlphaClone bank_accounts table
     */
    async syncBankAccountsFromZoho(tenantId: string): Promise<{ synced: number }> {
        const supabase = this.getSupabaseClient();
        const zbAccounts = await this.getBankAccounts();
        let synced = 0;

        for (const acct of zbAccounts) {
            const { data: existing } = await supabase
                .from('bank_accounts')
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('zoho_books_id', acct.account_id)
                .maybeSingle();

            if (!existing) {
                await supabase.from('bank_accounts').insert({
                    tenant_id: tenantId,
                    name: acct.account_name,
                    bank_name: acct.bank_name || null,
                    account_type: acct.account_type?.toLowerCase()?.replace(' ', '_') || 'checking',
                    currency: acct.currency_code,
                    current_balance: acct.current_balance,
                    zoho_books_id: acct.account_id,
                    last_synced_at: new Date().toISOString(),
                });
            } else {
                await supabase
                    .from('bank_accounts')
                    .update({ current_balance: acct.current_balance, last_synced_at: new Date().toISOString() })
                    .eq('tenant_id', tenantId)
                    .eq('zoho_books_id', acct.account_id);
            }
            synced++;
        }

        return { synced };
    }

    /**
     * Sync bank transactions for a specific bank account from Zoho Books
     */
    async syncBankTransactionsFromZoho(tenantId: string, bankAccountId: string, zohoAccountId: string): Promise<{ imported: number }> {
        const supabase = this.getSupabaseClient();

        // Get last sync date
        const { data: acct } = await supabase
            .from('bank_accounts')
            .select('last_synced_at')
            .eq('id', bankAccountId)
            .maybeSingle();

        const fromDate = acct?.last_synced_at
            ? new Date(acct.last_synced_at).toISOString().split('T')[0]
            : undefined;

        const transactions = await this.getBankTransactions(zohoAccountId, fromDate);
        let imported = 0;

        for (const tx of transactions) {
            const externalId = `zoho-books-${tx.transaction_id}`;
            const { data: existing } = await supabase
                .from('bank_transactions')
                .select('id')
                .eq('external_id', externalId)
                .maybeSingle();

            if (!existing) {
                await supabase.from('bank_transactions').insert({
                    tenant_id: tenantId,
                    bank_account_id: bankAccountId,
                    date: tx.date,
                    description: tx.description || tx.reference_number || '',
                    amount: tx.transaction_type === 'debit' ? -Math.abs(tx.amount) : Math.abs(tx.amount),
                    type: tx.transaction_type,
                    reconciled: tx.matched,
                    external_id: externalId,
                    zoho_books_id: tx.transaction_id,
                });
                imported++;
            }
        }

        // Update last sync timestamp
        await supabase
            .from('bank_accounts')
            .update({ last_synced_at: new Date().toISOString() })
            .eq('id', bankAccountId);

        return { imported };
    }

    // ──────────────────────────────────────────────────────────
    // FULL SYNC
    // ──────────────────────────────────────────────────────────

    async fullSync(tenantId: string): Promise<{
        invoices: { synced: number; updated: number; errors: number };
        expenses: { synced: number; imported: number; errors: number };
        contacts: { synced: number; errors: number };
        bankAccounts: { synced: number };
    }> {
        const [invToZoho, invFromZoho, expToZoho, expFromZoho, companies, banks] = await Promise.allSettled([
            this.syncInvoicesToZoho(tenantId),
            this.syncInvoicesFromZoho(tenantId),
            this.syncExpensesToZoho(tenantId),
            this.syncExpensesFromZoho(tenantId),
            this.syncCompaniesToZoho(tenantId),
            this.syncBankAccountsFromZoho(tenantId),
        ]);

        return {
            invoices: {
                synced:  (invToZoho.status   === 'fulfilled' ? invToZoho.value.synced   : 0),
                updated: (invFromZoho.status  === 'fulfilled' ? invFromZoho.value.updated : 0),
                errors:  (invToZoho.status   === 'fulfilled' ? invToZoho.value.errors   : 1),
            },
            expenses: {
                synced:   (expToZoho.status  === 'fulfilled' ? expToZoho.value.synced    : 0),
                imported: (expFromZoho.status === 'fulfilled' ? expFromZoho.value.imported : 0),
                errors:   (expToZoho.status  === 'fulfilled' ? expToZoho.value.errors    : 1),
            },
            contacts: {
                synced: (companies.status === 'fulfilled' ? companies.value.synced  : 0),
                errors: (companies.status === 'fulfilled' ? companies.value.errors  : 1),
            },
            bankAccounts: {
                synced: (banks.status === 'fulfilled' ? banks.value.synced : 0),
            },
        };
    }
}

