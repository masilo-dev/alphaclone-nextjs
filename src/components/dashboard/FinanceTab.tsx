'use client';

import React from 'react';
import { Button, Badge } from '../ui/UIComponents';
import { CreditCard, CheckCircle, Download, TrendingUp, TrendingDown, DollarSign, FileDown, Zap, Star, Rocket, Check } from 'lucide-react';
import { User, Invoice } from '../../types';
import { paymentService } from '../../services/paymentService';
import { useTenant } from '@/contexts/TenantContext';
import { TIER_PRICING } from '../../services/subscriptionService';
import toast from 'react-hot-toast';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

interface FinanceTabProps {
    user: User;
    filteredInvoices: Invoice[];
    handlePayClick: (invoice: Invoice) => void;
    onCreateInvoice?: () => void;
    initialSubTab?: 'invoices' | 'quotes' | 'subscription';
}

import QuotesTab from './QuotesTab';

// ─── Subscription Plans ────────────────────────────────────────────────────────
const PLANS = [
    {
        id: 'starter',
        name: 'Basic',
        description: 'Perfect for solo operators and small teams getting started.',
        monthlyPrice: 15,
        priceId: TIER_PRICING.starter.monthlyPriceId,
        icon: Zap,
        color: 'teal',
        features: [
            'Up to 5 team members',
            'CRM & Lead Management',
            'Gmail Integration',
            'Invoicing & Quotes',
            'Basic Analytics',
            '5GB Storage',
            'Email Support',
        ],
    },
    {
        id: 'pro',
        name: 'Professional',
        description: 'For growing businesses that need more power and automation.',
        monthlyPrice: 45,
        priceId: TIER_PRICING.pro.monthlyPriceId,
        icon: Star,
        color: 'violet',
        popular: true,
        features: [
            'Up to 20 team members',
            'Everything in Basic',
            'AI Email Drafting',
            'Sales Pipeline & Deals',
            'Advanced Analytics',
            'Document Hub & e-Signatures',
            '50GB Storage',
            'Priority Support',
        ],
    },
    {
        id: 'enterprise',
        name: 'Unlimited',
        description: 'For established businesses with no limits and full control.',
        monthlyPrice: 80,
        priceId: TIER_PRICING.enterprise.monthlyPriceId,
        icon: Rocket,
        color: 'amber',
        features: [
            'Unlimited team members',
            'Everything in Professional',
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

                            <div className="mb-5">
                                <div className={`w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center mb-3 ${colors.icon}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <h4 className="text-lg font-bold text-white">{plan.name}</h4>
                                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{plan.description}</p>
                            </div>

                            <div className="mb-6">
                                <div className="flex items-end gap-1">
                                    <span className="text-4xl font-black text-white">${plan.monthlyPrice}</span>
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
    const [isExporting, setIsExporting] = React.useState(false);
    const [subTab, setSubTab] = React.useState<'invoices' | 'quotes' | 'subscription'>(initialSubTab);

    const isAdmin = user.role === 'admin' || user.role === 'tenant_admin';

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
        } catch (err) {
            console.error("Export error:", err);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    const totalRevenue = filteredInvoices.filter(i => i.status === 'Paid').reduce((acc, curr) => acc + curr.amount, 0);
    const outstanding = filteredInvoices.filter(i => i.status !== 'Paid').reduce((acc, curr) => acc + curr.amount, 0);

    // Mock Expenses for MVP Polish
    const totalExpenses = 4500;
    const netProfit = totalRevenue - totalExpenses;

    // Prepare Chart Data
    const chartData = React.useMemo(() => {
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return d.toLocaleString('default', { month: 'short' });
        }).reverse();

        return last6Months.map(month => ({
            name: month,
            revenue: Math.floor(Math.random() * 5000) + 1000 + (totalRevenue / 12),
            expenses: Math.floor(Math.random() * 2000) + 500
        }));
    }, [totalRevenue]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-teal-400" /> Financial Center
                </h2>
                {subTab !== 'subscription' && (
                    <div className="flex gap-2">
                        <Button
                            variant="secondary"
                            onClick={() => handleExport('pdf', 'revenue')}
                            isLoading={isExporting}
                            icon={<FileDown className="w-4 h-4" />}
                        >
                            Export PDF
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => handleExport('xlsx', 'revenue')}
                            isLoading={isExporting}
                            icon={<Download className="w-4 h-4" />}
                        >
                            Export Excel
                        </Button>
                        {isAdmin && <Button onClick={onCreateInvoice}>Create Invoice</Button>}
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
                                <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Outstanding</p>
                                <p className="text-2xl font-bold text-orange-400">${outstanding.toLocaleString()}</p>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Expenses (Est)</p>
                                <p className="text-2xl font-bold text-red-400 flex items-center gap-2">
                                    ${totalExpenses.toLocaleString()}
                                    <span className="text-xs text-slate-500 font-normal bg-slate-800 px-1.5 py-0.5 rounded">Placeholder</span>
                                </p>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <DollarSign className="w-12 h-12 text-teal-400" />
                                </div>
                                <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Net Profit</p>
                                <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                                    ${netProfit.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* Chart Section */}
                        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-teal-400" /> Revenue vs Expenses
                            </h3>
                            <div className="h-[300px] w-full min-h-[300px]">
                                <ResponsiveContainer width="100%" height={300} minWidth={0} debounce={50}>
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
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                                            itemStyle={{ color: '#e2e8f0' }}
                                        />
                                        <Area type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                                        <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" name="Expenses" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

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
                                        <td className="px-6 py-4 text-white font-bold">${inv.amount.toLocaleString()}</td>
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
        </div>
    );
};

export default FinanceTab;
