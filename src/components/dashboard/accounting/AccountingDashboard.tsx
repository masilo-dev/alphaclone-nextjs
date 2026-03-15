import React, { useState, useEffect } from 'react';
import { useTenant } from '../../../contexts/TenantContext';
import { Card, Button } from '../../ui/UIComponents';
import { DollarSign, ArrowUpRight, ArrowDownRight, FileText, Activity, Upload, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import ReceiptUploadModal from './ReceiptUploadModal';
import { journalEntryService } from '../../../services/accounting/journalEntryService';
import { chartOfAccountsService, ChartOfAccount } from '../../../services/accounting/chartOfAccountsService';
import toast from 'react-hot-toast';
import { JournalEntryModal } from './JournalEntryModal';
import ReceiptGeneratorModal from './ReceiptGeneratorModal';
import { generalLedgerService } from '../../../services/accounting/generalLedgerService';

// A simplified Accounting Dashboard focused on cash flow, revenue, and automated AI receipt tracking.
export default function AccountingDashboard() {
    const { currentTenant } = useTenant();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'balance'>('overview');
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
    const [isReceiptGeneratorOpen, setIsReceiptGeneratorOpen] = useState(false);
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalExpenses: 0,
        pendingInvoices: 0,
        cashBalance: 0,
        recentTransactions: [] as any[]
    });

    useEffect(() => {
        let mounted = true;
        const loadAccountingData = async () => {
            if (!currentTenant) return;
            setLoading(true);

            try {
                const now = new Date();
                const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
                const endOfToday = now.toISOString().split('T')[0];

                // 1. Fetch Profit and Loss for Revenue/Expenses
                const { statement, error: pnlError } = await generalLedgerService.getProfitLossData(startOfYear, endOfToday);
                if (pnlError) console.error('P&L Error:', pnlError);

                // 2. Fetch Trial Balance for Cash Balance
                const { trialBalance, error: tbError } = await generalLedgerService.getTrialBalance(endOfToday);
                if (tbError) console.error('TB Error:', tbError);

                // 3. Fetch Pending/Overdue Invoices (Sales Metric)
                const { data: pendingInvoices } = await supabase
                    .from('business_invoices')
                    .select('total')
                    .eq('tenant_id', currentTenant.id)
                    .in('status', ['draft', 'sent', 'overdue']);

                const pending = (pendingInvoices || []).reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);

                // Calculate stats from service data
                const revenue = statement?.totalRevenue || 0;
                const totalExp = statement?.totalExpenses || 0;

                // Cash accounts are generally 10xx in COA
                const cashBalance = (trialBalance?.accounts || [])
                    .filter(a => a.accountType === 'asset' && (a.accountCode?.startsWith('10') || a.accountName.toLowerCase().includes('cash') || a.accountName.toLowerCase().includes('bank')))
                    .reduce((sum, a) => sum + (a.debitBalance - a.creditBalance), 0);

                // 3. Fetch Recent Transactions (Journal Entries mapped simply)
                const { data: entries } = await supabase
                    .from('journal_entries')
                    .select('*, journal_entry_lines(*)')
                    .eq('tenant_id', currentTenant.id)
                    .order('entry_date', { ascending: false })
                    .limit(10);

                // Map complex journal entries into a simple list
                const simpleTransactions = (entries || []).map((entry: any) => {
                    const line = entry.journal_entry_lines?.[0];
                    const amount = line?.amount || 0;
                    return {
                        id: entry.id,
                        date: entry.entry_date,
                        description: entry.description || entry.reference_number || 'Transaction',
                        amount: amount,
                        type: line?.is_debit && line?.account_id?.includes('revenue') ? 'income' : (amount >= 0 ? 'income' : 'expense') // Highly simplified heuristic
                    };
                });

                if (mounted) {
                    setStats({
                        totalRevenue: revenue,
                        totalExpenses: totalExp,
                        pendingInvoices: pending,
                        cashBalance: cashBalance, // Accurately reflects COA asset balance
                        recentTransactions: simpleTransactions
                    });
                }

                // Fetch Chart of Accounts for Manual Entry
                const { accounts: fetchedAccounts } = await chartOfAccountsService.getAccounts();
                if (mounted && fetchedAccounts) {
                    setAccounts(fetchedAccounts);
                }
            } catch (err) {
                console.error("Failed to load accounting data", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadAccountingData();

        return () => { mounted = false; };
    }, [currentTenant]);

    const handleReceiptSuccess = async (extractedData: any) => {
        setIsUploadOpen(false);
        const loadToast = toast.loading('Saving expense record...');
        try {
            // 1. Dynamic Account Mapping based on AI category
            // We search through our fetched accounts for the best expense match
            let expenseAccount = accounts.find(a =>
                a.accountType === 'expense' &&
                extractedData.category &&
                (a.accountName.toLowerCase().includes(extractedData.category.toLowerCase()) ||
                    extractedData.category.toLowerCase().includes(a.accountName.toLowerCase()))
            );

            // 2. Fallbacks if no direct match
            if (!expenseAccount) {
                // Try to find "Office Supplies" or any Expense account
                expenseAccount = accounts.find(a => a.accountCode === '6100') ||
                    accounts.find(a => a.accountType === 'expense');
            }

            const cashAccount = accounts.find(a => a.accountCode === '1000') ||
                accounts.find(a => a.accountType === 'asset' && a.accountName.toLowerCase().includes('cash'));

            if (!expenseAccount || !cashAccount) {
                toast.error('Could not find suitable accounts for this transaction. Please create them in the Chart of Accounts.', { id: loadToast });
                return;
            }

            const { error } = await journalEntryService.createEntry({
                entryDate: extractedData.date,
                description: `Receipt: ${extractedData.description}`,
                reference: 'AI-VISION-RECEIPT',
                sourceType: 'manual',
                lines: [
                    {
                        accountId: expenseAccount.id,
                        debitAmount: extractedData.amount,
                        creditAmount: 0,
                        description: extractedData.description,
                        entityType: 'manual',
                    },
                    {
                        accountId: cashAccount.id,
                        debitAmount: 0,
                        creditAmount: extractedData.amount,
                        description: `Paid for ${extractedData.description}`,
                        entityType: 'manual',
                    }
                ]
            });

            if (error) throw new Error(error);

            toast.success('Successfully logged automated AI expense!', { id: loadToast });
            // Refresh dashboard
            setLoading(true);
            setTimeout(() => { setLoading(false); }, 500); // trigger a basic refetch simulation or move refetch out
        } catch (e: any) {
            toast.error(e.message || 'Error saving to General Ledger', { id: loadToast });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64 text-slate-400">
                <Activity className="w-8 h-8 animate-pulse text-teal-500 mr-3" />
                Loading Financial Overview...
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Accounting & Finance</h1>
                    <p className="text-slate-400">Automated financial tracking and AI receipt parsing.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button
                        variant="outline"
                        className="border-slate-700 hover:bg-slate-800 text-white"
                        onClick={() => setIsManualEntryOpen(true)}
                    >
                        <Activity className="w-4 h-4 mr-2" />
                        Manual Entry
                    </Button>
                    <Button
                        variant="outline"
                        className="bg-indigo-600/10 border-indigo-500/30 hover:bg-indigo-600/20 text-indigo-400"
                        onClick={() => setIsReceiptGeneratorOpen(true)}
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Generate Receipt
                    </Button>
                    <Button
                        className="bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/20"
                        onClick={() => setIsUploadOpen(true)}
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Receipt
                    </Button>
                </div>
            </div>

            {/* Dashboard Tabs */}
            <div className="flex overflow-x-auto pb-2 mb-6 gap-2 border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === 'overview'
                        ? 'border-teal-500 text-teal-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab('income')}
                    className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === 'income'
                        ? 'border-teal-500 text-teal-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    Income Statement
                </button>
                <button
                    onClick={() => setActiveTab('balance')}
                    className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === 'balance'
                        ? 'border-teal-500 text-teal-400'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                >
                    Balance Sheet
                </button>
            </div>

            {activeTab === 'overview' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Cash Balance */}
                        <Card className="p-6 bg-slate-900 border-slate-800">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-400 mb-1">Cash Balance</p>
                                    <h3 className="text-3xl lg:text-4xl font-bold text-white">${stats.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                                </div>
                            </div>
                        </Card>

                        {/* Total Revenue */}
                        <Card className="p-6 bg-slate-900 border-slate-800">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-400 mb-1">Total Revenue</p>
                                    <h3 className="text-3xl lg:text-4xl font-bold text-teal-400">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                                </div>
                            </div>
                        </Card>

                        {/* Total Expenses */}
                        <Card className="p-6 bg-slate-900 border-slate-800">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-400 mb-1">Total Expenses</p>
                                    <h3 className="text-3xl lg:text-4xl font-bold text-rose-400">${stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Pending Invoices */}
                    <Card className="p-6 bg-slate-900 border-slate-800 mb-8 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-400 mb-1">Pending Invoices (Unpaid)</p>
                                <p className="text-slate-500 text-sm">Awaiting collection from clients</p>
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-white">${stats.pendingInvoices.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                    </Card>

                    {/* Recent Transactions */}
                    <Card className="p-6 bg-slate-900 border-slate-800">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center">
                            <Activity className="w-5 h-5 mr-2 text-teal-400" />
                            Recent Automated Ledger Entries
                        </h3>

                        {stats.recentTransactions.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-800 rounded-xl">
                                No recent transactions found.
                            </div>
                        ) : (
                            <div className="min-w-full overflow-x-auto">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-800 text-slate-400 mb-2 font-medium">
                                            <th className="pb-3 px-2">Date</th>
                                            <th className="pb-3 px-2">Description</th>
                                            <th className="pb-3 px-2 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {stats.recentTransactions.map((tx) => (
                                            <tr key={tx.id} className="hover:bg-slate-800/20 transition-colors">
                                                <td className="py-4 px-2 text-slate-300">
                                                    {new Date(tx.date).toLocaleDateString()}
                                                </td>
                                                <td className="py-4 px-2 text-white font-medium">
                                                    {tx.description}
                                                </td>
                                                <td className={`py-4 px-2 text-right font-medium ${tx.type === 'income' ? 'text-teal-400' : 'text-slate-300'}`}>
                                                    {tx.type === 'income' ? '+' : ''}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </>
            )}

            {/* Income Statement View */}
            {activeTab === 'income' && (
                <Card className="p-8 bg-slate-900 border-slate-800">
                    <h2 className="text-xl font-bold text-white mb-6">Income Statement</h2>
                    <div className="space-y-6">
                        <div className="flex justify-between items-center py-2 border-b border-slate-800">
                            <span className="text-slate-300">Revenue (Paid Invoices)</span>
                            <span className="text-teal-400 font-medium">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-800">
                            <span className="text-slate-300 pl-4">Cost of Goods Sold</span>
                            <span className="text-rose-400 font-medium">$0.00</span>
                        </div>
                        <div className="flex justify-between items-center py-3 bg-slate-800/50 px-4 rounded-lg font-bold">
                            <span className="text-white">Gross Profit</span>
                            <span className="text-white">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="mt-8 mb-4 font-semibold text-slate-400 uppercase tracking-wider text-sm">Operating Expenses</div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-800">
                            <span className="text-slate-300 pl-4">General & Administrative (AI Receipt uploads)</span>
                            <span className="text-rose-400 font-medium">${stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="flex justify-between items-center py-4 mt-6 border-t-2 border-slate-700 font-bold text-lg">
                            <span className="text-white">Net Income</span>
                            <span className={(stats.totalRevenue - stats.totalExpenses) >= 0 ? "text-teal-400" : "text-rose-400"}>
                                ${(stats.totalRevenue - stats.totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </Card>
            )}

            {/* Balance Sheet View */}
            {activeTab === 'balance' && (
                <Card className="p-8 bg-slate-900 border-slate-800">
                    <h2 className="text-xl font-bold text-white mb-6">Balance Sheet</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        {/* Assets */}
                        <div>
                            <h3 className="font-bold text-white mb-4 border-b border-slate-800 pb-2">ASSETS</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-300">Cash & Equivalents</span>
                                    <span className="text-white">${stats.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-300">Accounts Receivable</span>
                                    <span className="text-white">${stats.pendingInvoices.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between py-2 mt-4 border-t border-slate-800 font-bold">
                                    <span className="text-white">Total Assets</span>
                                    <span className="text-teal-400">${(stats.cashBalance + stats.pendingInvoices).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* Liabilities & Equity */}
                        <div>
                            <h3 className="font-bold text-white mb-4 border-b border-slate-800 pb-2">LIABILITIES & EQUITY</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-300">Accounts Payable</span>
                                    <span className="text-white">$0.00</span>
                                </div>
                                <div className="flex justify-between text-sm mt-6">
                                    <span className="text-slate-300">Retained Earnings</span>
                                    <span className="text-white">${(stats.totalRevenue - stats.totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between py-2 mt-4 border-t border-slate-800 font-bold">
                                    <span className="text-white">Total L & E</span>
                                    <span className="text-teal-400">${(stats.totalRevenue - stats.totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            <ReceiptUploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onSuccess={handleReceiptSuccess}
            />

            <JournalEntryModal
                isOpen={isManualEntryOpen}
                onClose={() => setIsManualEntryOpen(false)}
                onSuccess={() => {
                    setIsManualEntryOpen(false);
                    // trigger a basic refetch simulation
                    setLoading(true);
                    setTimeout(() => { setLoading(false); }, 500);
                }}
                accounts={accounts}
            />

            <ReceiptGeneratorModal
                isOpen={isReceiptGeneratorOpen}
                onClose={() => setIsReceiptGeneratorOpen(false)}
            />
        </div>
    );
}
