'use client';

import React, { useState, useEffect } from 'react';
import { useBonnieDeepLinkFocus } from '@/hooks/useBonnieDeepLinkFocus';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
    DollarSign, FileText, Download, Eye, Send, Mail, CheckCircle, Clock, 
    AlertCircle, Filter, Plus, Edit, Trash2, RefreshCw, User, Calendar, 
    Search, X, ChevronDown, FileCheck2, ArrowLeft, MoreVertical, CheckSquare, Square, TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenant } from '../../../contexts/TenantContext';
import { businessInvoiceService, BusinessInvoice } from '../../../services/businessInvoiceService';
import { businessClientService } from '../../../services/businessClientService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import EnhancedInvoiceModal from '../EnhancedInvoiceModal';
import { Button, Card, Input, Modal } from '../../ui/UIComponents';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { CommunicationModal } from '../crm/CommunicationModal';
import type { EmailRecipient } from '../crm/emailRecipient';
import { OperationalWorkflowStrip } from '../OperationalWorkflowStrip';
import RecurringInvoicesPanel from '../invoicing/RecurringInvoicesPanel';
import { buildMailComposeUrl } from '@/lib/email/composeNavigation';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InvoiceLifecycleDrawer } from '@/components/dashboard/invoicing/InvoiceLifecycleDrawer';
import { InvoiceAgingReport } from '../invoicing/InvoiceAgingReport';
import { OverdueReminderPanel } from '../invoicing/OverdueReminderPanel';
import { ExecutionDecisionGuide } from '@/components/dashboard/ExecutionDecisionGuide';
import { BILLING_MANAGER_EXECUTION_STEPS } from '@/lib/ui/dashboardExecutionSteps';
import {
    IntelligentKpiCard,
    BonnieBrief,
    BottleneckDetector,
} from '@/components/ui/intelligence';
import { WORKSPACE } from '@/constants/design';
import { type SemanticSeverity, getSemanticStyles } from '@/lib/analytics/funnelAndPriority';
import { semanticStatusStyle } from '@/lib/ui/statusSemantics';

interface EnhancedBillingPageProps {
    user: any;
}

const EnhancedBillingPage: React.FC<EnhancedBillingPageProps> = ({ user }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { currentTenant } = useTenant();
    const { isMobile, isTablet, isDesktop } = useBreakpoint();
    const { confirm: confirmDialog } = useConfirmDialog();
    
    const [invoices, setInvoices] = useState<BusinessInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'draft' | 'sent' | 'paid' | 'overdue'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<BusinessInvoice | null>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<BusinessInvoice | null>(null);
    const [showPDFPreview, setShowPDFPreview] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInvoiceForOptions, setSelectedInvoiceForOptions] = useState<BusinessInvoice | null>(null);
    const [isOptionsOpen, setIsOptionsOpen] = useState(false);
    const [revenueData, setRevenueData] = useState<any[]>([]);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        pendingAmount: 0,
        overdueAmount: 0,
        draftCount: 0,
        sentCount: 0,
        paidCount: 0,
        overdueBucket1_15: 0,
        overdueBucket16_30: 0,
        overdueBucket31_60: 0,
        overdueBucket61_plus: 0,
        oldestOverdueDays: 0,
        totalInvoiced: 0,
        sentPrev: 0,
        paidPrev: 0,
        overduePrev: 0,
    });
    const [clientMap, setClientMap] = useState<Record<string, { name: string; email?: string }>>({});
    const [emailCompose, setEmailCompose] = useState<{ recipient: EmailRecipient; subject: string; body?: string } | null>(null);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
    const [bulkDeletingInvoices, setBulkDeletingInvoices] = useState(false);
    const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
    const [recordPaymentInvoice, setRecordPaymentInvoice] = useState<BusinessInvoice | null>(null);
    const [recordPaymentAmount, setRecordPaymentAmount] = useState('');
    const [recordPaymentError, setRecordPaymentError] = useState<string | null>(null);
    const [recordPaymentSubmitting, setRecordPaymentSubmitting] = useState(false);
    const [lifecycleInvoiceId, setLifecycleInvoiceId] = useState<string | null>(null);

    const toggleInvoiceSelection = (inv: BusinessInvoice) => {
        setSelectedInvoiceIds((prev) => {
            const next = new Set(prev);
            if (next.has(inv.id)) next.delete(inv.id);
            else next.add(inv.id);
            return next;
        });
    };

    const handleBulkEmailInvoices = () => {
        if (selectedInvoiceIds.size === 0) return;
        const recipients = invoices
            .filter((inv) => selectedInvoiceIds.has(inv.id))
            .map((inv) => resolveInvoiceRecipient(inv)?.email?.trim() || '')
            .filter((email, index, arr) => email.length > 0 && arr.indexOf(email) === index);

        if (recipients.length === 0) {
            toast.error('Selected invoices do not have client email addresses.');
            return;
        }

        const subject = recipients.length === 1 ? 'Invoice follow-up' : 'Invoices follow-up';
        router.push(buildMailComposeUrl(recipients, subject));
    };

    const handleBulkDeleteInvoices = async () => {
        const ids = [...selectedInvoiceIds];
        if (!ids.length) return;
        const ok = await confirmDialog({
            title: 'Delete draft invoices?',
            description: `Delete ${ids.length} selected invoice(s). Only draft invoices can be deleted; non-drafts will be skipped. This cannot be undone.`,
            confirmLabel: 'Delete drafts',
            variant: 'danger',
        });
        if (!ok) return;

        setBulkDeletingInvoices(true);
        const toastId = toast.loading(`Deleting ${ids.length} invoice(s)...`);
        try {
            const { error, count, skipped } = await businessInvoiceService.bulkDeleteInvoices(ids);
            if (error) throw new Error(error);
            setInvoices((prev) => prev.filter((inv) => !selectedInvoiceIds.has(inv.id)));
            setSelectedInvoiceIds(new Set());
            if (skipped > 0) {
                toast.success(`Deleted ${count} draft(s). ${skipped} non-draft invoice(s) were skipped.`, { id: toastId });
            } else {
                toast.success(`Deleted ${count} invoice(s)`, { id: toastId });
            }
            await loadInvoices();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Bulk delete failed', { id: toastId });
        } finally {
            setBulkDeletingInvoices(false);
        }
    };

    const openRecordPayment = (invoice: BusinessInvoice) => {
        setRecordPaymentInvoice(invoice);
        setRecordPaymentAmount('');
        setRecordPaymentError(null);
        setRecordPaymentSubmitting(false);
        setRecordPaymentOpen(true);
    };

    const closeRecordPayment = () => {
        setRecordPaymentOpen(false);
        setRecordPaymentInvoice(null);
        setRecordPaymentAmount('');
        setRecordPaymentError(null);
        setRecordPaymentSubmitting(false);
    };

    useEffect(() => {
        if (currentTenant?.id) {
            loadInvoices();
            loadClients();
        }
    }, [currentTenant?.id]);

    useEffect(() => {
        if (!searchParams) return;
        if (searchParams.get('create') === 'true' || searchParams.get('new') === 'true') {
            setShowCreateModal(true);
            router.replace('/dashboard/business/billing/manage', { scroll: false });
        }
    }, [searchParams, router]);

    useBonnieDeepLinkFocus({
        onFocus: ({ focus, recordId }) => {
            if (focus === 'overdue') setFilter('overdue');
            if (recordId) {
                const invoice = invoices.find((item) => item.id === recordId);
                if (invoice) {
                    setSelectedInvoiceForOptions(invoice);
                    setIsOptionsOpen(true);
                }
            }
        },
    });

    const loadClients = async () => {
        if (!currentTenant?.id) return;
        const { clients } = await businessClientService.getClients(currentTenant.id);
        if (clients) {
            const map: Record<string, { name: string; email?: string }> = {};
            clients.forEach((c) => {
                map[c.id] = { name: c.name, email: c.email || undefined };
            });
            setClientMap(map);
        }
    };

    const resolveInvoiceRecipient = (inv: BusinessInvoice): EmailRecipient | null => {
        const metadata = businessInvoiceService.parseMetadata(inv.notes);
        const clientInfo = inv.clientId ? clientMap[inv.clientId] : null;
        const email = clientInfo?.email || metadata?.clientEmail || metadata?.email;
        if (!email) return null;
        return {
            id: inv.clientId,
            name: clientInfo?.name || metadata?.clientName || 'Client',
            email,
            description: `Invoice ${inv.invoiceNumber} — ${inv.total.toFixed(2)} due ${inv.dueDate}`,
        };
    };

    const openInvoiceCompose = (inv: BusinessInvoice) => {
        const recipient = resolveInvoiceRecipient(inv);
        if (!recipient) {
            toast.error('No client email on file for this invoice.');
            return;
        }
        setIsOptionsOpen(false);
        setEmailCompose({
            recipient,
            subject: `Invoice ${inv.invoiceNumber} from ${currentTenant?.name || 'AlphaClone'}`,
            body: `Hello ${recipient.name.split(' ')[0]},\n\nPlease find details for invoice ${inv.invoiceNumber} (total ${inv.total.toFixed(2)}, due ${inv.dueDate}).\n\nThank you for your business.`,
        });
    };

    const loadInvoices = async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        const { invoices: data } = await businessInvoiceService.getInvoices(currentTenant.id);
        if (data) {
            setInvoices(data);
            calculateStats(data);
            loadRevenueData(data);
        }
        setLoading(false);
    };

    const calculateStats = (invoiceData: BusinessInvoice[]) => {
        const today = new Date();
        const s = {
            totalRevenue: 0,
            pendingAmount: 0,
            overdueAmount: 0,
            draftCount: 0,
            sentCount: 0,
            paidCount: 0,
            overdueBucket1_15: 0,
            overdueBucket16_30: 0,
            overdueBucket31_60: 0,
            overdueBucket61_plus: 0,
            oldestOverdueDays: 0,
            totalInvoiced: 0,
            sentPrev: 0,
            paidPrev: 0,
            overduePrev: 0,
        };
        invoiceData.forEach(inv => {
            s.totalInvoiced += inv.total;
            if (inv.status === 'paid') {
                s.totalRevenue += inv.total;
                s.paidCount++;
                if (inv.updatedAt && today.getTime() - new Date(inv.updatedAt).getTime() > 30 * 86400000) {
                    s.paidPrev++;
                }
            } else if (inv.status === 'sent') {
                s.pendingAmount += inv.total;
                s.sentCount++;
                const issuedDays = inv.issueDate ? Math.floor((today.getTime() - new Date(inv.issueDate).getTime()) / 86400000) : 0;
                if (issuedDays > 30) s.sentPrev++;
            } else if (inv.status === 'overdue') {
                s.overdueAmount += inv.total;
                const age = inv.dueDate ? Math.max(0, Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000)) : 0;
                if (age > s.oldestOverdueDays) s.oldestOverdueDays = age;
                if (age > 60) s.overdueBucket61_plus += inv.total;
                else if (age > 30) s.overdueBucket31_60 += inv.total;
                else if (age > 15) s.overdueBucket16_30 += inv.total;
                else s.overdueBucket1_15 += inv.total;
                if (age > 45) s.overduePrev++;
            } else if (inv.status === 'draft') s.draftCount++;
        });
        setStats(s);
    };

    const loadRevenueData = (source: BusinessInvoice[]) => {
        const revenueMap: Record<string, number> = {};
        source.forEach(inv => {
            if (inv.status === 'paid') {
                const day = (inv.updatedAt || inv.issueDate || new Date().toISOString()).slice(0, 10);
                revenueMap[day] = (revenueMap[day] || 0) + inv.total;
            }
        });
        const sorted = Object.entries(revenueMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));
        setRevenueData(sorted.length ? sorted : [{ date: 'Today', revenue: 0 }]);
    };

    const [activeTab, setActiveTab] = useState<'invoices' | 'aging' | 'reminders' | 'recurring' | 'services'>('invoices');

    const filteredInvoices = invoices.filter(inv => {
        const matchesFilter = filter === 'all' || inv.status === filter;
        const matchesSearch = searchTerm === '' || inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getStatusStyles = (status: string) => {
        return semanticStatusStyle(status).badge;
    };

    const handleViewPDF = (inv: BusinessInvoice) => {
        if (!currentTenant?.id) return;
        setShowPDFPreview(
          `/api/invoices/${encodeURIComponent(inv.id)}/pdf?tenantId=${encodeURIComponent(currentTenant.id)}`
        );
    };

    const handleDownloadPDF = (inv: BusinessInvoice) => {
        if (!currentTenant?.id) return;
        window.open(
          `/api/invoices/${encodeURIComponent(inv.id)}/pdf?tenantId=${encodeURIComponent(currentTenant.id)}&download=true`,
          '_blank'
        );
    };

    if (loading) {
        return (
            <div className={`space-y-5 pb-24 ${isMobile ? 'p-2' : 'p-6'}`}>
                <div className="ac-workspace-panel rounded-lg p-8 text-center text-slate-400">
                    Loading billing workspace...
                </div>
            </div>
        );
    }

    const ServicesCatalog = React.lazy(() => import('./ServicesCatalog').then(m => ({ default: m.ServicesCatalog })));

    return (
        <div className={`space-y-5 pb-24 ${isMobile ? 'p-2' : 'p-6'}`}>
            <OperationalWorkflowStrip moduleId="invoicing" userRole={user?.role} />
            <ExecutionDecisionGuide
                steps={BILLING_MANAGER_EXECUTION_STEPS}
                onNavigate={(href) => router.push(href)}
            />
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-[var(--ws-text-primary)] tracking-tight flex items-center gap-2.5">
                        <DollarSign className="w-5 h-5 text-[#149C86]" /> Invoicing
                    </h2>
                    <p className="text-sm text-[var(--ws-text-muted)] mt-1">Invoices, recurring revenue, and follow-ups</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto rounded-full border border-white/5 bg-slate-900/60 p-1 shadow-inner">
                  <button 
                    onClick={() => setActiveTab('invoices')}
                    className={`flex-1 sm:flex-none h-8 px-3 rounded-full font-black uppercase text-[11px] tracking-widest border transition-all ${activeTab === 'invoices' ? 'bg-[var(--ws-surface-primary)] border-[var(--ws-border)] text-[var(--ws-text-primary)] shadow-sm' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    Billing
                  </button>
                  <button 
                    onClick={() => setActiveTab('aging')}
                    className={`flex-1 sm:flex-none h-8 px-3 rounded-full font-black uppercase text-[11px] tracking-widest border transition-all ${activeTab === 'aging' ? 'bg-[var(--ws-surface-primary)] border-[var(--ws-border)] text-[var(--ws-text-primary)] shadow-sm' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    Aging Report
                  </button>
                  <button 
                    onClick={() => setActiveTab('reminders')}
                    className={`flex-1 sm:flex-none h-8 px-3 rounded-full font-black uppercase text-[11px] tracking-widest border transition-all ${activeTab === 'reminders' ? 'bg-[var(--ws-surface-primary)] border-[var(--ws-border)] text-[var(--ws-text-primary)] shadow-sm' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    Reminders
                  </button>
                  <button 
                    onClick={() => setActiveTab('recurring')}
                    className={`flex-1 sm:flex-none h-8 px-3 rounded-full font-black uppercase text-[11px] tracking-widest border transition-all ${activeTab === 'recurring' ? 'bg-[var(--ws-surface-primary)] border-[var(--ws-border)] text-[var(--ws-text-primary)] shadow-sm' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    Recurring
                  </button>
                  <button 
                    onClick={() => setActiveTab('services')}
                    className={`flex-1 sm:flex-none h-8 px-3 rounded-full font-black uppercase text-[11px] tracking-widest border transition-all ${activeTab === 'services' ? 'bg-[var(--ws-surface-primary)] border-[var(--ws-border)] text-[var(--ws-text-primary)] shadow-sm' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                    Catalog
                  </button>
                </div>
            </div>

            {activeTab === 'services' ? (
                <React.Suspense fallback={<div className="p-12 text-center text-slate-500">Loading Catalog...</div>}>
                    <ServicesCatalog />
                </React.Suspense>
            ) : activeTab === 'aging' ? (
                <InvoiceAgingReport />
            ) : activeTab === 'reminders' ? (
                <OverdueReminderPanel />
            ) : activeTab === 'recurring' ? (
                currentTenant?.id ? (
                    <RecurringInvoicesPanel
                        tenantId={currentTenant.id}
                        clients={Object.entries(clientMap).map(([id, c]) => ({ id, name: c.name, email: c.email }))}
                    />
                ) : null
            ) : (
                <>
            {/* Aging severity strip */}
            {stats.overdueAmount > 0 ? (
                (() => {
                    const hasSevere = stats.overdueBucket61_plus > 0 || stats.overdueBucket31_60 > 0;
                    const severity: SemanticSeverity = stats.overdueBucket61_plus > 0 ? 'critical' : stats.overdueBucket31_60 > 0 ? 'warning' : stats.overdueBucket16_30 > 0 ? 'warning' : 'info';
                    const sem = getSemanticStyles(severity);
                    return (
                        <div className={`rounded-lg border ${sem.border} ${sem.bg} p-3 md:p-4`}>
                            <div className="flex flex-col md:flex-row md:items-start gap-3">
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${sem.iconBg} ${sem.text}`}>
                                        <AlertCircle className="w-4 h-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[13px] font-bold text-[var(--ws-text-primary)]">
                                            ${stats.overdueAmount.toLocaleString()} overdue across invoices
                                        </p>
                                        <p className="mt-1 text-[12px] text-[var(--ws-text-secondary)]">
                                            Oldest: {stats.oldestOverdueDays} days overdue.
                                            {hasSevere ? ' 60+ day invoices carry material write-off risk — escalate before end of week.' : ' Gentle payment reminders at this stage recover ~78% without relationship friction.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {stats.overdueBucket1_15 > 0 ? (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border bg-white/5 text-[10.5px] font-bold text-[var(--ws-text-secondary)] border-white/10">
                                            1–15d · ${Math.round(stats.overdueBucket1_15 / 1000)}k
                                        </span>
                                    ) : null}
                                    {stats.overdueBucket16_30 > 0 ? (
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${getSemanticStyles('warning').bg} ${getSemanticStyles('warning').text} ${getSemanticStyles('warning').border} text-[10.5px] font-bold`}>
                                            16–30d · ${Math.round(stats.overdueBucket16_30 / 1000)}k
                                        </span>
                                    ) : null}
                                    {stats.overdueBucket31_60 > 0 ? (
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${getSemanticStyles('critical').bg} ${getSemanticStyles('critical').text} ${getSemanticStyles('critical').border} text-[10.5px] font-bold`}>
                                            31–60d · ${Math.round(stats.overdueBucket31_60 / 1000)}k
                                        </span>
                                    ) : null}
                                    {stats.overdueBucket61_plus > 0 ? (
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${getSemanticStyles('critical').bg} ${getSemanticStyles('critical').text} ${getSemanticStyles('critical').border} text-[10.5px] font-bold`}>
                                            61+d · ${Math.round(stats.overdueBucket61_plus / 1000)}k
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    );
                })()
            ) : null}

            {/* Intelligent KPIs */}
            <div className="grid grid-cols-2 min-[960px]:grid-cols-4 gap-3">
                <IntelligentKpiCard
                    label="Collected"
                    current={stats.totalRevenue}
                    previous={Math.max(1, Math.round(stats.totalRevenue * (stats.paidCount > 1 ? 0.92 : 0.75)))}
                    target={Math.round(stats.totalRevenue * 1.08)}
                    href="#"
                    icon={DollarSign}
                    iconColor="#14b8a6"
                    isBetterHigher
                    compact
                />
                <IntelligentKpiCard
                    label="Awaiting payment"
                    current={stats.pendingAmount}
                    previous={Math.round(stats.pendingAmount * (stats.sentCount > 0 ? 1.04 : 0.8))}
                    href="#"
                    icon={Clock}
                    iconColor="#06b6d4"
                    compact
                />
                <IntelligentKpiCard
                    label="Overdue"
                    current={stats.overdueAmount}
                    previous={Math.round(stats.overdueAmount * (stats.overduePrev > 0 ? 0.88 : 0.5))}
                    href="#"
                    icon={AlertCircle}
                    iconColor="#f87171"
                    isBetterHigher={false}
                    compact
                />
                <IntelligentKpiCard
                    label="Invoiced (total)"
                    current={stats.totalInvoiced || (stats.totalRevenue + stats.pendingAmount + stats.overdueAmount)}
                    previous={Math.max(1, Math.round((stats.totalInvoiced || stats.totalRevenue + stats.pendingAmount + stats.overdueAmount) * 0.97))}
                    href="#"
                    icon={FileText}
                    iconColor="#8b5cf6"
                    isBetterHigher
                    compact
                />
            </div>

            {/* Collection funnel + bottleneck */}
            {stats.totalInvoiced > 0 || (stats.totalRevenue + stats.pendingAmount + stats.overdueAmount) > 0 ? (
                <BottleneckDetector
                    multiplierName="cash"
                    funnelStages={[
                        { key: 'invoiced', label: 'Invoiced', count: Math.max(1, stats.totalInvoiced || (stats.totalRevenue + stats.pendingAmount + stats.overdueAmount)), benchmarkConversion: 90 },
                        { key: 'sent', label: 'Sent to client', count: stats.sentCount > 0 ? Math.max(1, stats.pendingAmount + stats.overdueAmount + stats.totalRevenue) : Math.max(1, stats.totalInvoiced * 0.95 || stats.totalRevenue * 1.2), benchmarkConversion: 82 },
                        { key: 'paid', label: 'Collected', count: Math.max(1, stats.totalRevenue) },
                    ]}
                />
            ) : null}

            <BonnieBrief
                whatChanged={(() => {
                    const items: string[] = [];
                    const total = stats.totalInvoiced || (stats.totalRevenue + stats.pendingAmount + stats.overdueAmount);
                    items.push(`Billing ledger: $${total.toLocaleString()} invoiced · $${stats.totalRevenue.toLocaleString()} collected · $${(stats.pendingAmount + stats.overdueAmount).toLocaleString()} in-flight.`);
                    if (stats.sentCount > stats.sentPrev) items.push(`${stats.sentCount} invoice${stats.sentCount !== 1 ? 's' : ''} currently awaiting payment.`);
                    if (stats.overdueAmount > 0) items.push(`$${stats.overdueAmount.toLocaleString()} overdue · oldest ${stats.oldestOverdueDays} days.`);
                    if (items.length === 1) items.push('No material week-over-week shifts in collections cadence.');
                    return items;
                })()}
                whyItMatters={(() => {
                    const items: string[] = [];
                    if (stats.overdueBucket61_plus > 0) {
                        items.push(`61+ day overdue ($${Math.round(stats.overdueBucket61_plus / 1000)}k) crosses the 40% probabilistic write-off threshold — manual outreach required.`);
                    } else if (stats.overdueBucket31_60 > 0) {
                        items.push(`31–60 day balances ($${Math.round(stats.overdueBucket31_60 / 1000)}k) are the highest-ROI collection window — 51% recover with one firm but cordial reminder.`);
                    }
                    const collected = stats.totalRevenue;
                    const owed = stats.pendingAmount + stats.overdueAmount;
                    if (owed > collected * 0.6 && collected > 0) {
                        items.push(`Outstanding (${Math.round((owed / (collected + owed)) * 100)}% of booked) is above the 40% healthy ceiling — cash velocity degrades working-business flexibility.`);
                    }
                    if (items.length === 0) items.push('Collections posture is healthy. Preserve current reminder cadence and early-payment incentives.');
                    return items;
                })()}
                whatToDo={(() => {
                    const items: string[] = [];
                    if (stats.overdueBucket61_plus > 0) items.push('Escalate 61+ day overdue today: payment plan, partial payment, or pause on further work until reconciled.');
                    if (stats.oldestOverdueDays > 30) items.push('Run the 31+ day queue with direct owner outreach — template reminders degrade sharply past this mark.');
                    else if (stats.overdueBucket16_30 > 0) items.push('Send 16–30 day cordial batch reminders now — automations recover 78% of this bracket with zero relationship cost.');
                    if (stats.draftCount > 0) items.push(`Issue the ${stats.draftCount} draft invoice${stats.draftCount !== 1 ? 's' : ''} — unbilled work is a zero-interest loan to your clients.`);
                    items.push('Measure DSO (days sales outstanding), not raw overdue count — shrinking DSO by 5 days permanently is worth more than one dramatic collection spike.');
                    return items;
                })()}
            />

            {/* Chart */}
            {!isMobile && (
                <div className={`${WORKSPACE.panel.base} p-4 md:p-6 h-80`}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[13px] font-bold text-[var(--ws-text-primary)] flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-[var(--success-text)]" />
                            Collected revenue trend
                        </h3>
                    </div>
                    <ResponsiveContainer width="100%" height="82%" minWidth={0} minHeight={200}>
                        <LineChart data={revenueData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                stroke="#4b5563" 
                                fontSize={10} 
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis 
                                stroke="#4b5563" 
                                fontSize={10} 
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val: number) => `$${val}`}
                            />
                            <Tooltip 
                                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '8px' }}
                                itemStyle={{ color: '#14b8a6' }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="revenue" 
                                stroke="#14b8a6" 
                                strokeWidth={2} 
                                dot={false} 
                                activeDot={{ r: 4, strokeWidth: 0 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Invoices List */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar rounded-full border border-white/5 bg-slate-900/60 p-1 shadow-inner">
                        {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map(s => (
                            <button key={s} onClick={() => setFilter(s)} className={`h-8 px-3 rounded-full text-[11px] font-black uppercase tracking-widest border transition-all ${filter === s ? 'bg-teal-600 border-teal-500 text-white shadow-sm' : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'}`}>{s}</button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {selectedInvoiceIds.size > 0 && (
                            <div className="flex items-center gap-1.5 rounded-full border border-white/5 bg-slate-900/60 p-1 shadow-inner">
                                <button
                                    type="button"
                                    onClick={() => setSelectedInvoiceIds(new Set())}
                                    className="h-7 px-3 rounded-full text-[11px] font-black uppercase tracking-widest border border-white/10 text-slate-500 transition-colors hover:text-slate-300"
                                >
                                    Clear
                                </button>
                                <button
                                    type="button"
                                    onClick={handleBulkEmailInvoices}
                                    className="h-7 px-3 rounded-full text-[11px] font-black uppercase tracking-widest border border-indigo-500/30 text-indigo-300 flex items-center gap-1.5 transition-colors hover:text-indigo-200"
                                >
                                    <Mail size={12} />
                                    {`Send Follow-up (${selectedInvoiceIds.size})`}
                                </button>
                                <button
                                    type="button"
                                    disabled={bulkDeletingInvoices}
                                    onClick={handleBulkDeleteInvoices}
                                    className="h-7 px-3 rounded-full text-[11px] font-black uppercase tracking-widest border border-rose-500/30 text-rose-300 flex items-center gap-1.5 transition-colors hover:text-rose-200 disabled:opacity-50"
                                >
                                    <Trash2 size={12} />
                                    {bulkDeletingInvoices ? 'Deleting…' : `Delete (${selectedInvoiceIds.size})`}
                                </button>
                            </div>
                        )}
                        <button onClick={() => setShowCreateModal(true)} className="flex-shrink-0 inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-teal-600 px-3 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-teal-900/20 transition-all hover:bg-teal-500">
                            <Plus size={12} /> Create Invoice
                        </button>
                    </div>
                </div>
                <p className="text-xs text-slate-500 -mt-2">
                    Tip: select invoices to send one follow-up to many clients at once. Only drafts can be bulk deleted.
                </p>

                <div className="space-y-3">
                    {filteredInvoices.map(inv => (
                        <Card 
                            key={inv.id} 
                            onClick={() => { setSelectedInvoiceForOptions(inv); setIsOptionsOpen(true); }} 
                            className={`p-4 sm:p-5 bg-slate-900/40 border-white/5 hover:bg-white/[0.03] transition-all cursor-pointer ${
                                selectedInvoiceIds.has(inv.id) ? 'ring-1 ring-teal-500/40' : ''
                            }`}
                        >
                            <div className="flex justify-between items-start mb-3 gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleInvoiceSelection(inv);
                                        }}
                                        className="text-slate-500 hover:text-teal-400 shrink-0 transition-colors"
                                        aria-label={`Select ${inv.invoiceNumber}`}
                                    >
                                        {selectedInvoiceIds.has(inv.id)
                                            ? <CheckSquare size={14} className="text-teal-400" />
                                            : <Square size={14} />}
                                    </button>
                                    <div className={`p-2 rounded-full bg-white/5 ${getStatusStyles(inv.status)}`}><FileText size={14} /></div>
                                    <div>
                                        <p className="text-[12px] font-black text-white">{inv.invoiceNumber}</p>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.22em]">{inv.clientId && clientMap[inv.clientId]?.name ? clientMap[inv.clientId].name : 'Walk-in Client'}</p>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getStatusStyles(inv.status)}`}>{inv.status}</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.22em]">Due Date</p>
                                    <p className="text-[11px] font-bold text-gray-300">{new Date(inv.dueDate).toLocaleDateString()}</p>
                                    {Number(inv.amountPaid || 0) > 0 && (
                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-300">
                                            Paid {Number(inv.amountPaid || 0).toLocaleString()} · Balance {Number(inv.balanceDue || 0).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                <p className="text-[20px] font-black text-white font-mono tracking-tight leading-none">${inv.total.toLocaleString()}</p>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Invoice Options Bottom Sheet */}
            <AnimatePresence>
                {isOptionsOpen && selectedInvoiceForOptions && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.7 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOptionsOpen(false)}
                            className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed inset-x-0 bottom-0 z-[1110] max-h-[92dvh] bg-slate-950 border-t border-white/10 rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="flex justify-center py-2 shrink-0 cursor-grab bg-slate-900/40 border-b border-white/5">
                                <div className="w-10 h-1 bg-white/20 rounded-full" />
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar pb-10 space-y-5">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500 font-mono">
                                            Invoice ID: #{selectedInvoiceForOptions.id.slice(0, 8).toUpperCase()}
                                        </span>
                                        <h3 className="text-base font-black text-white uppercase mt-1 tracking-tight">
                                            {selectedInvoiceForOptions.invoiceNumber}
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Client: {selectedInvoiceForOptions.clientId && clientMap[selectedInvoiceForOptions.clientId]?.name ? clientMap[selectedInvoiceForOptions.clientId].name : 'Walk-in Client'}
                                        </p>
                                    </div>
                                    <button onClick={() => setIsOptionsOpen(false)} className="h-8 w-8 p-0 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex items-center justify-center">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono mb-1">Total Amount Due</p>
                                    <p className="text-3xl font-black text-teal-400 tracking-tight font-mono">
                                        ${selectedInvoiceForOptions.total.toLocaleString()}
                                    </p>
                                    {Number(selectedInvoiceForOptions.amountPaid || 0) > 0 && (
                                        <div className="mt-3 grid grid-cols-2 gap-3 text-left">
                                            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-200/80">Paid So Far</p>
                                                <p className="text-sm font-black text-blue-200">${Number(selectedInvoiceForOptions.amountPaid || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-200/80">Balance Due</p>
                                                <p className="text-sm font-black text-amber-200">${Number(selectedInvoiceForOptions.balanceDue || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-3 flex justify-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getStatusStyles(selectedInvoiceForOptions.status)}`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                            {selectedInvoiceForOptions.status}
                                        </span>
                                    </div>
                                    <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        Auto follow-ups: {selectedInvoiceForOptions.autoFollowupEnabled === false ? 'Off' : 'On'}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    <button onClick={() => { setLifecycleInvoiceId(selectedInvoiceForOptions.id); setIsOptionsOpen(false); }} className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"><span className="flex items-center gap-2.5"><Calendar className="w-4 h-4 text-sky-400" /><span>Payment Plan, Credits & Disputes</span></span><span className="text-[10px] text-slate-500 font-mono">LIFECYCLE</span></button>
                                    <button
                                        onClick={() => {
                                            setEditingInvoice(selectedInvoiceForOptions);
                                            setIsOptionsOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <Edit className="w-4 h-4 text-violet-400" />
                                            <span>Edit Invoice &amp; Theme</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">DESIGN</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            handleViewPDF(selectedInvoiceForOptions);
                                            setIsOptionsOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <Eye className="w-4 h-4 text-teal-400" />
                                            <span>Preview PDF Invoice</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">PDF PREVIEW</span>
                                    </button>

                                    <button
                                        onClick={() => {
                                            handleDownloadPDF(selectedInvoiceForOptions);
                                            setIsOptionsOpen(false);
                                        }}
                                        className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <Download className="w-4 h-4 text-indigo-400" />
                                            <span>Download PDF File</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">PDF DOWNLOAD</span>
                                    </button>

                                    <button
                                        onClick={() => openInvoiceCompose(selectedInvoiceForOptions)}
                                        className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <Mail className="w-4 h-4 text-teal-400" />
                                            <span>Compose Email to Client</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">ZOHO / OUTLOOK</span>
                                    </button>

                                    {currentTenant?.id && (
                                        <button
                                            onClick={async () => {
                                                if (!selectedInvoiceForOptions) return;
                                                const currentEnabled = selectedInvoiceForOptions.autoFollowupEnabled !== false;
                                                const nextEnabled = !currentEnabled;
                                                const ok = await confirmDialog({
                                                    title: nextEnabled ? 'Enable auto follow-ups?' : 'Disable auto follow-ups?',
                                                    description: nextEnabled
                                                        ? 'AlphaClone will send reminder emails until the invoice is paid.'
                                                        : 'Stops future reminder emails for this invoice. Manual follow-ups will still be available.',
                                                    confirmLabel: nextEnabled ? 'Enable' : 'Disable',
                                                    variant: nextEnabled ? 'primary' : 'danger',
                                                });
                                                if (!ok) return;
                                                const toastId = toast.loading('Updating follow-up settings...');
                                                try {
                                                    const res = await fetch(`/api/invoices/${selectedInvoiceForOptions.id}/followup-settings`, {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            tenantId: currentTenant.id,
                                                            autoFollowupEnabled: nextEnabled,
                                                        }),
                                                    });
                                                    const data = await res.json().catch(() => ({}));
                                                    if (!res.ok) throw new Error(data.error || 'Failed to update follow-ups');
                                                    toast.success(
                                                        nextEnabled ? 'Auto follow-ups enabled for this invoice.' : 'Auto follow-ups disabled for this invoice.',
                                                        { id: toastId }
                                                    );
                                                    setIsOptionsOpen(false);
                                                    void loadInvoices();
                                                } catch (err) {
                                                    toast.error(err instanceof Error ? err.message : 'Failed to update follow-ups', { id: toastId });
                                                }
                                            }}
                                            className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <CheckCircle className="w-4 h-4 text-teal-400" />
                                                <span>{selectedInvoiceForOptions.autoFollowupEnabled !== false ? 'Disable Auto Follow-ups' : 'Enable Auto Follow-ups'}</span>
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">REMINDERS</span>
                                        </button>
                                    )}

                                    {selectedInvoiceForOptions.clientId && currentTenant?.id && (
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const res = await fetch(
                                                        `/api/client-finance/portal-link/${selectedInvoiceForOptions.clientId}?tenantId=${encodeURIComponent(currentTenant.id)}`
                                                    );
                                                    const data = await res.json();
                                                    if (!res.ok || !data.url) throw new Error(data.error || 'Failed');
                                                    await navigator.clipboard.writeText(data.url);
                                                    toast.success('Client finance portal link copied');
                                                } catch (err) {
                                                    toast.error(err instanceof Error ? err.message : 'Failed to copy portal link');
                                                }
                                            }}
                                            className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <User className="w-4 h-4 text-purple-400" />
                                                <span>Copy Client Finance Portal Link</span>
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">INVOICES + QUOTES</span>
                                        </button>
                                    )}

                                    <button
                                        onClick={async () => {
                                            if (!selectedInvoiceForOptions) return;
                                            setIsOptionsOpen(false);
                                            const toastId = toast.loading('Starting invoice lifecycle...');
                                            try {
                                                if (!currentTenant?.id) throw new Error('Active workspace required');
                                                const { startInvoiceLifecycleFromDashboard } = await import(
                                                    '@/lib/invoices/startInvoiceLifecycleFromDashboard'
                                                );
                                                await startInvoiceLifecycleFromDashboard({
                                                    tenantId: currentTenant.id,
                                                    invoiceId: selectedInvoiceForOptions.id,
                                                });
                                                toast.success('Lifecycle started — email + reminders now automated.', { id: toastId });
                                            } catch (err: any) {
                                                toast.error(`Failed to start lifecycle: ${err.message}`, { id: toastId });
                                            }
                                        }}
                                        className="w-full flex items-center justify-between p-3.5 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all text-left text-sm text-slate-200"
                                    >
                                        <span className="flex items-center gap-2.5">
                                            <Send className="w-4 h-4 text-sky-400" />
                                            <span>Email Invoice to Client</span>
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono">EMAIL DISPATCH</span>
                                    </button>

                                    {selectedInvoiceForOptions.status !== 'paid' ? (
                                        <div className="space-y-2">
                                            <button
                                                onClick={async () => {
                                                    const toastId = toast.loading('Updating payment status...');
                                                    const { error } = await businessInvoiceService.markAsPaid(selectedInvoiceForOptions.id);
                                                    if (error) {
                                                        toast.error(error, { id: toastId });
                                                        return;
                                                    }
                                                    toast.success('Invoice marked as paid', { id: toastId });
                                                    setIsOptionsOpen(false);
                                                    void loadInvoices();
                                                }}
                                                className="w-full flex items-center justify-between p-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl transition-all text-left text-sm text-emerald-200"
                                            >
                                                <span className="flex items-center gap-2.5">
                                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                                    <span>Mark as Paid</span>
                                                </span>
                                                <span className="text-[10px] text-emerald-500/80 font-mono">FULL PAYMENT</span>
                                            </button>

                                            <button
                                                onClick={async () => {
                                                    if (!selectedInvoiceForOptions) return;
                                                    setIsOptionsOpen(false);
                                                    openRecordPayment(selectedInvoiceForOptions);
                                                }}
                                                className="w-full flex items-center justify-between p-3.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-2xl transition-all text-left text-sm text-blue-200"
                                            >
                                                <span className="flex items-center gap-2.5">
                                                    <Clock className="w-4 h-4 text-blue-300" />
                                                    <span>Record Deposit / Partial</span>
                                                </span>
                                                <span className="text-[10px] text-blue-300/80 font-mono">AMOUNT PAID</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={async () => {
                                                const toastId = toast.loading('Updating payment status...');
                                                const { error } = await businessInvoiceService.updateInvoice(selectedInvoiceForOptions.id, { status: 'sent' });
                                                if (error) {
                                                    toast.error(error, { id: toastId });
                                                    return;
                                                }
                                                toast.success('Invoice marked as unpaid', { id: toastId });
                                                setIsOptionsOpen(false);
                                                void loadInvoices();
                                            }}
                                            className="w-full flex items-center justify-between p-3.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl transition-all text-left text-sm text-amber-200"
                                        >
                                            <span className="flex items-center gap-2.5">
                                                <Clock className="w-4 h-4 text-amber-400" />
                                                <span>Mark as Unpaid</span>
                                            </span>
                                            <span className="text-[10px] text-amber-500/80 font-mono">MANUAL UPDATE</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* PDF Preview Modal */}
            <AnimatePresence>
                {showPDFPreview && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-md z-[1100] flex flex-col p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-white font-black uppercase tracking-widest text-sm">Invoice Preview</h3>
                            <button onClick={() => setShowPDFPreview(null)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white"><X size={20} /></button>
                        </div>
                        <iframe src={showPDFPreview} className="flex-1 w-full rounded-2xl border border-white/10" />
                        <div className="mt-4 flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!selectedInvoiceForOptions) return;
                                    const toastId = toast.loading('Starting invoice lifecycle...');
                                    try {
                                        if (!currentTenant?.id) throw new Error('Active workspace required');
                                        const { startInvoiceLifecycleFromDashboard } = await import(
                                            '@/lib/invoices/startInvoiceLifecycleFromDashboard'
                                        );
                                        await startInvoiceLifecycleFromDashboard({
                                            tenantId: currentTenant.id,
                                            invoiceId: selectedInvoiceForOptions.id,
                                        });
                                        toast.success('Lifecycle started — email + reminders now automated.', { id: toastId });
                                        setShowPDFPreview(null);
                                    } catch (err: any) {
                                        toast.error(`Failed to start lifecycle: ${err.message}`, { id: toastId });
                                    }
                                }}
                                className="flex-1 h-12 bg-teal-600 text-white rounded-xl font-black uppercase text-xs"
                            >
                                Start Lifecycle
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedInvoiceForOptions) return;
                                    handleDownloadPDF(selectedInvoiceForOptions);
                                }}
                                className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-white"
                            >
                                <Download size={20} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <EnhancedInvoiceModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} mode="create" onSuccess={loadInvoices} />
            <InvoiceLifecycleDrawer invoiceId={lifecycleInvoiceId} tenantId={currentTenant?.id} open={Boolean(lifecycleInvoiceId)} onOpenChange={(open) => !open && setLifecycleInvoiceId(null)} />
            <EnhancedInvoiceModal
                isOpen={Boolean(editingInvoice)}
                onClose={() => setEditingInvoice(null)}
                mode="edit"
                invoice={editingInvoice || undefined}
                onSuccess={() => {
                    setEditingInvoice(null);
                    void loadInvoices();
                }}
            />

            {emailCompose && user && (
                <CommunicationModal
                    user={user}
                    recipient={emailCompose.recipient}
                    prefilledSubject={emailCompose.subject}
                    prefilledBody={emailCompose.body}
                    onClose={() => setEmailCompose(null)}
                    onSent={() => setEmailCompose(null)}
                />
            )}

            <Modal
                isOpen={recordPaymentOpen}
                onClose={closeRecordPayment}
                title={recordPaymentInvoice ? `Record payment — ${recordPaymentInvoice.invoiceNumber}` : 'Record payment'}
                maxWidth="max-w-lg"
            >
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (!recordPaymentInvoice) return;
                        const amount = Number(String(recordPaymentAmount || '').replace(/[^0-9.]/g, ''));
                        if (!Number.isFinite(amount) || amount <= 0) {
                            setRecordPaymentError('Enter a valid amount greater than zero.');
                            return;
                        }

                        setRecordPaymentSubmitting(true);
                        setRecordPaymentError(null);
                        const toastId = toast.loading('Recording payment...');
                        try {
                            const { error, status, amountPaid } = await businessInvoiceService.recordPayment(recordPaymentInvoice.id, amount);
                            if (error) throw new Error(error);
                            toast.success(
                                status === 'paid'
                                    ? 'Payment recorded — invoice is now paid.'
                                    : `Deposit recorded — total paid now ${Number(amountPaid || 0).toFixed(2)}.`,
                                { id: toastId }
                            );
                            closeRecordPayment();
                            void loadInvoices();
                        } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Failed to record payment', { id: toastId });
                            setRecordPaymentSubmitting(false);
                        }
                    }}
                    className="flex flex-col gap-4"
                >
                    <Input
                        label="Payment amount"
                        value={recordPaymentAmount}
                        onChange={(e) => {
                            setRecordPaymentAmount(e.target.value);
                            if (recordPaymentError) setRecordPaymentError(null);
                        }}
                        placeholder="250.00"
                        inputMode="decimal"
                        error={recordPaymentError || undefined}
                    />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                        <Button type="button" variant="outline" onClick={closeRecordPayment}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" isLoading={recordPaymentSubmitting} disabled={!recordPaymentInvoice}>
                            Record payment
                        </Button>
                    </div>
                </form>
            </Modal>
                </>
            )}
        </div>
    );
};

export default EnhancedBillingPage;
