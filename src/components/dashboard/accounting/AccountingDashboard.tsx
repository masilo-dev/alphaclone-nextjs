'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '../../../contexts/TenantContext';
import { Card, Button } from '../../ui/UIComponents';
import { 
    DollarSign, ArrowUpRight, ArrowDownRight, FileText, Activity, Upload, 
    CheckCircle2, Calendar, ShieldCheck, ChevronDown, TrendingUp, Wallet, 
    ArrowRight, Clock, Plus, Filter, MoreHorizontal, Receipt
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import ReceiptUploadModal from './ReceiptUploadModal';
import { journalEntryService } from '../../../services/accounting/journalEntryService';
import { chartOfAccountsService, ChartOfAccount } from '../../../services/accounting/chartOfAccountsService';
import { receiptService, BusinessReceipt } from '../../../services/accounting/receiptService';
import toast from 'react-hot-toast';
import { JournalEntryModal } from './JournalEntryModal';
import ReceiptGeneratorModal from './ReceiptGeneratorModal';
import { generalLedgerService } from '../../../services/accounting/generalLedgerService';
import { advancedAccountingService } from '../../../services/accounting/advancedAccountingService';
import { getOperationalFinancials } from '../../../services/accounting/operationalAccountingService';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { ChartOfAccountsPage } from './ChartOfAccountsPage';
import { JournalEntriesPage } from './JournalEntriesPage';
import { FinancialReportsPage } from './FinancialReportsPage';

type Period = 'week' | 'month' | 'quarter' | 'year';
type AccountingTab = 'overview' | 'income' | 'reports' | 'chart' | 'journal' | 'receipts';

const ACCOUNTING_TABS: { key: AccountingTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'income', label: 'Income' },
    { key: 'reports', label: 'Financial Reports' },
    { key: 'chart', label: 'Chart of Accounts' },
    { key: 'journal', label: 'Journal Entries' },
    { key: 'receipts', label: 'Receipts' },
];

export default function AccountingDashboard() {
    const { currentTenant } = useTenant();
    const { isMobile, isTablet, isDesktop } = useBreakpoint();
    
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<AccountingTab>('overview');
    const [period, setPeriod] = useState<Period>('month');
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
    const [isReceiptGeneratorOpen, setIsReceiptGeneratorOpen] = useState(false);
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [receipts, setReceipts] = useState<BusinessReceipt[]>([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        totalExpenses: 0,
        pendingInvoices: 0,
        cashBalance: 0,
        openBills: 0,
        overdueBills: 0,
        unreconciledTransactions: 0,
        activeBankAccounts: 0,
        recentTransactions: [] as any[]
    });

    useEffect(() => {
        let mounted = true;
        const loadAccountingData = async () => {
            if (!currentTenant) return;
            setLoading(true);

            try {
                const now = new Date();
                let startDate = new Date(now.getFullYear(), 0, 1);
                
                if (period === 'week') {
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - 7);
                } else if (period === 'month') {
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                } else if (period === 'quarter') {
                    const quarter = Math.floor(now.getMonth() / 3);
                    startDate = new Date(now.getFullYear(), quarter * 3, 1);
                }

                const startDateStr = startDate.toISOString().split('T')[0];
                const endOfToday = now.toISOString().split('T')[0];

                const { statement } = await generalLedgerService.getProfitLossData(startDateStr, endOfToday);
                const { trialBalance } = await generalLedgerService.getTrialBalance(endOfToday);
                const { snapshot } = await advancedAccountingService.getOperatingSnapshot();
                const operational = await getOperationalFinancials(currentTenant.id, startDateStr, endOfToday);

                const pending = operational.pendingInvoices;
                const glRevenue = statement?.totalRevenue || 0;
                const glExpenses = statement?.totalExpenses || 0;

                // Fall back to invoices/receipts when the ledger has no posted journal entries yet.
                const revenue = glRevenue > 0
                    ? glRevenue + pending
                    : operational.invoiceRevenue + pending;
                const totalExp = glExpenses > 0 ? glExpenses : operational.receiptExpenses;

                let cashBalance = (trialBalance?.accounts || [])
                    .filter(a => a.accountType === 'asset' && (a.accountCode?.startsWith('10') || a.accountName.toLowerCase().includes('cash')))
                    .reduce((sum, a) => sum + (a.debitBalance - a.creditBalance), 0);

                if (cashBalance === 0 && operational.paidRevenue > 0) {
                    cashBalance = operational.paidRevenue - operational.receiptExpenses;
                }

                const { data: entries } = await supabase
                    .from('journal_entries')
                    .select('*, journal_entry_lines(*)')
                    .eq('tenant_id', currentTenant.id)
                    .order('entry_date', { ascending: false })
                    .limit(10);

                let simpleTransactions = (entries || []).map((entry: any) => {
                    const line = entry.journal_entry_lines?.[0];
                    const amount = line?.amount || (line?.debit_amount || line?.credit_amount || 0);
                    return {
                        id: entry.id,
                        date: entry.entry_date,
                        description: entry.description || entry.reference_number || 'Transaction',
                        amount: amount,
                        type: entry.journal_entry_lines?.some((l: any) => l.account_type === 'revenue') ? 'income' : 'expense'
                    };
                });

                if (simpleTransactions.length === 0 && operational.recentInvoiceActivity.length > 0) {
                    simpleTransactions = operational.recentInvoiceActivity;
                }

                if (mounted) {
                    setStats({
                        totalRevenue: revenue,
                        totalExpenses: totalExp,
                        pendingInvoices: pending,
                        cashBalance: cashBalance,
                        openBills: Number(snapshot?.openBills || 0),
                        overdueBills: Number(snapshot?.overdueBills || 0),
                        unreconciledTransactions: Number(snapshot?.unreconciledTransactions || 0),
                        activeBankAccounts: Number(snapshot?.activeBankAccounts || 0),
                        recentTransactions: simpleTransactions
                    });
                    const { accounts: fetchedAccounts } = await chartOfAccountsService.getAccounts();
                    const { receipts: fetchedReceipts } = await receiptService.getReceipts();
                    setAccounts(fetchedAccounts || []);
                    setReceipts(fetchedReceipts || []);
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadAccountingData();
        return () => { mounted = false; };
    }, [currentTenant, period]);

    const handleInitializeAccounts = async () => {
        const loadToast = toast.loading('Initializing business accounts...');
        try {
            await chartOfAccountsService.initializeDefaultAccounts();
            toast.success('Accounts initialized successfully!', { id: loadToast });
            // Reload data
            const { accounts: fetchedAccounts } = await chartOfAccountsService.getAccounts();
            setAccounts(fetchedAccounts || []);
        } catch (e: any) {
            toast.error(`Initialization failed: ${e.message}`, { id: loadToast });
        }
    };

    const handleReceiptSuccess = async () => {
        setIsUploadOpen(false);
        setLoading(true);
    };

    const handleMarkPaid = async (receiptId: string) => {
        const cashAccount = accounts.find(a => a.accountType === 'asset' && (a.accountCode?.startsWith('10') || a.accountName.toLowerCase().includes('cash')));
        if (!cashAccount) {
            toast.error('No cash account found to pay from');
            return;
        }

        const loadToast = toast.loading('Marking as paid...');
        try {
            const { success, error } = await receiptService.markAsPaid(receiptId, cashAccount.id);
            if (error) throw new Error(error);
            toast.success('Paid and added to ledger!', { id: loadToast });
            setLoading(true);
        } catch (e: any) {
            toast.error(e.message, { id: loadToast });
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-96 text-slate-400 gap-4">
                <Activity className="w-12 h-12 animate-pulse text-teal-500" />
                <p className="font-medium uppercase tracking-widest text-xs">Syncing Ledger...</p>
            </div>
        );
    }

    return (
        <div className={`relative space-y-6 max-w-7xl mx-auto pb-24 ${isMobile ? 'px-2' : 'px-6'}`}>
            {/* Initialization Banner for Empty Accounts */}
            {!loading && accounts.length === 0 && (
                <div className="bg-teal-500/10 border border-teal-500/20 rounded-[32px] p-8 flex flex-col md:flex-row items-center justify-between gap-6 mb-8 shadow-2xl shadow-teal-900/10 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-6 text-center md:text-left flex-col md:flex-row">
                        <div className="w-16 h-16 bg-teal-500 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-teal-500/20 shrink-0">
                            <ShieldCheck size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tight">Setup your ledger</h3>
                            <p className="text-slate-400 text-sm mt-1 max-w-md">Your Chart of Accounts is currently empty. Initialize standard business categories to start tracking your revenue and expenses.</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleInitializeAccounts}
                        className="w-full md:w-auto px-10 py-5 bg-teal-500 text-white font-black uppercase text-xs rounded-2xl shadow-xl shadow-teal-900/40 hover:bg-teal-400 active:scale-95 transition-all"
                    >
                        Initialize Accounts
                    </button>
                </div>
            )}

            {/* Standardized Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">Accounting Hub</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-black text-teal-500 uppercase tracking-widest bg-teal-500/10 px-2 py-0.5 rounded">Professional Edition</span>
                        <div className="w-1 h-1 rounded-full bg-slate-800" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Real-time Sync</span>
                    </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    {isMobile ? (
                        <button onClick={() => setIsManualEntryOpen(true)} className="flex-1 h-12 bg-teal-600 rounded-xl flex items-center justify-center text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-teal-900/20"><Plus size={18} className="mr-2" /> Entry</button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setIsManualEntryOpen(true)} className="bg-slate-900/50 border border-slate-800 text-slate-300"><Wallet className="w-4 h-4 mr-2" /> Add Transaction</Button>
                            <Button className="bg-teal-600 text-white" onClick={() => setIsUploadOpen(true)}><Upload className="w-4 h-4 mr-2" /> Upload Receipt</Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {[
                    { label: 'Open Bills', value: stats.openBills, accent: 'text-amber-300' },
                    { label: 'Overdue Bills', value: stats.overdueBills, accent: 'text-rose-300' },
                    { label: 'Unreconciled', value: stats.unreconciledTransactions, accent: 'text-sky-300' },
                    { label: 'Bank Accounts', value: stats.activeBankAccounts, accent: 'text-emerald-300' },
                ].map((item) => (
                    <Card key={item.label} className="bg-slate-950/70 border border-white/5 rounded-2xl p-4">
                        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">{item.label}</p>
                        <p className={`mt-2 text-2xl font-black ${item.accent}`}>{item.value}</p>
                    </Card>
                ))}
            </div>

            {/* Mobile-Friendly Tab Switcher */}
            <div className="flex border-b border-white/5 overflow-x-auto no-scrollbar">
                {ACCOUNTING_TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-6 py-4 text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all border-b-2 ${activeTab === tab.key ? 'border-teal-500 text-white bg-teal-500/5' : 'border-transparent text-gray-500'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card className="p-6 bg-slate-900/40 border-white/5">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Available Cash</p>
                            <h3 className="text-2xl font-black text-white">${stats.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                        </Card>
                        <Card className="p-6 bg-slate-900/40 border-white/5">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Revenue (MTD)</p>
                            <h3 className="text-2xl font-black text-teal-400">${stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                        </Card>
                        <Card className="p-6 bg-slate-900/40 border-white/5">
                            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Expenses (MTD)</p>
                            <h3 className="text-2xl font-black text-rose-400">${stats.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                        </Card>
                    </div>

                    {/* Responsive Ledger List */}
                    <div className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#141414]">
                            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center"><Activity size={16} className="mr-2 text-teal-500" /> Recent Ledger Activity</h3>
                        </div>
                        <div className="divide-y divide-white/5">
                            {stats.recentTransactions.map(tx => (
                                <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-all">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black text-white truncate">{tx.description}</p>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">{new Date(tx.date).toLocaleDateString()}</p>
                                    </div>
                                    <div className={`text-right font-black ${tx.type === 'income' ? 'text-teal-500' : 'text-gray-400'}`}>
                                        {tx.type === 'income' ? '+' : '-'}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'income' && (
                <Card className="p-6 sm:p-10 bg-slate-900/60 border-white/5 animate-in fade-in duration-300">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight mb-8">Statement of Profit & Loss</h2>
                    <div className="space-y-8">
                        <div>
                            <div className="text-xs font-black text-teal-500 uppercase tracking-widest mb-4 border-b border-teal-500/20 pb-2">Operating Revenue</div>
                            <div className="flex justify-between items-center py-2"><span className="text-sm font-bold text-gray-400">Gross Sales</span><span className="text-sm font-black text-white">${stats.totalRevenue.toLocaleString()}</span></div>
                            <div className="flex justify-between items-center py-4 mt-2 bg-teal-500/10 px-4 rounded-xl border border-teal-500/20"><span className="text-xs font-black uppercase text-teal-500">Gross Margin</span><span className="text-lg font-black text-white">${stats.totalRevenue.toLocaleString()}</span></div>
                        </div>
                        <div>
                            <div className="text-xs font-black text-rose-500 uppercase tracking-widest mb-4 border-b border-rose-500/20 pb-2">Operating Expenses</div>
                            <div className="flex justify-between items-center py-2"><span className="text-sm font-bold text-gray-400">G&A Expenses</span><span className="text-sm font-black text-rose-400">${stats.totalExpenses.toLocaleString()}</span></div>
                        </div>
                        <div className="pt-6 border-t border-white/5">
                            <div className="p-6 bg-white/[0.03] rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
                                <span className="text-xs font-black uppercase tracking-widest text-gray-500">Net Operational Result</span>
                                <span className={`text-3xl font-black ${stats.totalRevenue >= stats.totalExpenses ? 'text-teal-500' : 'text-rose-500'}`}>${(stats.totalRevenue - stats.totalExpenses).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {activeTab === 'reports' && (
                <div className="animate-in fade-in duration-300">
                    <FinancialReportsPage />
                </div>
            )}

            {activeTab === 'chart' && (
                <div className="animate-in fade-in duration-300">
                    <ChartOfAccountsPage />
                </div>
            )}

            {activeTab === 'journal' && (
                <div className="animate-in fade-in duration-300">
                    <JournalEntriesPage />
                </div>
            )}

            {activeTab === 'receipts' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <Card className="bg-slate-900/40 border-white/5 overflow-hidden">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-[#141414]">
                            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center"><FileText size={16} className="mr-2 text-teal-500" /> Pending & Recent Receipts</h3>
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" className="text-xs text-slate-400"><Filter size={14} className="mr-1" /> Filter</Button>
                            </div>
                        </div>
                        <div className="divide-y divide-white/5">
                            {receipts.length === 0 ? (
                                <div className="p-12 text-center text-slate-500 text-sm">No receipts found. Upload your first receipt to start tracking.</div>
                            ) : (
                                receipts.map(receipt => (
                                    <div key={receipt.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-all">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${receipt.status === 'paid' ? 'bg-teal-500/10 text-teal-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                <Receipt size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-black text-white truncate">{receipt.description}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{new Date(receipt.receiptDate).toLocaleDateString()}</span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-800" />
                                                    <span className={`text-[10px] font-black uppercase tracking-widest ${receipt.status === 'paid' ? 'text-teal-500' : 'text-amber-500'}`}>{receipt.status}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                            <div className="text-right">
                                                <p className="text-lg font-black text-white">${receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            {receipt.status === 'pending' && (
                                                <Button size="sm" onClick={() => handleMarkPaid(receipt.id)} className="bg-teal-600/20 text-teal-500 hover:bg-teal-600 hover:text-white border border-teal-500/30">Mark Paid</Button>
                                            )}
                                            {receipt.status === 'paid' && (
                                                <div className="text-teal-500 flex items-center gap-1 text-xs font-black uppercase"><CheckCircle2 size={14} /> Recorded</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            )}

            <JournalEntryModal isOpen={isManualEntryOpen} onClose={() => setIsManualEntryOpen(false)} accounts={accounts} onSuccess={() => setLoading(true)} />
            <ReceiptUploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onSuccess={handleReceiptSuccess} accounts={accounts} />
            <ReceiptGeneratorModal isOpen={isReceiptGeneratorOpen} onClose={() => setIsReceiptGeneratorOpen(false)} />

            {/* Mobile Action Bar */}
            {isMobile && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-white/5 z-40 flex gap-2 native-bottom-bar">
                    <button onClick={() => setIsUploadOpen(true)} className="flex-1 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white text-xs font-black uppercase tracking-widest"><Upload size={18} className="mr-2" /> Upload</button>
                    <button onClick={() => setIsReceiptGeneratorOpen(true)} className="flex-1 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white text-xs font-black uppercase tracking-widest"><FileText size={18} className="mr-2" /> Receipt</button>
                </div>
            )}
        </div>
    );
}
