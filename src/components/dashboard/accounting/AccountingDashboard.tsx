'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '../../../contexts/TenantContext';
import { Card, Button } from '../../ui/UIComponents';
import { 
    DollarSign, ArrowUpRight, ArrowDownRight, FileText, Activity, Upload, 
    CheckCircle2, Calendar, ShieldCheck, ChevronDown, TrendingUp, Wallet, 
    ArrowRight, Clock, Plus, Filter, MoreHorizontal
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import ReceiptUploadModal from './ReceiptUploadModal';
import { journalEntryService } from '../../../services/accounting/journalEntryService';
import { chartOfAccountsService, ChartOfAccount } from '../../../services/accounting/chartOfAccountsService';
import toast from 'react-hot-toast';
import { JournalEntryModal } from './JournalEntryModal';
import ReceiptGeneratorModal from './ReceiptGeneratorModal';
import { generalLedgerService } from '../../../services/accounting/generalLedgerService';
import { advancedAccountingService } from '../../../services/accounting/advancedAccountingService';
import { useBreakpoint } from '@/hooks/useBreakpoint';

type Period = 'week' | 'month' | 'quarter' | 'year';

export default function AccountingDashboard() {
    const { currentTenant } = useTenant();
    const { isMobile, isTablet, isDesktop } = useBreakpoint();
    
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'balance'>('overview');
    const [period, setPeriod] = useState<Period>('month');
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
    const [isReceiptGeneratorOpen, setIsReceiptGeneratorOpen] = useState(false);
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
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

                const { data: pendingInvoices } = await supabase
                    .from('business_invoices')
                    .select('total')
                    .eq('tenant_id', currentTenant.id)
                    .in('status', ['draft', 'sent', 'overdue']);

                const pending = (pendingInvoices || []).reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
                // User wants to see ALL revenue including pending
                const revenue = (statement?.totalRevenue || 0) + pending;
                const totalExp = statement?.totalExpenses || 0;

                const cashBalance = (trialBalance?.accounts || [])
                    .filter(a => a.accountType === 'asset' && (a.accountCode?.startsWith('10') || a.accountName.toLowerCase().includes('cash')))
                    .reduce((sum, a) => sum + (a.debitBalance - a.creditBalance), 0);

                const { data: entries } = await supabase
                    .from('journal_entries')
                    .select('*, journal_entry_lines(*)')
                    .eq('tenant_id', currentTenant.id)
                    .order('entry_date', { ascending: false })
                    .limit(10);

                const simpleTransactions = (entries || []).map((entry: any) => {
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
                    setAccounts(fetchedAccounts || []);
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

    const handleReceiptSuccess = async (extractedData: any) => {
        setIsUploadOpen(false);
        const loadToast = toast.loading('Logging expense...');
        try {
            const { error } = await journalEntryService.createEntry({
                entryDate: extractedData.date,
                description: `Receipt: ${extractedData.description}`,
                reference: 'AI-VISION',
                lines: [
                    { accountId: accounts[0].id, debitAmount: extractedData.amount, creditAmount: 0, description: extractedData.description },
                    { accountId: accounts[1].id, debitAmount: 0, creditAmount: extractedData.amount, description: 'Cash Out' }
                ]
            });
            if (error) throw new Error(error);
            toast.success('Logged!', { id: loadToast });
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
        <div className={`space-y-6 max-w-7xl mx-auto pb-24 ${isMobile ? 'px-2' : 'px-6'}`}>
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
                {(['overview', 'income', 'balance'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-4 text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all border-b-2 ${activeTab === tab ? 'border-teal-500 text-white bg-teal-500/5' : 'border-transparent text-gray-500'}`}
                    >
                        {tab === 'overview' ? 'Overview' : tab === 'income' ? 'Income' : 'Balance'}
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

            {activeTab === 'balance' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
                    <Card className="p-6 bg-slate-900/60 border-white/5">
                        <div className="text-xs font-black text-teal-500 uppercase tracking-widest mb-6 border-b border-teal-500/20 pb-2">Assets</div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center"><span className="text-sm font-bold text-gray-400">Cash & Equivalents</span><span className="text-sm font-black text-white">${stats.cashBalance.toLocaleString()}</span></div>
                            <div className="flex justify-between items-center"><span className="text-sm font-bold text-gray-400">Accounts Receivable</span><span className="text-sm font-black text-white">${stats.pendingInvoices.toLocaleString()}</span></div>
                        </div>
                        <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center"><span className="text-xs font-black uppercase text-teal-500">Total Assets</span><span className="text-xl font-black text-white">${(stats.cashBalance + stats.pendingInvoices).toLocaleString()}</span></div>
                    </Card>
                    <Card className="p-6 bg-slate-900/60 border-white/5">
                        <div className="text-xs font-black text-rose-500 uppercase tracking-widest mb-6 border-b border-rose-500/20 pb-2">Liabilities & Equity</div>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center"><span className="text-sm font-bold text-gray-400">Accounts Payable</span><span className="text-sm font-black text-white">$0.00</span></div>
                            <div className="flex justify-between items-center"><span className="text-sm font-bold text-gray-400">Retained Earnings</span><span className="text-sm font-black text-white">${(stats.totalRevenue - stats.totalExpenses).toLocaleString()}</span></div>
                        </div>
                        <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center"><span className="text-xs font-black uppercase text-rose-500">Total L & E</span><span className="text-xl font-black text-white">${(stats.totalRevenue - stats.totalExpenses).toLocaleString()}</span></div>
                    </Card>
                </div>
            )}

            <JournalEntryModal isOpen={isManualEntryOpen} onClose={() => setIsManualEntryOpen(false)} accounts={accounts} onSuccess={() => setLoading(true)} />
            <ReceiptUploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onSuccess={handleReceiptSuccess} />
            <ReceiptGeneratorModal isOpen={isReceiptGeneratorOpen} onClose={() => setIsReceiptGeneratorOpen(false)} />

            {/* Mobile Action Bar */}
            {isMobile && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-xl border-t border-white/5 z-50 flex gap-2">
                    <button onClick={() => setIsUploadOpen(true)} className="flex-1 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white text-xs font-black uppercase tracking-widest"><Upload size={18} className="mr-2" /> Upload</button>
                    <button onClick={() => setIsReceiptGeneratorOpen(true)} className="flex-1 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white text-xs font-black uppercase tracking-widest"><FileText size={18} className="mr-2" /> Receipt</button>
                </div>
            )}
        </div>
    );
}

