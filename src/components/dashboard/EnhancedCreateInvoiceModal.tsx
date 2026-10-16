'use client';

import { Input as AlphaCloneInput } from '@/components/ui/input';
import { Select as AlphaCloneSelect } from '@/components/ui/select';
import { Textarea as AlphaCloneTextarea } from '@/components/ui/textarea';


import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, DollarSign, FileText, CheckCircle, Edit3, Save, Download, PenLine, Copy, List, Plus, Users, Search, CheckCircle2, Send, Mail, AlertCircle, Building2, ChevronDown, Sparkles, Eye, Paperclip, Upload, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input } from '../ui/UIComponents';
import { Project } from '../../types';
import toast from 'react-hot-toast';
import { showInvoiceCreatedWithSendPrompt } from '../common/showActionNextSteps';
import { useTenant } from '../../contexts/TenantContext';
import { COMPREHENSIVE_INDUSTRIES, getAllIndustryNames, getServicesByIndustry, findIndustryByNameOrKeyword, ServiceItem } from '../../lib/comprehensiveIndustries';
import { UNIVERSAL_SERVICE_CATALOG } from '../../services/universalServiceCatalog';
import { supabase } from '@/lib/supabase';
import { getTaxRateForCountry } from '@/lib/tax/taxRules';
import { WORKSPACE } from '@/constants/design';
import { PaymentRailBanner } from '@/components/dashboard/payments/PaymentRailBanner';
import { startInvoiceLifecycleFromDashboard } from '@/lib/invoices/startInvoiceLifecycleFromDashboard';
import type { InvoiceAttachment } from '@/services/businessInvoiceService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipientEmails(raw: string): string[] {
    return [
        ...new Set(
            String(raw || '')
                .split(/[;,]/)
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean)
        ),
    ];
}

function areAllEmailsValid(raw: string): boolean {
    const list = parseRecipientEmails(raw);
    return list.length > 0 && list.every((e) => EMAIL_REGEX.test(e));
}

function defaultDueDateIso(): string {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
}

interface LineItem {
    description: string;
    quantity: number;
    rate: number;
    serviceId?: string; // Reference to selected service
}

interface CreateInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInvoiceCreated: () => void;
    projects: Project[];
    preselectProjectId?: string;
    preselectClientId?: string;
}

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({ isOpen, onClose, onInvoiceCreated, projects, preselectProjectId, preselectClientId }) => {
    const router = useRouter();
    const { currentTenant } = useTenant();
    const [step, setStep] = useState<'edit' | 'preview' | 'success'>('edit');
    const [selectedTemplate, setSelectedTemplate] = useState<1 | 2 | 3 | 4 | 5>(1);

    // Form state
    const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', quantity: 1, rate: 0 }]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [clientName, setClientName] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [dueDate, setDueDate] = useState(defaultDueDateIso);
    const [notes, setNotes] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'bank' | 'mobile_money'>('stripe');
    const [bankDetails, setBankDetails] = useState('');
    const [mobileDetails, setMobileDetails] = useState('');
    const [taxRate, setTaxRate] = useState<number>(0);
    const [taxCountry, setTaxCountry] = useState<string>('ZW');
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
    const [createdInvoice, setCreatedInvoice] = useState<any | null>(null);
    const [sendOutcome, setSendOutcome] = useState<{
        sent: boolean;
        status?: string;
        provider?: string | null;
        emailId?: string | null;
        actionUrl?: string;
        message?: string;
    } | null>(null);
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [signatureType, setSignatureType] = useState<'draw' | 'type'>('draw');
    const [typedSignature, setTypedSignature] = useState('');
    const [userSectors, setUserSectors] = useState<string[]>([]);
    const [myServices, setMyServices] = useState<Record<string, any>>({});
    const [showServiceDropdown, setShowServiceDropdown] = useState<{ index: number; open: boolean }>({ index: -1, open: false });
    const [searchQuery, setSearchQuery] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const [highlightedClientIndex, setHighlightedClientIndex] = useState<number>(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);

    // Attachments state
    const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

    // Service selection state
    const [selectedIndustry, setSelectedIndustry] = useState<string>('');
    const [availableServices, setAvailableServices] = useState<ServiceItem[]>([]);
    const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
    const [industrySearchQuery, setIndustrySearchQuery] = useState('');
    const [serviceSearchQuery, setServiceSearchQuery] = useState('');

    const [enablePaymentLinks, setEnablePaymentLinks] = useState(true);

    // Set default bank and mobile money details from tenant
    const tenantSettings = currentTenant?.settings as {
        paymentMethods?: { bank?: string; mobile?: string };
        payment_methods?: { bank?: string; mobile?: string };
    } | undefined;
    const tenantPaymentMethods = tenantSettings?.paymentMethods || tenantSettings?.payment_methods;
    const tenantDefaults = {
        bank: tenantPaymentMethods?.bank || '',
        mobile: tenantPaymentMethods?.mobile || '',
    };

    React.useEffect(() => {
        if (tenantPaymentMethods) {
            setBankDetails(tenantPaymentMethods.bank || tenantDefaults.bank);
            setMobileDetails(tenantPaymentMethods.mobile || tenantDefaults.mobile);
        }
    }, [tenantPaymentMethods, tenantDefaults.bank, tenantDefaults.mobile]);

    React.useEffect(() => {
        if (!isOpen || !currentTenant?.id) return;
        const loadTaxDefaults = async () => {
            const { data } = await supabase
                .from('business_settings')
                .select('tax_rate, tax_country')
                .eq('tenant_id', currentTenant.id)
                .maybeSingle();

            const country = data?.tax_country || 'ZW';
            setTaxCountry(country);
            if (data?.tax_rate != null && Number(data.tax_rate) > 0) {
                setTaxRate(Number(data.tax_rate));
            } else {
                const lookup = getTaxRateForCountry(country);
                if (lookup.rate > 0) setTaxRate(lookup.rate);
            }
        };
        loadTaxDefaults();
    }, [isOpen, currentTenant?.id]);

    // Load clients when component mounts or project changes
    React.useEffect(() => {
        const loadClients = async () => {
            try {
                const { businessClientService } = await import('../../services/businessClientService');
                const { clients } = await businessClientService.getClients(currentTenant?.id || '');
                setClients(clients || []);
            } catch (error) {
                console.error('Failed to load clients:', error);
            }
        };
        loadClients();
    }, [currentTenant?.id]);

    // Canvas Drawing Logic
    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || signatureType !== 'draw') return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size for high DPI
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Set drawing style
        ctx.strokeStyle = 'var(--color-black)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;

        const getCoords = (e: MouseEvent | TouchEvent) => {
            const rect = canvas.getBoundingClientRect();
            if ('touches' in e) {
                return {
                    x: e.touches[0].clientX - rect.left,
                    y: e.touches[0].clientY - rect.top
                };
            }
            return {
                x: (e as MouseEvent).clientX - rect.left,
                y: (e as MouseEvent).clientY - rect.top
            };
        };

        const startDrawing = (e: MouseEvent | TouchEvent) => {
            isDrawing = true;
            const { x, y } = getCoords(e);
            lastX = x;
            lastY = y;
        };

        const draw = (e: MouseEvent | TouchEvent) => {
            if (!isDrawing) return;
            if ('touches' in e) e.preventDefault(); // Prevent scrolling on touch
            const { x, y } = getCoords(e);

            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();

            lastX = x;
            lastY = y;
        };

        const stopDrawing = () => {
            if (!isDrawing) return;
            isDrawing = false;
            setSignatureData(canvas.toDataURL());
        };

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        window.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);

        return () => {
            canvas.removeEventListener('mousedown', startDrawing);
            canvas.removeEventListener('mousemove', draw);
            window.removeEventListener('mouseup', stopDrawing);
            canvas.removeEventListener('touchstart', startDrawing);
            canvas.removeEventListener('touchmove', draw);
            canvas.removeEventListener('touchend', stopDrawing);
        };
    }, [signatureType]);

    // Load user services and sectors
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    React.useEffect(() => {
        const loadUserServices = async () => {
            try {
                const { userService } = await import('../../services/userService');
                const userData = await userService.getCurrentUser();
                if (userData?.sectors) {
                    setUserSectors(userData.sectors);
                }
                if (userData?.services) {
                    setMyServices(userData.services);
                }
            } catch (error) {
                console.error('Failed to load user services:', error);
            }
        };
        loadUserServices();
    }, []);

    // Update client name and email when client is selected
    React.useEffect(() => {
        if (!selectedClientId) return;
        const selectedClient = clients.find(c => c.id === selectedClientId);
        if (selectedClient) {
            if (selectedClient.name) setClientName(selectedClient.name);
            setClientEmail(selectedClient.email || '');
            setSearchQuery(selectedClient.name || '');
        }
    }, [selectedClientId, clients]);

    // Pre-select project and client when modal opens
    React.useEffect(() => {
        if (!isOpen) return;
        if (!dueDate) setDueDate(defaultDueDateIso());
        if (preselectProjectId) {
            setSelectedProjectId(preselectProjectId);
            const project = projects.find(p => p.id === preselectProjectId);
            if (project?.clientId) {
                setSelectedClientId(project.clientId);
            }
        }
        if (preselectClientId && !preselectProjectId) {
            setSelectedClientId(preselectClientId);
        }
    }, [isOpen, preselectProjectId, preselectClientId, projects, dueDate]);

    // Auto-fill client when project is selected
    React.useEffect(() => {
        if (!selectedProjectId) return;
        const project = projects.find(p => p.id === selectedProjectId);
        if (project?.clientId && !selectedClientId) {
            setSelectedClientId(project.clientId);
        }
    }, [selectedProjectId, projects, selectedClientId]);

    // Update available services when industry changes
    React.useEffect(() => {
        if (selectedIndustry) {
            const services = getServicesByIndustry(selectedIndustry);
            setAvailableServices(services);
            
            // Set default tax rate for the industry
            const industry = COMPREHENSIVE_INDUSTRIES.find(ind => ind.id === selectedIndustry);
            if (industry) {
                setTaxRate(industry.commonTaxRate * 100); // Convert to percentage
            }
        } else {
            setAvailableServices([]);
            setTaxRate(0);
        }
    }, [selectedIndustry]);

    const filteredClients = React.useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return clients;
        return clients.filter(
            (c) =>
                c.name?.toLowerCase().includes(q) ||
                c.email?.toLowerCase().includes(q) ||
                c.company?.toLowerCase().includes(q)
        );
    }, [clients, searchQuery]);

    const handleSelectClient = (client: any) => {
        setSelectedClientId(client.id);
        setClientName(client.name || '');
        setClientEmail(client.email || '');
        setSearchQuery(client.name || '');
        setShowContactDropdown(false);
    };

    const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !currentTenant?.id) return;

        setIsUploadingAttachment(true);
        try {
            const uploadedItems: InvoiceAttachment[] = [];
            for (const file of Array.from(files)) {
                if (file.size > 10 * 1024 * 1024) {
                    toast.error(`${file.name} exceeds the 10 MB limit`);
                    continue;
                }
                const formData = new FormData();
                formData.append('tenantId', currentTenant.id);
                formData.append('file', file);

                const targetId = createdInvoiceId || 'draft';
                const res = await fetch(`/api/invoices/${encodeURIComponent(targetId)}/attachments`, {
                    method: 'POST',
                    body: formData,
                });
                const payload = await res.json().catch(() => ({}));
                if (!res.ok || !payload.attachment) {
                    throw new Error(payload.error || `Failed to upload ${file.name}`);
                }
                uploadedItems.push(payload.attachment);
            }
            if (uploadedItems.length > 0) {
                setAttachments((prev) => [...prev, ...uploadedItems]);
                toast.success(
                    uploadedItems.length === 1
                        ? `Attached ${uploadedItems[0].name}`
                        : `Attached ${uploadedItems.length} files`
                );
            }
        } catch (err: any) {
            console.error('Attachment upload failed:', err);
            toast.error(err?.message || 'Failed to upload attachment');
        } finally {
            setIsUploadingAttachment(false);
            if (attachmentInputRef.current) attachmentInputRef.current.value = '';
        }
    };

    const handleRemoveAttachment = async (att: InvoiceAttachment) => {
        if (!currentTenant?.id) return;
        setAttachments((prev) => prev.filter((item) => item.storagePath !== att.storagePath));
        try {
            const targetId = createdInvoiceId || 'draft';
            await fetch(`/api/invoices/${encodeURIComponent(targetId)}/attachments`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    storagePath: att.storagePath,
                }),
            });
        } catch {
            // non-blocking cleanup
        }
    };

    const addLineItem = () => {
        setLineItems([...lineItems, { description: '', quantity: 1, rate: 0 }]);
    };

    const removeLineItem = (index: number) => {
        if (lineItems.length > 1) {
            setLineItems(lineItems.filter((_, i) => i !== index));
        }
    };

    const calculateSubtotal = () => {
        return lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    };

    const calculateTax = () => {
        const subtotal = calculateSubtotal();
        const taxableAmount = Math.max(0, subtotal - discountAmount);
        return (taxableAmount * taxRate) / 100; // taxRate is already in percentage (e.g., 15 for 15%)
    };

    const calculateTotal = () => {
        return calculateSubtotal() + calculateTax() - discountAmount;
    };

    const buildInvoicePayload = () => {
        const resolvedName = clientName.trim() || searchQuery.trim() || clients.find((c) => c.id === selectedClientId)?.name || '';
        const recipients = parseRecipientEmails(clientEmail);
        return {
            clientId: selectedClientId || null,
            clientName: resolvedName || null,
            clientEmail: recipients[0] || clientEmail.trim() || null,
            projectId: selectedProjectId || null,
            lineItems: lineItems.filter((item) => item.description.trim()),
            dueDate: dueDate || defaultDueDateIso(),
            notes: notes.trim() || null,
            paymentMethod,
            bankDetails: paymentMethod === 'bank' ? bankDetails : '',
            mobileDetails: paymentMethod === 'mobile_money' ? mobileDetails : '',
            taxRate,
            discountAmount,
            subtotal: calculateSubtotal(),
            tax: calculateTax(),
            total: calculateTotal(),
            template: selectedTemplate,
            signature: signatureData,
            signatureType,
            typedSignature,
            status: 'draft',
            isPublic: enablePaymentLinks,
            enablePaymentLinks,
            attachments,
        };
    };

    const handleSubmit = async (sendImmediately = false) => {
        if (!currentTenant?.id) {
            toast.error('No active workspace selected');
            return;
        }
        const validLines = lineItems.filter((item) => item.description.trim());
        if (validLines.length === 0 || calculateTotal() <= 0) {
            toast.error('Add at least one line item with a positive amount');
            return;
        }
        const recipients = parseRecipientEmails(clientEmail);
        if (sendImmediately) {
            if (recipients.length === 0) {
                toast.error('Enter a valid recipient email address to send this invoice');
                return;
            }
            if (!areAllEmailsValid(clientEmail)) {
                toast.error('Please check the recipient email format');
                return;
            }
        }

        setIsSubmitting(true);
        if (sendImmediately) setIsSending(true);
        try {
            const { businessInvoiceService } = await import('../../services/businessInvoiceService');
            let invoice = createdInvoice;

            if (!invoice) {
                const invoiceData = buildInvoicePayload();
                const res = await businessInvoiceService.createInvoice(currentTenant.id, invoiceData as any);
                if (res.error || !res.invoice) {
                    toast.error(res.error || 'Failed to create invoice');
                    return;
                }
                invoice = res.invoice;
                setCreatedInvoiceId(invoice.id);
                setCreatedInvoice(invoice);
            }

            if (sendImmediately) {
                const lifecycleRes = await startInvoiceLifecycleFromDashboard({
                    tenantId: currentTenant.id,
                    invoiceId: invoice.id,
                    recipients,
                    attachments,
                });
                setSendOutcome({
                    sent: lifecycleRes.status === 'sent',
                    status: lifecycleRes.canonicalDeliveryStatus,
                    provider: lifecycleRes.provider,
                    emailId: lifecycleRes.emailId,
                    actionUrl: lifecycleRes.actionUrl,
                    message: lifecycleRes.message,
                });
                toast.success(lifecycleRes.message);
            } else {
                setSendOutcome(null);
                toast.success('Invoice saved as draft');
                showInvoiceCreatedWithSendPrompt((path) => router.push(path));
            }

            setStep('success');
            onInvoiceCreated();
        } catch (error: any) {
            console.error('Failed to process invoice:', error);
            toast.error(error?.message || 'Failed to process invoice');
        } finally {
            setIsSubmitting(false);
            setIsSending(false);
        }
    };

    const handleSendCreatedInvoice = async () => {
        if (!currentTenant?.id || !createdInvoiceId) return;
        const recipients = parseRecipientEmails(clientEmail);
        if (recipients.length === 0 || !areAllEmailsValid(clientEmail)) {
            toast.error('Enter a valid recipient email address before sending');
            return;
        }
        setIsSending(true);
        try {
            const lifecycleRes = await startInvoiceLifecycleFromDashboard({
                tenantId: currentTenant.id,
                invoiceId: createdInvoiceId,
                recipients,
                attachments,
            });
            setSendOutcome({
                sent: lifecycleRes.status === 'sent',
                status: lifecycleRes.canonicalDeliveryStatus,
                provider: lifecycleRes.provider,
                emailId: lifecycleRes.emailId,
                actionUrl: lifecycleRes.actionUrl,
                message: lifecycleRes.message,
            });
            toast.success(lifecycleRes.message);
            onInvoiceCreated();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to send invoice email');
        } finally {
            setIsSending(false);
        }
    };

    const getPaymentInstructions = () => {
        switch (paymentMethod) {
            case 'stripe':
                return 'Pay securely online using the payment link in the invoice.';
            case 'bank':
                return `Bank transfer details: ${bankDetails}`;
            case 'mobile_money':
                return `Mobile money details: ${mobileDetails}`;
            default:
                return 'Please follow the payment instructions in the invoice.';
        }
    };

    const resetForm = () => {
        setLineItems([{ description: '', quantity: 1, rate: 0 }]);
        setSelectedProjectId('');
        setSelectedClientId('');
        setClientName('');
        setClientEmail('');
        setSearchQuery('');
        setDueDate(defaultDueDateIso());
        setNotes('');
        setPaymentMethod('stripe');
        setBankDetails(tenantDefaults.bank);
        setMobileDetails(tenantDefaults.mobile);
        setTaxRate(0);
        setDiscountAmount(0);
        setSignatureData(null);
        setSignatureType('draw');
        setTypedSignature('');
        setEnablePaymentLinks(true);
        setAttachments([]);
        setCreatedInvoiceId(null);
        setCreatedInvoice(null);
        setSendOutcome(null);
        setStep('edit');
    };

    const handleDownloadPDF = async () => {
        if (!createdInvoice) return;
        try {
            const { businessInvoiceService } = await import('../../services/businessInvoiceService');
            const doc = businessInvoiceService.generatePDF(
                createdInvoice,
                currentTenant,
                selectedClient || { name: clientName || searchQuery || 'Valued Client', email: clientEmail },
                signatureData ? { type: signatureType, data: signatureData } : undefined
            );
            doc.save(`Invoice-${createdInvoice.invoiceNumber}.pdf`);
            toast.success('Invoice PDF downloaded');
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            toast.error('Failed to generate PDF');
        }
    };

    const handleCopyPaymentLink = async () => {
        if (!createdInvoiceId || !currentTenant?.id) return;
        try {
            const response = await fetch(`/api/invoices/${encodeURIComponent(createdInvoiceId)}/public-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id }),
            });
            const payload = await response.json().catch(() => ({}));
            const paymentUrl = payload?.url || sendOutcome?.actionUrl || `${window.location.origin}/invoice/${createdInvoiceId}`;
            await navigator.clipboard.writeText(paymentUrl);
            toast.success('Public invoice link copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy payment link:', err);
            toast.error('Failed to copy link');
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!isOpen) return null;

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const selectedClient = clients.find(c => c.id === selectedClientId);
    const effectiveClientName = selectedClient?.name || clientName.trim() || searchQuery.trim();
    const canProceedFromEdit = Boolean(effectiveClientName) && Boolean(dueDate) && calculateTotal() > 0;
    const canSendDirectly = canProceedFromEdit && areAllEmailsValid(clientEmail);

    return (
        <div className="fixed inset-0 ac-layer-modal flex items-center justify-center bg-black/90 p-4">
            <div className={`flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} shadow-none`}>
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-[var(--ws-border)] p-6">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--ws-text-primary)] flex items-center gap-2">
                            <DollarSign className="w-6 h-6 text-teal-400" />
                            {currentTenant?.name || 'Business'} Invoice
                        </h2>
                        <p className="type-card-description text-[var(--ws-text-muted)] mt-1">
                            {step === 'edit' && 'Select recipient, attach documents, and configure invoice details'}
                            {step === 'preview' && 'Review invoice, recipient email, and attachments before sending'}
                            {step === 'success' && (sendOutcome?.sent ? 'Invoice sent and accepted by email provider' : 'Invoice saved')}
                        </p>
                    </div>
                    <button onClick={handleClose} className="text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    {/* STEP 1: Edit Details */}
                    {step === 'edit' && (
                        <div className="space-y-6">
                            <PaymentRailBanner compact />

                            {/* Public Invoice & Payment Link Toggle */}
                            <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-4 border-teal-500/20`}>
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-teal-400 font-bold type-ui">Public Invoice & Online Payment Link</h3>
                                        <p className="text-[var(--ws-text-muted)] type-card-description mt-0.5">
                                            Allows your client to view the invoice online, download the PDF, and pay without logging in.
                                        </p>
                                    </div>
                                    <label className="flex items-center space-x-2 shrink-0 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={enablePaymentLinks}
                                            onChange={(e) => setEnablePaymentLinks(e.target.checked)}
                                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                        />
                                        <span className="type-ui text-[var(--ws-text-primary)] font-medium">Enabled</span>
                                    </label>
                                </div>
                            </div>

                            {/* Template Selector */}
                            <div className="border-b border-[var(--ws-border)] pb-6">
                                <h3 className="text-[var(--ws-text-primary)] font-bold mb-3 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-teal-400" />
                                    Choose Style
                                </h3>
                                <div className="grid grid-cols-5 gap-2">
                                    {[
                                        { id: 1, name: 'Classic', color: 'bg-white' },
                                        { id: 2, name: 'Modern', color: 'bg-teal-50' },
                                        { id: 3, name: 'Dark', color: 'bg-[var(--ws-panel)] border border-[var(--ws-border-strong)]' },
                                        { id: 4, name: 'Minimal', color: 'bg-gray-50' },
                                        { id: 5, name: 'Bold', color: 'bg-slate-200' }
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setSelectedTemplate(t.id as any)}
                                            className={`relative aspect-[3/4] rounded-lg border-2 transition-all overflow-hidden group ${selectedTemplate === t.id ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-[var(--ws-border)] hover:border-slate-500'}`}
                                        >
                                            <div className={`absolute inset-0 ${t.color} opacity-50`} />
                                            <div className="absolute inset-x-2 top-2 h-2 bg-current opacity-20 rounded-sm" />
                                            <div className="absolute inset-x-2 top-5 bottom-2 bg-current opacity-10 rounded-sm" />
                                            <span className="absolute bottom-2 inset-x-2 type-caption font-medium text-[var(--ws-text-primary)] text-center bg-black/50 rounded py-1">
                                                {t.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Client, Recipient Email, and Project Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="relative" ref={dropdownRef}>
                                    <label className="block type-label font-medium text-[var(--ws-text-secondary)] mb-2">Client *</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ws-text-muted)] pointer-events-none">
                                            <Users size={16} />
                                        </div>
                                        <AlphaCloneInput
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSearchQuery(val);
                                                setClientName(val);
                                                setShowContactDropdown(true);
                                                setHighlightedClientIndex(0);
                                                if (selectedClientId) {
                                                    const current = clients.find((c) => c.id === selectedClientId);
                                                    if (current && current.name !== val) {
                                                        setSelectedClientId('');
                                                    }
                                                }
                                            }}
                                            onFocus={() => setShowContactDropdown(true)}
                                            onKeyDown={(e) => {
                                                if (!showContactDropdown) {
                                                    if (e.key === 'ArrowDown') setShowContactDropdown(true);
                                                    return;
                                                }
                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    setHighlightedClientIndex((prev) =>
                                                        filteredClients.length > 0 ? (prev + 1) % filteredClients.length : 0
                                                    );
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    setHighlightedClientIndex((prev) =>
                                                        filteredClients.length > 0
                                                            ? (prev - 1 + filteredClients.length) % filteredClients.length
                                                            : 0
                                                    );
                                                } else if (e.key === 'Enter' && filteredClients[highlightedClientIndex]) {
                                                    e.preventDefault();
                                                    handleSelectClient(filteredClients[highlightedClientIndex]);
                                                } else if (e.key === 'Escape') {
                                                    setShowContactDropdown(false);
                                                }
                                            }}
                                            placeholder="Search existing clients or type a client name..."
                                            className="w-full pl-10 pr-8 py-2"
                                        />
                                        {(selectedClientId || searchQuery) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedClientId('');
                                                    setClientName('');
                                                    setClientEmail('');
                                                    setSearchQuery('');
                                                }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]"
                                                title="Clear client"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <AnimatePresence>
                                        {showContactDropdown && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className={`absolute z-[100] mt-2 max-h-60 w-full overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} shadow-none`}
                                            >
                                                {filteredClients.length > 0 ? (
                                                    filteredClients.map((c, idx) => (
                                                        <button
                                                            key={c.id}
                                                            type="button"
                                                            onClick={() => handleSelectClient(c)}
                                                            className={`w-full text-left p-2.5 rounded-lg flex items-center gap-3 transition-colors group ${
                                                                idx === highlightedClientIndex || c.id === selectedClientId
                                                                    ? 'bg-teal-500/15 border border-teal-500/30'
                                                                    : 'hover:bg-[var(--ws-hover)]'
                                                            }`}
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shrink-0">
                                                                <span className="text-teal-400 type-caption font-black">{c.name?.charAt(0)?.toUpperCase() || 'C'}</span>
                                                            </div>
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <span className="type-ui font-bold text-[var(--ws-text-primary)] truncate">{c.name}</span>
                                                                <span className="type-caption text-[var(--ws-text-muted)] truncate">
                                                                    {c.email || 'No email on file'}
                                                                </span>
                                                            </div>
                                                            {c.id === selectedClientId && (
                                                                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                                                            )}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="p-3 text-center">
                                                        <p className="type-card-description text-[var(--ws-text-muted)]">
                                                            Using custom client: <span className="text-[var(--ws-text-primary)] font-semibold">{searchQuery}</span>
                                                        </p>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div>
                                    <label className="block type-label font-medium text-[var(--ws-text-secondary)] mb-2">
                                        Recipient Email(s) *
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ws-text-muted)] pointer-events-none">
                                            <Mail size={16} />
                                        </div>
                                        <AlphaCloneInput
                                            type="text"
                                            value={clientEmail}
                                            onChange={(e) => setClientEmail(e.target.value)}
                                            placeholder="client@company.com (comma-separated for multiple)"
                                            className="w-full pl-10 pr-3 py-2"
                                        />
                                    </div>
                                    {selectedClientId && !clientEmail.trim() && (
                                        <p className="type-caption text-amber-400 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            Selected client has no email on file — enter a recipient email above.
                                        </p>
                                    )}
                                    {clientEmail.trim() && !areAllEmailsValid(clientEmail) && (
                                        <p className="type-caption text-red-400 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                            Enter valid email address(es), separated by commas.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Project and Due Date */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block type-label font-medium text-[var(--ws-text-secondary)] mb-2">Project (Optional)</label>
                                    <AlphaCloneSelect
                                        value={selectedProjectId}
                                        onChange={(e) => setSelectedProjectId(e.target.value)}
                                        className="w-full px-3 py-2"
                                    >
                                        <option value="">Select a project</option>
                                        {projects.map((project) => (
                                            <option key={project.id} value={project.id}>
                                                {project.name}
                                            </option>
                                        ))}
                                    </AlphaCloneSelect>
                                </div>

                                <div>
                                    <label className="block type-label font-medium text-[var(--ws-text-secondary)] mb-2">Due Date *</label>
                                    <AlphaCloneInput
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full px-3 py-2"
                                    />
                                </div>
                            </div>

                            {/* Attachments Section */}
                            <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-4`}>
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="text-[var(--ws-text-primary)] font-bold type-ui flex items-center gap-2">
                                            <Paperclip className="w-4 h-4 text-teal-400" />
                                            Invoice Attachments
                                        </h3>
                                        <p className="type-caption text-[var(--ws-text-muted)] mt-0.5">
                                            The formatted Invoice PDF is always attached automatically. Add supporting documents if needed (max 10 MB each).
                                        </p>
                                    </div>
                                    <div>
                                        <input
                                            ref={attachmentInputRef}
                                            type="file"
                                            multiple
                                            accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt,.doc,.docx,.xls,.xlsx"
                                            onChange={handleUploadAttachment}
                                            className="hidden"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => attachmentInputRef.current?.click()}
                                            disabled={isUploadingAttachment}
                                            className="flex items-center gap-2 text-xs py-1.5 px-3"
                                        >
                                            <Upload className="w-3.5 h-3.5" />
                                            {isUploadingAttachment ? 'Uploading...' : 'Add Attachment'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/20">
                                        <div className="flex items-center gap-2 text-xs text-teal-300 font-medium">
                                            <FileText className="w-4 h-4 text-teal-400 shrink-0" />
                                            <span>Invoice PDF (Generated automatically on send)</span>
                                        </div>
                                        <span className="type-caption text-teal-400 font-semibold uppercase">Auto-attached</span>
                                    </div>

                                    {attachments.map((att) => (
                                        <div
                                            key={att.storagePath}
                                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--ws-surface-secondary)] border border-[var(--ws-border)]"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Paperclip className="w-4 h-4 text-[var(--ws-text-muted)] shrink-0" />
                                                <span className="type-ui text-[var(--ws-text-primary)] truncate">{att.name}</span>
                                                {att.size ? (
                                                    <span className="type-caption text-[var(--ws-text-muted)] shrink-0">
                                                        ({(att.size / 1024).toFixed(1)} KB)
                                                    </span>
                                                ) : null}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAttachment(att)}
                                                className="text-red-400 hover:text-red-300 p-1"
                                                title="Remove attachment"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block type-label font-medium text-[var(--ws-text-secondary)] mb-2">Payment Method *</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {[
                                        { value: 'stripe', label: 'Online Payment (Stripe)', icon: '💳' },
                                        { value: 'bank', label: 'Bank Transfer', icon: '🏦' },
                                        { value: 'mobile_money', label: 'Mobile Money', icon: '📱' }
                                    ].map((method) => (
                                        <button
                                            key={method.value}
                                            onClick={() => setPaymentMethod(method.value as any)}
                                            className={`p-3 rounded-lg border-2 transition-all ${paymentMethod === method.value
                                                ? 'border-teal-500 bg-teal-500/10'
                                                : 'border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] hover:border-slate-600'
                                                }`}
                                        >
                                            <div className="text-2xl mb-1">{method.icon}</div>
                                            <div className="text-[var(--ws-text-primary)] type-ui font-medium">{method.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Payment Details */}
                            {paymentMethod === 'bank' && (
                                <div>
                                    <label className="block type-label font-medium text-[var(--ws-text-secondary)] mb-2">Bank Details *</label>
                                    <AlphaCloneTextarea
                                        value={bankDetails}
                                        onChange={(e) => setBankDetails(e.target.value)}
                                        placeholder="Bank Name\nAccount Number\nBranch Code\nAccount Holder Name"
                                        className="w-full px-3 py-2"
                                        rows={4}
                                    />
                                </div>
                            )}

                            {paymentMethod === 'mobile_money' && (
                                <div>
                                    <label className="block type-label font-medium text-[var(--ws-text-secondary)] mb-2">Mobile Money Details *</label>
                                    <Input
                                        value={mobileDetails}
                                        onChange={(e) => setMobileDetails(e.target.value)}
                                        placeholder="Phone Number or Wallet ID"
                                    />
                                </div>
                            )}

                            <p className="type-card-description text-[var(--ws-text-muted)] leading-relaxed border border-[var(--ws-border)]/60 rounded-lg px-3 py-2 bg-[var(--ws-panel)]">
                                Save your services and default prices under{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        router.push('/dashboard/business/settings');
                                    }}
                                    className="text-teal-400 hover:text-[var(--brand-blue-300)] font-medium underline-offset-2 hover:underline"
                                >
                                    Business settings
                                </button>
                                {' '}so repeat invoices pre-fill line items.
                            </p>

                            {/* Line Items */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-[var(--ws-text-primary)] font-bold">Line Items</h3>
                                    <button
                                        onClick={addLineItem}
                                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-[var(--text-inverse)] type-ui rounded-lg flex items-center gap-2 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Item
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {lineItems.map((item, index) => (
                                        <div key={index} className="relative bg-[var(--ws-panel)] p-4 rounded-xl border border-[var(--ws-border)] hover:border-[var(--ws-border)] transition-all">
                                            {/* Service Quick Select for empty items */}
                                            {item.description === '' && (
                                                <div className="mb-4">
                                                    <label className="block type-caption font-bold text-teal-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                        <Sparkles className="w-3 h-3" />
                                                        Quick Select Service
                                                    </label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {UNIVERSAL_SERVICE_CATALOG
                                                            .filter(cat => userSectors.length === 0 || userSectors.includes(cat.name))
                                                            .flatMap(cat => cat.services)
                                                            .slice(0, 8) // Show top candidates or first few
                                                            .map(service => (
                                                                <button
                                                                    key={service.id}
                                                                    onClick={() => {
                                                                        const newItems = [...lineItems];
                                                                        newItems[index] = {
                                                                            description: service.name,
                                                                            quantity: 1,
                                                                            rate: service.defaultPrice
                                                                        };
                                                                        setLineItems(newItems);
                                                                    }}
                                                                    className="px-3 py-1.5 bg-[var(--ws-canvas)] border border-[var(--ws-border)] hover:border-teal-500/50 hover:bg-teal-500/5 rounded-lg type-caption text-[var(--ws-text-secondary)] transition-all"
                                                                >
                                                                    {service.name}
                                                                </button>
                                                            ))}

                                                        <AlphaCloneSelect
                                                            className="px-3 py-1.5"
                                                            onChange={(e) => {
                                                                if (!e.target.value) return;
                                                                const service = UNIVERSAL_SERVICE_CATALOG
                                                                    .flatMap(cat => cat.services)
                                                                    .find(s => s.id === e.target.value);
                                                                if (service) {
                                                                    const newItems = [...lineItems];
                                                                    newItems[index] = {
                                                                        description: service.name,
                                                                        quantity: 1,
                                                                        rate: service.defaultPrice
                                                                    };
                                                                    setLineItems(newItems);
                                                                }
                                                            }}
                                                            value=""
                                                        >
                                                            <option value="">More services...</option>
                                                            {UNIVERSAL_SERVICE_CATALOG
                                                                .filter(cat => userSectors.length === 0 || userSectors.includes(cat.name))
                                                                .map(cat => (
                                                                    <optgroup key={cat.name} label={cat.name}>
                                                                        {cat.services.map(s => (
                                                                            <option key={s.id} value={s.id}>{s.name} (${s.defaultPrice})</option>
                                                                        ))}
                                                                    </optgroup>
                                                                ))}
                                                        </AlphaCloneSelect>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                                <div className="md:col-span-6">
                                                    <Input
                                                        label={index === 0 ? "Description *" : ""}
                                                        value={item.description}
                                                        onChange={(e) => {
                                                            const newItems = [...lineItems];
                                                            newItems[index].description = e.target.value;
                                                            setLineItems(newItems);
                                                        }}
                                                        placeholder="e.g. Logo Design"
                                                    />
                                                </div>
                                                <div className="md:col-span-2">
                                                    <Input
                                                        label={index === 0 ? "Qty *" : ""}
                                                        type="number"
                                                        value={item.quantity.toString()}
                                                        onChange={(e) => {
                                                            const newItems = [...lineItems];
                                                            newItems[index].quantity = parseInt(e.target.value) || 0;
                                                            setLineItems(newItems);
                                                        }}
                                                        min="1"
                                                    />
                                                </div>
                                                <div className="md:col-span-3">
                                                    <Input
                                                        label={index === 0 ? "Rate ($) *" : ""}
                                                        type="number"
                                                        value={item.rate.toString()}
                                                        onChange={(e) => {
                                                            const newItems = [...lineItems];
                                                            newItems[index].rate = parseFloat(e.target.value) || 0;
                                                            setLineItems(newItems);
                                                        }}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div className="md:col-span-1">
                                                    {lineItems.length > 1 && (
                                                        <button
                                                            onClick={() => removeLineItem(index)}
                                                            className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                                                        >
                                                            <X className="w-4 h-4 mx-auto" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="text-right type-ui text-[var(--ws-text-muted)] mt-2">
                                                Subtotal: ${(item.quantity * item.rate).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tax and Discount */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block type-label font-medium text-[var(--ws-text-secondary)] mb-2">Tax country</label>
                                    <AlphaCloneSelect
                                        value={taxCountry}
                                        onChange={(e) => {
                                            const code = e.target.value;
                                            setTaxCountry(code);
                                            const lookup = getTaxRateForCountry(code);
                                            if (lookup.rate > 0) setTaxRate(lookup.rate);
                                        }}
                                        className={`w-full h-10 bg-[var(--ws-toolbar)] border border-[var(--ws-border)] ${WORKSPACE.panel.radius} px-3 type-ui text-[var(--ws-text-primary)] outline-none`}
                                    >
                                        <option value="ZW">Zimbabwe (15% VAT)</option>
                                        <option value="ZA">South Africa</option>
                                        <option value="KE">Kenya</option>
                                        <option value="GH">Ghana</option>
                                        <option value="NG">Nigeria</option>
                                        <option value="GB">United Kingdom</option>
                                        <option value="US">United States</option>
                                    </AlphaCloneSelect>
                                </div>
                                <div>
                                    <label className="block type-label font-medium text-[var(--ws-text-secondary)] mb-2">Tax Rate (%)</label>
                                    <Input
                                        type="number"
                                        value={taxRate.toString()}
                                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        min="0"
                                        max="100"
                                    />
                                </div>

                                <div>
                                    <label className="block type-label font-medium text-[var(--ws-text-secondary)] mb-2">Discount ($)</label>
                                    <Input
                                        type="number"
                                        value={discountAmount.toString()}
                                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Total */}
                            <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-4`}>
                                <div className="space-y-2 type-ui">
                                    <div className="flex justify-between text-[var(--ws-text-secondary)]">
                                        <span>Subtotal:</span>
                                        <span>${calculateSubtotal().toFixed(2)}</span>
                                    </div>
                                    {taxRate > 0 && (
                                        <div className="flex justify-between text-[var(--ws-text-secondary)]">
                                            <span>Tax ({taxRate}%):</span>
                                            <span>${calculateTax().toFixed(2)}</span>
                                        </div>
                                    )}
                                    {discountAmount > 0 && (
                                        <div className="flex justify-between text-red-400">
                                            <span>Discount:</span>
                                            <span>-${discountAmount.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="border-t border-slate-600 pt-2 flex justify-between font-bold text-[var(--ws-text-primary)] text-lg">
                                        <span>Total:</span>
                                        <span>${calculateTotal().toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Digital Signature */}
                            <div className="border-t border-[var(--ws-border)] pt-6">
                                <h3 className="text-[var(--ws-text-primary)] font-bold mb-3 flex items-center gap-2">
                                    <PenLine className="w-5 h-5 text-teal-400" />
                                    Digital Signature (Optional)
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setSignatureType('draw')}
                                            className={`px-4 py-2 rounded-lg type-ui font-medium transition-colors ${signatureType === 'draw'
                                                ? 'bg-teal-600 text-[var(--text-inverse)]'
                                                : 'bg-[var(--ws-surface-secondary)] text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-tertiary)]'
                                                }`}
                                        >
                                            Draw Signature
                                        </button>
                                        <button
                                            onClick={() => setSignatureType('type')}
                                            className={`px-4 py-2 rounded-lg type-ui font-medium transition-colors ${signatureType === 'type'
                                                ? 'bg-teal-600 text-[var(--text-inverse)]'
                                                : 'bg-[var(--ws-surface-secondary)] text-[var(--ws-text-secondary)] hover:bg-[var(--ws-surface-tertiary)]'
                                                }`}
                                        >
                                            Type Signature
                                        </button>
                                    </div>

                                    {signatureType === 'draw' && (
                                        <div className="bg-white rounded-lg p-2 border border-[var(--ws-border)]">
                                            <canvas
                                                ref={canvasRef}
                                                className="cursor-crosshair w-full bg-white touch-none"
                                                style={{ height: '150px' }}
                                            />
                                            <div className="flex justify-between mt-2">
                                                <p className="type-caption text-[var(--ws-text-muted)] uppercase font-bold">Sign here</p>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        const canvas = canvasRef.current;
                                                        if (canvas) {
                                                            const ctx = canvas.getContext('2d');
                                                            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                                                            setSignatureData(null);
                                                        }
                                                    }}
                                                    className="type-caption text-red-500 hover:text-red-400 font-bold"
                                                >
                                                    Clear Signature
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {signatureType === 'type' && (
                                        <Input
                                            label="Type your signature"
                                            value={typedSignature}
                                            onChange={(e) => setTypedSignature(e.target.value)}
                                            placeholder="John Doe"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Preview */}
                    {step === 'preview' && (
                        <div className="space-y-6">
                            <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-4 flex items-start gap-3 border-teal-500/20`}>
                                <FileText className="w-5 h-5 text-teal-400 mt-0.5" />
                                <div>
                                    <h3 className="text-teal-400 font-bold type-ui">Invoice Preview</h3>
                                    <p className="text-[var(--ws-text-muted)] type-card-description mt-1">
                                        Review your invoice details, recipient email, and attachments before saving or sending.
                                    </p>
                                </div>
                            </div>

                            {/* Invoice Preview */}
                            <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-6 text-[var(--ws-text-primary)]`}>
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold">{currentTenant?.name || 'Business Name'}</h2>
                                        <p className="text-[var(--ws-text-muted)]">Invoice</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">Invoice #INV-{Date.now().toString().slice(-6)}</p>
                                        <p className="text-[var(--ws-text-muted)]">Due: {dueDate}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <h3 className="font-bold mb-2">Bill To:</h3>
                                        <p>{effectiveClientName || 'Client Name'}</p>
                                        <p className="text-[var(--ws-text-muted)]">{clientEmail || selectedClient?.email || 'No email specified'}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-bold mb-2">Project:</h3>
                                        <p>{selectedProject?.name || 'General Services'}</p>
                                    </div>
                                </div>

                                <div className="overflow-x-auto min-w-0 mb-6">
                                <table className="w-full min-w-[400px]">
                                    <thead>
                                        <tr className="border-b-2 border-[var(--ws-border)]">
                                            <th className="text-left py-2">Description</th>
                                            <th className="text-right py-2">Qty</th>
                                            <th className="text-right py-2">Rate</th>
                                            <th className="text-right py-2">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineItems.filter(item => item.description.trim()).map((item, index) => (
                                            <tr key={index} className="border-b border-[var(--ws-border)]/50">
                                                <td className="py-2">{item.description}</td>
                                                <td className="text-right py-2">{item.quantity}</td>
                                                <td className="text-right py-2">${item.rate.toFixed(2)}</td>
                                                <td className="text-right py-2">${(item.quantity * item.rate).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                </div>

                                <div className="flex justify-end">
                                    <div className="w-64">
                                        <div className="space-y-2 type-ui">
                                            <div className="flex justify-between">
                                                <span>Subtotal:</span>
                                                <span>${calculateSubtotal().toFixed(2)}</span>
                                            </div>
                                            {taxRate > 0 && (
                                                <div className="flex justify-between">
                                                    <span>Tax ({taxRate}%):</span>
                                                    <span>${calculateTax().toFixed(2)}</span>
                                                </div>
                                            )}
                                            {discountAmount > 0 && (
                                                <div className="flex justify-between text-red-400">
                                                    <span>Discount:</span>
                                                    <span>-${discountAmount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-[var(--ws-border)] pt-2 flex justify-between font-bold text-lg">
                                                <span>Total:</span>
                                                <span>${calculateTotal().toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {signatureData && (
                                    <div className="mt-6">
                                        <p className="text-[var(--ws-text-muted)] mb-2">Authorized Signature:</p>
                                        <div className="bg-slate-200/10 inline-block p-2 rounded relative h-16 w-32 overflow-hidden">
                                            <Image
                                                src={signatureData}
                                                alt="Signature"
                                                fill
                                                className="object-contain invert"
                                                unoptimized
                                            />
                                        </div>
                                    </div>
                                )}

                                {typedSignature && (
                                    <div className="mt-6">
                                        <p className="text-[var(--ws-text-muted)] mb-2">Authorized Signature:</p>
                                        <p className="text-2xl font-script text-[var(--ws-text-primary)]">{typedSignature}</p>
                                    </div>
                                )}
                            </div>

                            {/* Delivery & Attachments Summary */}
                            <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-4`}>
                                <h4 className="text-[var(--ws-text-primary)] font-bold mb-2">Delivery & Attachments Summary</h4>
                                <div className="space-y-2 type-ui text-[var(--ws-text-secondary)]">
                                    <div className="flex justify-between">
                                        <span>Recipient Email:</span>
                                        <span className={areAllEmailsValid(clientEmail) ? "text-teal-400 font-medium" : "text-amber-400"}>
                                            {clientEmail.trim() || 'No email specified (Draft only)'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Attachments Included:</span>
                                        <span className="text-[var(--ws-text-primary)]">
                                            Invoice PDF{attachments.length > 0 ? ` + ${attachments.length} file(s)` : ''}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Public Invoice & Payment Link:</span>
                                        <span className={enablePaymentLinks ? "text-green-400" : "text-red-400"}>
                                            {enablePaymentLinks ? "Enabled" : "Disabled"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Success */}
                    {step === 'success' && (
                        <div className="text-center space-y-6">
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                                <CheckCircle className="w-10 h-10 text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-[var(--ws-text-primary)] mb-2">
                                {sendOutcome?.sent
                                    ? 'Invoice Sent to Client!'
                                    : sendOutcome?.status === 'queued'
                                        ? 'Invoice Queued for Delivery'
                                        : 'Invoice Saved as Draft'}
                            </h3>
                            <p className="text-[var(--ws-text-muted)] max-w-md mx-auto mb-6">
                                {sendOutcome?.sent
                                    ? `Invoice #${createdInvoice?.invoiceNumber || ''} was emailed to ${clientEmail} with the PDF${attachments.length > 0 ? ` and ${attachments.length} attachment(s)` : ''}.`
                                    : sendOutcome?.status === 'queued'
                                        ? `Invoice #${createdInvoice?.invoiceNumber || ''} is queued for email delivery to ${clientEmail}.`
                                        : `Invoice #${createdInvoice?.invoiceNumber || ''} has been saved. You can send it via email now or download the PDF.`}
                            </p>

                            {sendOutcome && (
                                <div className="max-w-md mx-auto rounded-lg border border-[var(--ws-border)] bg-[var(--ws-panel)] p-3 text-left type-caption space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-[var(--ws-text-muted)]">Invoice Status:</span>
                                        <span className="text-[var(--ws-text-primary)] font-semibold uppercase">
                                            {sendOutcome.sent ? 'SENT' : 'DRAFT'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-[var(--ws-text-muted)]">Email Delivery Status:</span>
                                        <span className={sendOutcome.sent ? 'text-teal-400 font-semibold uppercase' : 'text-amber-400 font-semibold uppercase'}>
                                            {sendOutcome.status || (sendOutcome.sent ? 'PROVIDER_ACCEPTED' : 'NOT_SENT')}
                                        </span>
                                    </div>
                                    {sendOutcome.provider && (
                                        <div className="flex justify-between">
                                            <span className="text-[var(--ws-text-muted)]">Email Provider:</span>
                                            <span className="text-[var(--ws-text-secondary)]">{sendOutcome.provider}</span>
                                        </div>
                                    )}
                                    {sendOutcome.emailId && (
                                        <div className="flex justify-between">
                                            <span className="text-[var(--ws-text-muted)]">Provider Message ID:</span>
                                            <span className="text-[var(--ws-text-secondary)] truncate max-w-[200px]">{sendOutcome.emailId}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Send Now if saved as draft */}
                            {!sendOutcome?.sent && createdInvoiceId && (
                                <div className="w-full max-w-sm mx-auto">
                                    <Button
                                        onClick={handleSendCreatedInvoice}
                                        disabled={isSending || !areAllEmailsValid(clientEmail)}
                                        className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-[var(--text-inverse)] font-bold rounded-lg flex items-center justify-center gap-2"
                                    >
                                        {isSending ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Sending Invoice Email...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                Send Invoice via Email ({clientEmail || 'Add email first'})
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {/* Payment Link - Only show if enabled */}
                            {enablePaymentLinks && (
                                <div className="w-full max-w-sm mb-6 mx-auto">
                                    <button
                                        onClick={handleCopyPaymentLink}
                                        className="w-full py-3 bg-[var(--ws-surface-secondary)] hover:bg-[var(--ws-surface-tertiary)] border border-[var(--ws-border)] text-[var(--ws-text-primary)] font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Copy Public Invoice & Payment Link
                                    </button>
                                    <p className="type-card-description text-[var(--ws-text-muted)] text-center mt-2">
                                        Clients can view the invoice and pay without a portal login
                                    </p>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                                <Button variant="outline" onClick={handleDownloadPDF} className="w-full sm:w-auto">
                                    <Download className="w-4 h-4 mr-2" />
                                    Download PDF
                                </Button>
                                <Button onClick={handleClose} className="w-full sm:w-auto">
                                    Done
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer — always visible */}
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--ws-border)] bg-[var(--ws-panel)] p-4 sm:p-6">
                    <div className="type-ui text-[var(--ws-text-muted)]">
                        Total: <span className="text-[var(--ws-text-primary)] font-bold">${calculateTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                        {step === 'edit' && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleClose}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setStep('preview')}
                                    disabled={!canProceedFromEdit}
                                    className="flex items-center gap-2"
                                >
                                    <Eye className="w-4 h-4" />
                                    Preview
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => handleSubmit(false)}
                                    disabled={isSubmitting || !canProceedFromEdit}
                                    className="flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Draft
                                </Button>
                                <Button
                                    onClick={() => handleSubmit(true)}
                                    disabled={isSubmitting || !canSendDirectly}
                                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Send Invoice
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                        {step === 'preview' && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setStep('edit')}
                                    disabled={isSubmitting}
                                >
                                    <Edit3 className="w-4 h-4 mr-2" />
                                    Back to Edit
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => handleSubmit(false)}
                                    disabled={isSubmitting || !canProceedFromEdit}
                                    className="flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Draft
                                </Button>
                                <Button
                                    onClick={() => handleSubmit(true)}
                                    disabled={isSubmitting || !canSendDirectly}
                                    className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Send Invoice Now
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                        {step === 'success' && (
                            <Button onClick={handleClose}>
                                Close
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateInvoiceModal;
