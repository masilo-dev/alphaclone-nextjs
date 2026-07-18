'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Receipt, Plus, Trash2, Edit2, Filter, Download, CheckCircle2,
    Clock, XCircle, DollarSign, TrendingUp, TrendingDown, Loader2,
    Tag, Calendar, ChevronDown, X, AlertCircle, FileText, Camera, Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { chartOfAccountsService, ChartOfAccount } from '@/services/accounting/chartOfAccountsService';
import toast from 'react-hot-toast';
import { DetailDrawer } from '@/components/ui/DetailDrawer';
import {
    MobileDataCard,
    ResponsiveTableDesktop,
    ResponsiveTableMobile,
    rowActionsClass,
} from '../../ui/ResponsiveTable';

interface ExpenseCategory {
    id: string;
    name: string;
    color: string;
    icon: string;
}

interface Expense {
    id: string;
    expense_number: string;
    date: string;
    amount: number;
    tax_amount: number;
    total: number;
    currency: string;
    description: string;
    vendor_name: string;
    payment_method: string;
    status: string;
    billable: boolean;
    receipt_url: string | null;
    notes: string | null;
    category_id: string | null;
    client_id?: string | null;
    created_at: string;
    expense_categories?: ExpenseCategory;
    asset_account?: {
        id: string;
        account_name: string;
        account_code: string;
    } | null;
}

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    approved: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
    rejected: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    reimbursed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const PAYMENT_METHODS = ['card', 'cash', 'bank_transfer', 'check', 'other'];
const DEFAULT_CATEGORIES = [
    { name: 'Software & SaaS', color: '#6366f1', icon: '💻' },
    { name: 'Office Supplies', color: '#f59e0b', icon: '📎' },
    { name: 'Travel', color: '#3b82f6', icon: '✈️' },
    { name: 'Marketing', color: '#ec4899', icon: '📢' },
    { name: 'Meals & Entertainment', color: '#10b981', icon: '🍽️' },
    { name: 'Utilities', color: '#8b5cf6', icon: '⚡' },
    { name: 'Professional Services', color: '#06b6d4', icon: '🤝' },
    { name: 'Equipment', color: '#f97316', icon: '🔧' },
];

const EMPTY_FORM = {
    date: new Date().toISOString().split('T')[0],
    amount: '',
    tax_amount: '0',
    currency: 'USD',
    description: '',
    vendor_name: '',
    payment_method: 'card',
    status: 'pending',
    billable: false,
    client_id: '',
    notes: '',
    category_id: '',
    asset_account_id: '',
    receipt_url: '',
};

export default function ExpenseTrackerTab() {
    const { currentTenant: tenant } = useTenant();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
    const [categories, setCategories] = useState<ExpenseCategory[]>([]);
    const [assetAccounts, setAssetAccounts] = useState<ChartOfAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [scanning, setScanning] = useState(false);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

    const handleCameraScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !tenant?.id) return;

        setScanning(true);
        const objectUrl = URL.createObjectURL(file);
        setReceiptPreview(objectUrl);

        try {
            const request = new FormData();
            request.set('file', file);
            request.set('tenantId', tenant.id);
            const response = await fetch('/api/ai/vision', { method: 'POST', body: request });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result?.data) throw new Error(result.error || 'Receipt scan failed');
            const extracted = result.data as Record<string, unknown>;
            const suggested = String(extracted.category || '').toLowerCase();
            const categoryId = categories.find((category) =>
                suggested && (suggested.includes(category.name.toLowerCase()) || category.name.toLowerCase().includes(suggested))
            )?.id || '';
            setForm((current) => ({
                ...current,
                date: String(extracted.date || current.date),
                amount: Number(extracted.amount || 0) > 0 ? String(extracted.amount) : '',
                description: String(extracted.description || ''),
                vendor_name: String(extracted.description || ''),
                category_id: categoryId,
                receipt_url: String(extracted.receiptUrl || ''),
                notes: 'Review the extracted fields against the attached receipt before saving.',
            }));
            setEditingId(null);
            setShowForm(true);
            toast.success('Receipt scanned. Review the fields before saving.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Receipt scan failed');
        } finally {
            setScanning(false);
        }
    };

    const loadData = useCallback(async () => {
        if (!tenant?.id) return;
        setLoading(true);

        const [expRes, catRes, clientRes] = await Promise.all([
            supabase
                .from('expenses')
                .select('*, expense_categories(id, name, color, icon), asset_account:chart_of_accounts!asset_account_id(id, account_name, account_code)')
                .eq('tenant_id', tenant.id)
                .order('date', { ascending: false })
                .limit(200),
            supabase
                .from('expense_categories')
                .select('*')
                .eq('tenant_id', tenant.id)
                .eq('is_active', true)
                .order('name'),
            supabase
                .from('business_clients')
                .select('id, name')
                .eq('tenant_id', tenant.id)
                .eq('is_active', true)
                .order('name'),
        ]);

        let assetAccountsResult = await chartOfAccountsService.getAccountsByType('asset');

        if (!assetAccountsResult.error && assetAccountsResult.accounts.length === 0) {
            const initResult = await chartOfAccountsService.initializeDefaultAccounts();
            if (initResult.success) {
                assetAccountsResult = await chartOfAccountsService.getAccountsByType('asset');
            }
        }

        if (!expRes.error) setExpenses(expRes.data || []);
        if (!catRes.error) setCategories(catRes.data || []);
        if (!clientRes.error) setClients(clientRes.data || []);
        if (!assetAccountsResult.error) {
            setAssetAccounts(assetAccountsResult.accounts);
        } else {
            setAssetAccounts([]);
        }
        setLoading(false);
    }, [tenant]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if (!form.asset_account_id && assetAccounts.length > 0) {
            const preferredAccount = assetAccounts.find((account) =>
                account.accountSubtype === 'current_asset' ||
                account.accountName.toLowerCase().includes('cash') ||
                account.accountName.toLowerCase().includes('bank')
            ) || assetAccounts[0];

            setForm((prev) => ({ ...prev, asset_account_id: preferredAccount.id }));
        }
    }, [assetAccounts, form.asset_account_id]);

    // Seed default categories if none exist
    useEffect(() => {
        if (!loading && categories.length === 0 && tenant?.id) {
            const seed = async () => {
                await fetch('/api/finance/expenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'seed_categories', tenantId: tenant.id }),
                });
                loadData();
            };
            seed();
        }
    }, [loading, categories.length, tenant?.id, loadData]);

    const filtered = expenses.filter(e => {
        if (statusFilter !== 'all' && e.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && e.category_id !== categoryFilter) return false;
        if (dateFrom && e.date < dateFrom) return false;
        if (dateTo && e.date > dateTo) return false;
        return true;
    });

    const totalAmount = filtered.reduce((sum, e) => sum + (e.total ?? e.amount), 0);
    const pendingAmount = filtered.filter(e => e.status === 'pending').reduce((sum, e) => sum + (e.total ?? e.amount), 0);
    const approvedAmount = filtered.filter(e => e.status === 'approved').reduce((sum, e) => sum + (e.total ?? e.amount), 0);

    const handleSave = async () => {
        if (!tenant?.id) return;
        if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Amount is required');
        if (!form.date) return toast.error('Date is required');

        setSaving(true);
        const payload = {
            tenant_id: tenant.id,
            date: form.date,
            amount: parseFloat(form.amount),
            tax_amount: parseFloat(form.tax_amount) || 0,
            currency: form.currency,
            description: form.description,
            vendor_name: form.vendor_name,
            payment_method: form.payment_method,
            status: form.status,
            billable: form.billable,
            client_id: form.billable && form.client_id ? form.client_id : null,
            notes: form.notes || null,
            category_id: form.category_id || null,
            asset_account_id: form.asset_account_id || null,
            receipt_url: form.receipt_url || null,
        };

        const response = await fetch('/api/finance/expenses', {
            method: editingId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingId
                ? { tenantId: tenant.id, expenseId: editingId, ...payload }
                : { action: 'create', tenantId: tenant.id, ...payload }),
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            toast.error(result.error || 'Expense could not be saved');
        } else {
            toast.success(editingId ? 'Expense updated' : 'Expense added');
            setShowForm(false);
            setEditingId(null);
            setForm({ ...EMPTY_FORM });
            loadData();
        }
        setSaving(false);
    };

    const handleEdit = (expense: Expense) => {
        setForm({
            date: expense.date,
            amount: String(expense.amount),
            tax_amount: String(expense.tax_amount || 0),
            currency: expense.currency,
            description: expense.description || '',
            vendor_name: expense.vendor_name || '',
            payment_method: expense.payment_method,
            status: expense.status,
            billable: expense.billable,
            client_id: expense.client_id || '',
            notes: expense.notes || '',
            category_id: expense.category_id || '',
            asset_account_id: (expense as any).asset_account_id || '',
            receipt_url: expense.receipt_url || '',
        });
        setEditingId(expense.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this expense?')) return;
        if (!tenant?.id) return;
        const response = await fetch(`/api/finance/expenses?tenantId=${encodeURIComponent(tenant.id)}&expenseId=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (response.ok) {
            toast.success('Deleted');
            setExpenses(prev => prev.filter(e => e.id !== id));
        }
    };

    const handleStatusChange = async (id: string, status: string) => {
        if (!tenant?.id) return;
        const action = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : null;
        if (!action) {
            toast.error('This status change requires the reimbursement workflow.');
            return;
        }
        const response = await fetch('/api/finance/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, tenantId: tenant.id, expenseId: id }),
        });
        if (response.ok) {
            setExpenses(prev => prev.map(e => e.id === id ? { ...e, status } : e));
            toast.success('Status updated');
        }
    };

    const fmt = (n: number, currency = 'USD') =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {scanning && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110] flex flex-col items-center justify-center gap-4">
                    <div className="relative w-20 h-20">
                        <div className="absolute inset-0 border-4 border-violet-500/30 rounded-full" />
                        <div className="absolute inset-0 border-4 border-t-violet-500 rounded-full animate-spin" />
                        <div className="absolute inset-4 bg-slate-900 rounded-full flex items-center justify-center">
                            <Camera className="w-6 h-6 text-violet-400" />
                        </div>
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-white font-bold flex items-center gap-2 justify-center">
                            <Sparkles className="w-4 h-4 text-violet-400 animate-pulse" />
                            AI Scanner Active
                        </p>
                        <p className="text-xs text-slate-400">Extracting receipt details with OCR...</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Expense Tracker</h2>
                    <p className="text-sm text-slate-400">Track, categorize, and manage business expenses</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 rounded-xl font-semibold text-sm transition-all cursor-pointer active:scale-95">
                        <Camera className="w-4 h-4 text-violet-400" />
                        <span>Receipt Scan</span>
                        <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            className="hidden" 
                            onChange={handleCameraScan} 
                        />
                    </label>
                    <button
                        onClick={() => { setShowForm(true); setEditingId(null); setForm({ ...EMPTY_FORM }); setReceiptPreview(null); }}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Add Expense
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 28px Prominent Spend Card */}
                <div className="col-span-1 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/30 rounded-3xl p-6 relative overflow-hidden shadow-lg shadow-violet-500/5">
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-violet-500/10 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Spending</span>
                        <DollarSign className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="text-[28px] font-black text-white font-mono tracking-tight leading-none mb-1">
                        {fmt(totalAmount)}
                    </div>
                    <span className="text-xs text-slate-500">Filtered active expenses</span>
                </div>

                {/* Pending Card */}
                <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pending Approval</span>
                        <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-amber-400 font-mono tracking-tight leading-none mb-1">
                            {fmt(pendingAmount)}
                        </div>
                        <span className="text-xs text-slate-500">{filtered.filter(e => e.status === 'pending').length} pending items</span>
                    </div>
                </div>

                {/* Approved Card */}
                <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Approved Spend</span>
                        <CheckCircle2 className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-teal-400 font-mono tracking-tight leading-none mb-1">
                            {fmt(approvedAmount)}
                        </div>
                        <span className="text-xs text-slate-500">{filtered.filter(e => e.status === 'approved').length} approved items</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="reimbursed">Reimbursed</option>
                </select>
                <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                >
                    <option value="all">All Categories</option>
                    {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                </select>
                <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                    placeholder="From"
                />
                <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                />
                {(statusFilter !== 'all' || categoryFilter !== 'all' || dateFrom || dateTo) && (
                    <button
                        onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); setDateFrom(''); setDateTo(''); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                        <X className="w-3 h-3" /> Clear
                    </button>
                )}
            </div>

            {/* Add/Edit Form */}
            {/* Add/Edit Form */}
            <DetailDrawer
                open={showForm}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowForm(false);
                        setEditingId(null);
                    }
                }}
                title={editingId ? 'Edit Expense' : 'Add Expense'}
                size="wide"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Date *</label>
                            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Amount *</label>
                            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                placeholder="0.00"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Tax Amount</label>
                            <input type="number" min="0" step="0.01" value={form.tax_amount} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))}
                                placeholder="0.00"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Vendor / Payee</label>
                            <input type="text" value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
                                placeholder="e.g. Amazon, Uber"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Category</label>
                            <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm">
                                <option value="">Uncategorized</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Payment Method</label>
                            <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm capitalize">
                                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Paid From (Asset)</label>
                            <select value={form.asset_account_id} onChange={e => setForm(f => ({ ...f, asset_account_id: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm">
                                <option value="">Select Account</option>
                                {assetAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.accountName} ({acc.accountCode})</option>
                                ))}
                            </select>
                            {assetAccounts.length === 0 && (
                                <p className="mt-2 text-xs text-amber-400">
                                    No asset accounts are available yet. Open Accounting and initialize the chart of accounts if this stays empty.
                                </p>
                            )}
                        </div>
                        <div className="sm:col-span-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Description</label>
                            <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="What was this expense for?"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Status</label>
                            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm">
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="reimbursed">Reimbursed</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-3">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Notes</label>
                            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                rows={2} placeholder="Additional notes..."
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm resize-none" />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="billable" checked={form.billable} onChange={e => setForm(f => ({ ...f, billable: e.target.checked }))}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500 focus:ring-offset-0" />
                            <label htmlFor="billable" className="text-sm text-slate-300">Billable to client</label>
                        </div>
                        {form.billable && (
                            <div className="sm:col-span-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Bill to client</label>
                                <select
                                    value={form.client_id}
                                    onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                                >
                                    <option value="">Select client</option>
                                    {clients.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {receiptPreview && (
                            <div className="sm:col-span-2 lg:col-span-3">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Scanned Receipt Attachment</label>
                                <div className="relative w-32 h-32 rounded-2xl overflow-hidden border border-white/10 bg-slate-950 flex items-center justify-center group/receipt">
                                    <img src={receiptPreview} alt="Receipt Preview" className="w-full h-full object-cover" />
                                    <button 
                                        type="button"
                                        onClick={() => setReceiptPreview(null)}
                                        className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-black text-white rounded-full transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {saving ? 'Saving...' : (editingId ? 'Update' : 'Add Expense')}
                        </button>
                        <button onClick={() => { setShowForm(false); setEditingId(null); }}
                            className="px-5 py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-sm transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            </DetailDrawer>

            {/* Expenses Table */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                    <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 font-semibold">No expenses found</p>
                    <p className="text-slate-600 text-sm mt-1">Add your first expense to start tracking spending.</p>
                </div>
            ) : (
                <>
                <ResponsiveTableMobile>
                    {filtered.map((expense) => (
                        <MobileDataCard key={expense.id} className="group border-slate-800 bg-slate-900/40">
                            <div className="flex justify-between gap-2">
                                <p className="text-white font-medium truncate flex-1">{expense.description || '—'}</p>
                                <p className="font-semibold text-white shrink-0">{fmt(expense.total ?? expense.amount, expense.currency)}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                                <span>{new Date(expense.date + 'T00:00:00').toLocaleDateString()}</span>
                                <span className="truncate">{expense.vendor_name || '—'}</span>
                                <span>{expense.expense_categories?.name || '—'}</span>
                                <span className="capitalize">{expense.payment_method?.replace('_', ' ') || '—'}</span>
                            </div>
                            <select
                                value={expense.status}
                                onChange={(e) => handleStatusChange(expense.id, e.target.value)}
                                className={`w-full min-h-11 text-xs px-2 py-2 border rounded-lg bg-slate-950 focus:outline-none ${STATUS_STYLES[expense.status] || STATUS_STYLES.pending}`}
                            >
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="reimbursed">Reimbursed</option>
                            </select>
                            <div className={`${rowActionsClass} justify-end`}>
                                <button onClick={() => handleEdit(expense)} className="min-h-11 px-3 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs">Edit</button>
                                <button onClick={() => handleDelete(expense.id)} className="min-h-11 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs">Delete</button>
                            </div>
                        </MobileDataCard>
                    ))}
                    <MobileDataCard className="border-slate-700 bg-slate-900/60">
                        <div className="flex justify-between text-sm font-bold text-white">
                            <span>{filtered.length} expense{filtered.length !== 1 ? 's' : ''}</span>
                            <span>{fmt(totalAmount)}</span>
                        </div>
                    </MobileDataCard>
                </ResponsiveTableMobile>
                <ResponsiveTableDesktop className="rounded-2xl border border-slate-800 min-w-0">
                    <table className="w-full min-w-[720px] text-sm">
                        <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/50">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vendor</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Method / Account</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {filtered.map(expense => (
                                <tr key={expense.id} className="hover:bg-slate-800/30 transition-colors group">
                                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                                        {new Date(expense.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="px-4 py-3">
                                        <p className="text-white font-medium truncate max-w-[180px]">
                                            {expense.description || '—'}
                                        </p>
                                        {expense.billable && (
                                            <span className="text-xs text-blue-400 font-medium">Billable</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {expense.expense_categories ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/60 border border-white/5 text-slate-300 text-xs">
                                                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-slate-900" style={{ color: expense.expense_categories.color }}>
                                                    {expense.expense_categories.icon || '🏷️'}
                                                </span>
                                                <span className="font-medium text-slate-200">{expense.expense_categories.name}</span>
                                            </span>
                                        ) : (
                                            <span className="text-slate-600 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[120px]">
                                        {expense.vendor_name || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 text-xs">
                                        <p className="capitalize">{expense.payment_method?.replace('_', ' ')}</p>
                                        {expense.asset_account?.account_name && (
                                            <p className="text-xs text-slate-600 font-mono">
                                                {expense.asset_account.account_name}
                                                {expense.asset_account.account_code ? ` (${expense.asset_account.account_code})` : ''}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-white whitespace-nowrap">
                                        {fmt(expense.total ?? expense.amount, expense.currency)}
                                        {expense.tax_amount > 0 && (
                                            <p className="text-xs text-slate-500 font-normal">+{fmt(expense.tax_amount, expense.currency)} tax</p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <select
                                            value={expense.status}
                                            onChange={e => handleStatusChange(expense.id, e.target.value)}
                                            className={`text-xs px-2 py-1 border rounded-lg bg-transparent focus:outline-none cursor-pointer ${STATUS_STYLES[expense.status] || STATUS_STYLES.pending}`}
                                        >
                                            <option value="pending">Pending</option>
                                            <option value="approved">Approved</option>
                                            <option value="rejected">Rejected</option>
                                            <option value="reimbursed">Reimbursed</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className={`justify-end ${rowActionsClass}`}>
                                            <button onClick={() => handleEdit(expense)}
                                                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDelete(expense.id)}
                                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-slate-700 bg-slate-900/50">
                                <td colSpan={5} className="px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">
                                    {filtered.length} expense{filtered.length !== 1 ? 's' : ''}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-white">
                                    {fmt(totalAmount)}
                                </td>
                                <td colSpan={2} />
                            </tr>
                        </tfoot>
                    </table>
                </ResponsiveTableDesktop>
                </>
            )}
        </div>
    );
}
