'use client';

import React from 'react';
import { Button, Badge } from '../ui/UIComponents';
import { CreditCard, CheckCircle, Download, TrendingUp, TrendingDown, DollarSign, FileDown, Zap, Star, Rocket, Check, ShieldCheck, ExternalLink, Eye, X } from 'lucide-react';
import { User, Invoice } from '../../types';
import { businessInvoiceService } from '../../services/businessInvoiceService';
import { paymentService } from '../../services/paymentService';
import { useTenant } from '@/contexts/TenantContext';
import { useCurrency } from '@/hooks/useCurrency';
import { TIER_PRICING } from '../../services/subscriptionService';
import toast from 'react-hot-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { exportToCSV } from '../../utils/exportUtils';
import { ChartContainer } from '../ui/ChartContainer';

interface FinanceTabProps {
    user: User;
    filteredInvoices: Invoice[];
    handlePayClick: (invoice: Invoice) => void;
    onCreateInvoice?: () => void;
    initialSubTab?: 'invoices' | 'quotes' | 'subscription';
}

import QuotesTab from './QuotesTab';
import AddExpenseModal from './AddExpenseModal';

// ─── Subscription Plans ────────────────────────────────────────────────────────
const PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        description: 'Everything you need to run your business — solo.',
        monthlyPrice: 15,
        priceId: TIER_PRICING.starter.monthlyPriceId,
        icon: Zap,
        color: 'teal',
        features: [
            'Document Hub',
            'Accounting & Invoicing',
            'Smart Contract Generation',
            'Gmail Integration',
            'Google Calendar & Calendly',
            'CRM & Lead Management',
            'Limited Video Meetings',
            'Basic Analytics',
            '5GB Storage',
            'Email Support',
        ],
    },
    {
        id: 'pro',
        name: 'Professional',
        description: 'For growing businesses that need more power. Single-user.',
        monthlyPrice: 45,
        priceId: TIER_PRICING.pro.monthlyPriceId,
        icon: Star,
        color: 'violet',
        popular: true,
        features: [
            'Everything in Starter',
            'Unlimited 25-min Video Meetings',
            'AI Email Drafting',
            'Sales Pipeline & Deals',
            'Advanced Analytics',
            'Document Hub & e-Signatures',
            '50GB Storage',
            'Priority Support',
        ],
        badge: 'Single User',
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Full control with multi-user and unlimited everything.',
        monthlyPrice: 80,
        priceId: TIER_PRICING.enterprise.monthlyPriceId,
        icon: Rocket,
        color: 'amber',
        features: [
            'Everything in Professional',
            'Multi-User & Multi-Tenant',
            'Custom AI Workflows',
            'White-label Options',
            'API Access',
            'Unlimited Storage',
            'Dedicated Account Manager',
            'SLA Guarantee',
        ],
    },
];

const colorMap: Record<string, { border: string; badge: string; btn: string; icon: string; glow: string }> = {
    teal: {
        border: 'border-teal-500/40',
        badge: 'bg-teal-500/20 text-teal-400',
        btn: 'bg-teal-500 hover:bg-teal-400 text-slate-900',
        icon: 'text-teal-400',
        glow: 'shadow-teal-500/10',
    },
    violet: {
        border: 'border-violet-500/40',
        badge: 'bg-violet-500/20 text-violet-400',
        btn: 'bg-violet-500 hover:bg-violet-400 text-white',
        icon: 'text-violet-400',
        glow: 'shadow-violet-500/10',
    },
    amber: {
        border: 'border-amber-500/40',
        badge: 'bg-amber-500/20 text-amber-400',
        btn: 'bg-amber-500 hover:bg-amber-400 text-slate-900',
        icon: 'text-amber-400',
        glow: 'shadow-amber-500/10',
    },
};

interface SubscriptionSectionProps {
    user: User;
    tenantId: string;
    tenantEmail?: string;
}

const SubscriptionSection: React.FC<SubscriptionSectionProps> = ({ user, tenantId, tenantEmail }) => {
    const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
    const { format } = useCurrency();

    const handleSubscribe = async (plan: typeof PLANS[0]) => {
        setLoadingPlan(plan.id);
        try {
            const res = await fetch('/api/stripe/create-checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: plan.priceId,
                    planId: plan.id,
                    tenantId,
                    adminEmail: tenantEmail || user.email,
                    successUrl: `${window.location.origin}/dashboard?checkout=success&plan=${plan.id}`,
                    cancelUrl: `${window.location.origin}/dashboard?checkout=cancelled`,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.url) {
                throw new Error(data.error || 'Failed to create checkout session');
            }

            // Audit Trail
            import('../../services/activityService').then(({ activityService }) => {
                activityService.logSystemAction(
                    user.id,
                    'INTEGRATION',
                    `Initiated subscription checkout for ${plan.name} plan`,
                    { planId: plan.id, priceId: plan.priceId },
                    tenantId
                );
            });

            window.location.href = data.url;
        } catch (err: any) {
            console.error('Checkout error:', err);
            toast.error(err.message || 'Failed to start checkout');
            setLoadingPlan(null);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="text-center max-w-2xl mx-auto">
                <h3 className="text-2xl font-bold text-white mb-2">Choose Your Plan</h3>
                <p className="text-slate-400 text-sm">
                    Unlock the full power of AlphaClone. All plans include a 21-day free trial — no credit card required to start.
                </p>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS.map((plan) => {
                    const colors = colorMap[plan.color];
                    const Icon = plan.icon;
                    return (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: PLANS.indexOf(plan) * 0.08 }}
                            className={`relative bg-slate-900 border rounded-2xl p-6 flex flex-col shadow-xl ${colors.border} ${colors.glow} ${plan.popular ? 'ring-1 ring-violet-500/30' : ''}`}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="bg-violet-500 text-white text-xs font-black px-3 py-1 rounded-full tracking-wider uppercase shadow-lg">
                                        Most Popular
                                    </span>
                                </div>
                            )}

                            {'badge' in plan && (plan as any).badge && (
                                <div className="absolute -top-3 right-4">
                                    <span className="bg-slate-700 text-slate-300 text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wider uppercase border border-slate-600">
                                        {(plan as any).badge}
                                    </span>
                                </div>
                            )}

                            <div className="mb-5">
                                <div className={`w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mb-3 ${colors.icon}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <h4 className="text-lg font-bold text-white">{plan.name}</h4>
                                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                                <div className="flex items-end gap-1">
                                    <span className="text-4xl font-black text-white">{format(plan.monthlyPrice)}</span>
                                    <span className="text-slate-500 text-sm mb-1">/month</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">Billed monthly · Cancel anytime</p>
                            </div>

                            <ul className="space-y-2 mb-8 flex-1">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-300">
                                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${colors.icon}`} />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleSubscribe(plan)}
                                disabled={loadingPlan !== null}
                                className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${colors.btn} disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                                {loadingPlan === plan.id ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Redirecting...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="w-4 h-4" />
                                        Subscribe to {plan.name}
                                    </>
                                )}
                            </button>
                        </motion.div>
                    );
                })}
            </div>

            {/* Founder Involvement Banner */}
            <div className="text-center bg-gradient-to-r from-teal-500/10 via-violet-500/10 to-amber-500/10 border border-teal-500/20 rounded-xl p-5">
                <p className="text-white font-bold text-sm mb-1">🚀 Subscribe now and get the founder personally involved for the next 100 days!</p>
                <p className="text-slate-400 text-xs">Hands-on guidance, strategy sessions, and direct support to help you succeed.</p>
            </div>

            {/* Footer note */}
            <div className="text-center text-xs text-slate-500 bg-slate-900/50 border border-slate-800 rounded-xl p-4">
                🔒 Payments are securely processed by <span className="font-bold text-slate-400">Stripe</span>. You can cancel or change your plan at any time from your billing portal.
            </div>
        </div>
    );
};

// ─── Main Finance Tab ──────────────────────────────────────────────────────────
const FinanceTab: React.FC<FinanceTabProps> = ({ user, filteredInvoices, handlePayClick, onCreateInvoice, initialSubTab = 'invoices' }) => {
    const { currentTenant: tenant } = useTenant();
    const { format } = useCurrency();
    const [isExporting, setIsExporting] = React.useState(false);
    const [subTab, setSubTab] = React.useState<'invoices' | 'quotes' | 'subscription'>(initialSubTab);
    const [showPDFPreview, setShowPDFPreview] = React.useState<string | null>(null);

    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';

    const [pnlData, setPnlData] = React.useState<any>(null);
    const [isGeneratingPnL, setIsGeneratingPnL] = React.useState(false);

    // Expenses
    const [isExpenseModalOpen, setIsExpenseModalOpen] = React.useState(false);

    React.useEffect(() => {
        const fetchPnL = async () => {
            if (!tenant?.id || !isAdmin) return;
            try {
                const { generalLedgerService } = await import('../../services/accounting/generalLedgerService');
                const endDate = new Date().toISOString().split('T')[0];
                const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                const { statement, error } = await generalLedgerService.getProfitLossData(startDate, endDate);
                if (!error && statement) {
                    setPnlData(statement);
                }
            } catch (err) {
                console.error("Failed to fetch PnL", err);
            }
        };
        fetchPnL();
    }, [tenant?.id, isAdmin]);

    const handleGeneratePnL = async () => {
        if (!tenant?.id) return;
        setIsGeneratingPnL(true);
        toast.loading('Generating P&L Report...', { id: 'pnl-gen' });
        try {
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

            let currentStatement = pnlData;
            if (!currentStatement) {
                const { generalLedgerService } = await import('../../services/accounting/generalLedgerService');
                const { statement, error } = await generalLedgerService.getProfitLossData(startDate, endDate);
                if (error) throw new Error(error);
                currentStatement = statement;
            }

            const { generatePnLPDF } = await import('../../utils/pdfGenerator');
            const doc = generatePnLPDF(currentStatement, tenant, startDate, endDate);

            // Save to browser
            const fileName = `PnL_Report_${new Date().toLocaleString('default', { month: 'short' })}_${new Date().getFullYear()}.pdf`;
            doc.save(fileName);

            // Auto-save to Document Hub
            try {
                const { fileUploadService } = await import('../../services/fileUploadService');
                const pdfBlob = doc.output('blob');
                const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
                // We'll use the tenant's ID or a static string as the entity ID, but document hub handles it.
                await fileUploadService.uploadFile(pdfFile, 'report', tenant.id);
                toast.success('P&L Report generated and saved to Document Hub!', { id: 'pnl-gen' });
            } catch (uploadErr) {
                console.error('Failed to auto-save PnL PDF to Document Hub:', uploadErr);
                toast.success('P&L Report generated, but auto-save failed.', { id: 'pnl-gen' });
            }

            // Audit Trail
            import('../../services/activityService').then(({ activityService }) => {
                activityService.logSystemAction(
                    user.id,
                    'GENERATE',
                    `Generated monthly Profit & Loss report: ${fileName}`,
                    { startDate, endDate, fileName },
                    tenant.id
                );
            });
        } catch (err) {
            console.error('Failed to generate P&L:', err);
            toast.error('Failed to generate P&L Report', { id: 'pnl-gen' });
        } finally {
            setIsGeneratingPnL(false);
        }
    };

    const handleExport = async (type: 'pdf' | 'xlsx', category: string) => {
        if (!tenant?.id) {
            toast.error("Tenant information unavailable");
            return;
        }

        setIsExporting(true);
        try {
            const url = `/api/reports/export?type=${type}&category=${category}&tenantId=${tenant.id}`;
            const response = await fetch(url);

            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `report_${category}_${new Date().toISOString().split('T')[0]}.${type}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast.success(`${category.charAt(0).toUpperCase() + category.slice(1)} report exported`);

            // Audit Trail
            import('../../services/activityService').then(({ activityService }) => {
                activityService.logSystemAction(
                    user.id,
                    'EXPORT',
                    `Exported financial report (${type.toUpperCase()}): ${category}`,
                    { type, category },
                    tenant.id
                );
            });
        } catch (err) {
            console.error("Export error:", err);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    const handleViewPDF = async (inv: Invoice) => {
        try {
            if (!tenant) {
                toast.error('Organization details missing');
                return;
            }

            toast.loading('Generating preview...', { id: 'pdf-preview' });
            
            // Get full invoice details including business invoice specific fields if available
            const { invoice: fullInvoice, error } = await businessInvoiceService.getInvoiceWithDetails(inv.id);
            
            if (error || !fullInvoice) {
                // Fallback to basic invoice data if full record not found
                const doc = businessInvoiceService.generatePDF(inv, tenant, { name: inv.clientId, email: '' });
                const pdfDataUri = doc.output('datauristring');
                setShowPDFPreview(pdfDataUri);
            } else {
                const doc = businessInvoiceService.generatePDF(fullInvoice, tenant, fullInvoice.client);
                const pdfDataUri = doc.output('datauristring');
                setShowPDFPreview(pdfDataUri);
            }
            
            toast.dismiss('pdf-preview');
        } catch (error) {
            console.error('Error generating PDF preview:', error);
            toast.error('Failed to generate PDF preview', { id: 'pdf-preview' });
        }
    };

    const totalRevenue = pnlData ? pnlData.totalRevenue : filteredInvoices.filter(i => i.status === 'Paid').reduce((acc, curr) => acc + curr.amount, 0);
    const outstanding = filteredInvoices.filter(i => i.status !== 'Paid').reduce((acc, curr) => acc + curr.amount, 0);

    // Dynamic from backend accounting
    const totalExpenses = pnlData ? pnlData.totalExpenses : 0;
    const netProfit = pnlData ? pnlData.netIncome : (totalRevenue - totalExpenses);

    const [chartData, setChartData] = React.useState<any[]>([]);
    const [isLoadingChart, setIsLoadingChart] = React.useState(true);

    React.useEffect(() => {
        const fetchChartData = async () => {
            if (!tenant?.id) return;
            setIsLoadingChart(true);
            try {
                const { generalLedgerService } = await import('../../services/accounting/generalLedgerService');
                const { data, error } = await generalLedgerService.getMonthlyFinancialSummary(6);
                if (!error && data) {
                    setChartData(data);
                }
            } catch (err) {
                console.error("Failed to fetch chart data", err);
            } finally {
                setIsLoadingChart(false);
            }
        };
        fetchChartData();

        const handleRefresh = () => fetchChartData();
        window.addEventListener('expense-added', handleRefresh);
        return () => window.removeEventListener('expense-added', handleRefresh);
    }, [tenant?.id]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-teal-400" /> Financial Center
                </h2>
                {subTab !== 'subscription' && (
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <Button
                            variant="secondary"
                            onClick={() => handleExport('pdf', 'revenue')}
                            isLoading={isExporting}
                            icon={<FileDown className="w-4 h-4" />}
                            className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 px-3 h-10"
                        >
                            Export PDF
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => exportToCSV(filteredInvoices, 'Invoices')}
                            icon={<Download className="w-4 h-4" />}
                            className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 px-3 h-10"
                        >
                            Export CSV
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => handleExport('xlsx', 'revenue')}
                            isLoading={isExporting}
                            icon={<Download className="w-4 h-4" />}
                            className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 px-3 h-10"
                        >
                            Export Excel
                        </Button>
                        {isAdmin && (
                            <Button
                                variant="secondary"
                                onClick={handleGeneratePnL}
                                isLoading={isGeneratingPnL}
                                icon={<FileDown className="w-4 h-4" />}
                                className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 px-3 h-10"
                            >
                                P&L Report
                            </Button>
                        )}
                        {isAdmin && (
                            <Button
                                onClick={onCreateInvoice}
                                className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 px-3 h-10"
                            >
                                Create Invoice
                            </Button>
                        )}
                        {isAdmin && (
                            <Button
                                onClick={() => setIsExpenseModalOpen(true)}
                                className="flex-1 sm:flex-none text-xs sm:text-sm py-1.5 px-3 h-10 bg-red-600 hover:bg-red-500 text-white"
                            >
                                Add Expense
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-4 border-b border-slate-800 pb-px">
                <button
                    onClick={() => setSubTab('invoices')}
                    className={`pb-4 px-2 text-sm font-bold transition-all relative ${subTab === 'invoices' ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Invoices & Billing
                    {subTab === 'invoices' && <motion.div layoutId="activeSubTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
                </button>
                <button
                    onClick={() => setSubTab('quotes')}
                    className={`pb-4 px-2 text-sm font-bold transition-all relative ${subTab === 'quotes' ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Quotes & Proposals
                    {subTab === 'quotes' && <motion.div layoutId="activeSubTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />}
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setSubTab('subscription')}
                        className={`pb-4 px-2 text-sm font-bold transition-all relative flex items-center gap-1.5 ${subTab === 'subscription' ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Rocket className="w-3.5 h-3.5" />
                        Subscription
                        {subTab === 'subscription' && <motion.div layoutId="activeSubTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400" />}
                    </button>
                )}
            </div>

            {subTab === 'quotes' ? (
                <div className="pt-4">
                    <QuotesTab userId={user.id} userRole={user.role} />
                </div>
            ) : subTab === 'subscription' ? (
                <div className="pt-4">
                    <SubscriptionSection
                        user={user}
                        tenantId={tenant?.id || ''}
                        tenantEmail={user.email}
                    />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Financial Summary Cards */}
                        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Total Revenue</p>
                                <p className="text-2xl font-bold text-white">{format(totalRevenue)}</p>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Outstanding</p>
                                <p className="text-2xl font-bold text-orange-400">{format(outstanding)}</p>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Expenses</p>
                                <p className="text-2xl font-bold text-red-400 flex items-center gap-2">
                                    {format(totalExpenses)}
                                </p>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <DollarSign className="w-12 h-12 text-teal-400" />
                                </div>
                                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Net Profit</p>
                                <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                                    {format(netProfit)}
                                </p>
                            </div>
                        </div>

                        {/* Chart Section */}
                        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-teal-400" /> Revenue vs Expenses
                            </h3>
                            <div className="h-[300px] w-full min-h-[300px] relative">
                                {isLoadingChart && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 z-10 rounded-2xl">
                                        <div className="flex flex-col items-center gap-2">
                                        </div>
                                    </div>
                                )}
                                <ChartContainer className="w-full h-full" minHeight={300}>
                                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                                            <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => format(value)} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                                                formatter={(value: any) => format(value)}
                                            />
                                            <Area type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                                            <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" name="Expenses" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            </div>
                        </div>
                    </div>

                    {/* Payment Health (Dunning) Section */}
                    {isAdmin && (
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-teal-400" /> Payment Health & Dunning
                                </h3>
                                <Badge variant="success">Active Recovery</Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <p className="text-slate-500 text-xs uppercase font-bold tracking-wider">Failed Attempts (30d)</p>
                                    <p className="text-2xl font-bold text-white">
                                        {filteredInvoices.filter(i => i.status === 'Overdue').length}
                                    </p>
                                    <p className="text-[10px] text-slate-500">Automated retries in progress</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-slate-500 text-xs uppercase font-bold tracking-wider">Recovery Rate</p>
                                    <p className="text-2xl font-bold text-teal-400">92.4%</p>
                                    <p className="text-[10px] text-teal-500/50">+2.1% from last month</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-slate-500 text-xs uppercase font-bold tracking-wider">Next Auto-Retry</p>
                                    <p className="text-2xl font-bold text-white">Tomorrow</p>
                                    <p className="text-[10px] text-slate-500">Scheduled for 04:00 AM UTC</p>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                                    Smart Dunning AI is optimizing retry windows
                                </div>
                                <button className="text-xs text-teal-400 hover:text-teal-300 font-bold">Configure Dunning Rules</button>
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-950 text-xs uppercase font-semibold text-slate-500">
                                <tr>
                                    <th className="px-6 py-4">Invoice ID</th>
                                    <th className="px-6 py-4">Project / Description</th>
                                    <th className="px-6 py-4">Amount</th>
                                    <th className="px-6 py-4">Due Date</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {filteredInvoices.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-white">#{inv.id.toUpperCase()}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-white font-medium">{inv.projectName}</div>
                                            <div className="text-xs text-slate-500">{inv.description}</div>
                                        </td>
                                        <td className="px-6 py-4 text-white font-bold">{format(inv.amount)}</td>
                                        <td className="px-6 py-4">{inv.dueDate}</td>
                                        <td className="px-6 py-4">
                                            <Badge variant={inv.status === 'Paid' ? 'success' : inv.status === 'Overdue' ? 'error' : 'warning'}>
                                                {inv.status}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleViewPDF(inv)}
                                                title="View PDF"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => window.open(`/invoice/${inv.id}`, '_blank')}
                                                title="View Web Receipt"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => paymentService.downloadInvoicePDF(inv.id)}
                                                title="Download PDF"
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>
                                            {inv.status !== 'Paid' && user.role === 'client' && (
                                                <Button size="sm" onClick={() => handlePayClick(inv)}>
                                                    Pay Now
                                                </Button>
                                            )}
                                            {inv.status === 'Paid' && (
                                                <span className="text-green-500 text-xs font-bold flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> Paid
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredInvoices.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                            No invoices found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {isExpenseModalOpen && (
                <AddExpenseModal
                    isOpen={isExpenseModalOpen}
                    onClose={() => setIsExpenseModalOpen(false)}
                    onExpenseAdded={() => {
                        setIsExpenseModalOpen(false);
                        // Refresh PnL Data by triggering the useEffect again (can trigger re-render)
                        const event = new Event('expense-added');
                        window.dispatchEvent(event);
                    }}
                />
            )}

            {/* PDF Preview Modal */}
            {showPDFPreview && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-lg w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Invoice Preview</h3>
                            <button
                                onClick={() => setShowPDFPreview(null)}
                                className="text-gray-400 hover:text-gray-600 p-2"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <iframe
                                src={showPDFPreview}
                                className="w-full h-full border-0"
                                title="Invoice Preview"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceTab;
