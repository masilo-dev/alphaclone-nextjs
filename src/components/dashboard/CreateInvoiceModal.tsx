import React, { useState, useRef } from 'react';
import { X, DollarSign, FileText, CheckCircle, Edit3, Save, Download, PenLine, Copy, List, Plus } from 'lucide-react';
import { Button, Input } from '../ui/UIComponents';
import { paymentService } from '../../services/paymentService';
import { Project } from '../../types';
import toast from 'react-hot-toast';
import { useTenant } from '../../contexts/TenantContext';
import { UNIVERSAL_SERVICE_CATALOG, ServiceItem } from '../../services/universalServiceCatalog';
import { ChevronDown, Sparkles } from 'lucide-react';


interface LineItem {
    description: string;
    quantity: number;
    rate: number;
}

interface CreateInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInvoiceCreated: () => void;
    projects: Project[];
}

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({ isOpen, onClose, onInvoiceCreated, projects }) => {
    const { currentTenant } = useTenant();
    const [step, setStep] = useState<'edit' | 'preview' | 'success'>('edit');

    // Form state
    const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', quantity: 1, rate: 0 }]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'bank' | 'mobile_money'>('stripe');
    const [bankDetails, setBankDetails] = useState('');
    const [mobileDetails, setMobileDetails] = useState('');
    const [taxRate, setTaxRate] = useState<number>(0);
    const [discountAmount, setDiscountAmount] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
    const [createdInvoice, setCreatedInvoice] = useState<any | null>(null);
    const [signatureData, setSignatureData] = useState<string | null>(null);
    const [signatureType, setSignatureType] = useState<'draw' | 'type'>('draw');
    const [typedSignature, setTypedSignature] = useState('');
    const [userSectors, setUserSectors] = useState<string[]>([]);
    const [myServices, setMyServices] = useState<Record<string, any>>({});
    const [showServiceDropdown, setShowServiceDropdown] = useState<{ index: number; open: boolean }>({ index: -1, open: false });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);

    // Fetch tenant defaults
    const [tenantDefaults, setTenantDefaults] = useState({ bank: '', mobile: '', organizationName: '' });

    React.useEffect(() => {
        const fetchDefaults = async () => {
            const { supabase } = await import('../../lib/supabase');
            const { tenantService } = await import('../../services/tenancy/TenantService');
            // Use businessClientService instead of userService
            const { businessClientService } = await import('../../services/businessClientService');
            const tenantId = tenantService.getCurrentTenantId();

            if (tenantId) {
                const [settingsRes, clientsRes] = await Promise.all([
                    supabase
                        .from('business_settings')
                        .select('bank_details, mobile_payment_details, organization_name')
                        .eq('tenant_id', tenantId)
                        .maybeSingle(),
                    // Fetch Business Clients
                    businessClientService.getClients(tenantId)
                ]);

                if (settingsRes.data) {
                    const defaults = {
                        bank: settingsRes.data.bank_details || '',
                        mobile: settingsRes.data.mobile_payment_details || '',
                        organizationName: settingsRes.data.organization_name || ''
                    };
                    setTenantDefaults(defaults);

                    // Pre-fill editable fields
                    setBankDetails(defaults.bank);
                    setMobileDetails(defaults.mobile);

                    // Fetch service sectors and custom services from JSONB
                    if (settingsRes.data.settings) {
                        if (settingsRes.data.settings.service_sectors) {
                            setUserSectors(settingsRes.data.settings.service_sectors);
                        }
                        if (settingsRes.data.settings.my_services) {
                            setMyServices(settingsRes.data.settings.my_services);
                        }
                    }
                }

                if (clientsRes.clients) {
                    setClients(clientsRes.clients);
                }
            }
        };
        if (isOpen) {
            fetchDefaults();
            // Reset to edit step when modal opens
            setStep('edit');
        }
    }, [isOpen]);

    const handleMethodChange = (method: 'stripe' | 'bank' | 'mobile_money') => {
        setPaymentMethod(method);
    };

    const handleGeneratePreview = () => {
        if (!dueDate || lineItems.some(item => !item.description || item.rate <= 0 || item.quantity <= 0)) {
            toast.error('Please fill in all line items with valid amounts');
            return;
        }

        setStep('preview');
        toast.success('Invoice preview generated');
    };

    const getSubtotal = () => lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const getTaxAmount = () => getSubtotal() * (taxRate / 100);
    const getTotal = () => Math.max(0, getSubtotal() + getTaxAmount() - discountAmount);

    const handleSaveInvoice = async () => {
        if (!currentTenant?.id) {
            toast.error('No active organization session');
            return;
        }

        const invoiceSubtotal = getSubtotal();
        const taxAmount = getTaxAmount();
        const invoiceTotal = getTotal();
        setIsSubmitting(true);

        const project = projects.find(p => p.id === selectedProjectId);
        // Use selected client, or project's linked client. 
        // Do NOT use project.ownerId as it is a User ID, not a Business Client ID.
        const finalClientId = selectedClientId || project?.clientId || undefined;

        try {
            const { businessInvoiceService } = await import('../../services/businessInvoiceService');

            const formattedLineItems = lineItems.map(item => ({
                description: item.description,
                quantity: item.quantity,
                rate: item.rate,
                amount: item.quantity * item.rate
            }));

            // Map to BusinessInvoice schema
            const invoiceData = {
                clientId: finalClientId,
                projectId: selectedProjectId || undefined,
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: dueDate,
                status: 'draft' as const, // Always start as draft, user can send/finalize later
                subtotal: invoiceSubtotal,
                taxRate: taxRate,
                tax: taxAmount,
                discountAmount: discountAmount,
                total: invoiceTotal,
                lineItems: formattedLineItems,
                // Send specific details
                mobilePaymentDetails: mobileDetails,
                signature: signatureType === 'draw' && signatureData ? { type: 'draw' as const, data: signatureData }
                    : signatureType === 'type' && typedSignature ? { type: 'type' as const, data: typedSignature }
                        : undefined,
                // Legacy support / fallback logic handled in service/PDF
                notes: undefined,
                isPublic: false
            };

            const { invoice, error } = await businessInvoiceService.createInvoice(currentTenant.id, invoiceData);

            if (error) {
                console.error('Invoice creation error:', error);
                toast.error(`Failed to create invoice: ${error}`);
            } else if (invoice) {
                setCreatedInvoiceId(invoice.id);
                // Store full invoice for PDF consistency
                setCreatedInvoice(invoice);

                // Auto-save to Document Hub
                try {
                    const { fileUploadService } = await import('../../services/fileUploadService');
                    const client = clients.find(c => c.id === finalClientId);

                    const doc = businessInvoiceService.generatePDF(invoice, currentTenant, client, invoiceData.signature);
                    const pdfBlob = doc.output('blob');
                    const pdfFile = new File([pdfBlob], `Invoice-${invoice.invoiceNumber || invoice.id}.pdf`, { type: 'application/pdf' });

                    await fileUploadService.uploadFile(pdfFile, 'invoice', invoice.id);
                } catch (pdfErr) {
                    console.error('Failed to auto-save invoice PDF to Document Hub:', pdfErr);
                }

                setStep('success');
                toast.success('Invoice created successfully!');
                onInvoiceCreated();
            }
        } catch (err) {
            console.error('Invoice submission error:', err);
            toast.error('Failed to create invoice. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const { businessInvoiceService } = await import('../../services/businessInvoiceService');

            // If we have a finalized invoice, use its data for the PDF
            if (createdInvoice) {
                const client = clients.find(c => c.id === createdInvoice.client_id || createdInvoice.clientId);
                const signature = signatureType === 'draw' && signatureData ? { type: 'draw' as const, data: signatureData }
                    : signatureType === 'type' && typedSignature ? { type: 'type' as const, data: typedSignature }
                        : undefined;

                const doc = businessInvoiceService.generatePDF(createdInvoice, currentTenant, client, signature);
                doc.save(`Invoice-${createdInvoice.invoice_number || createdInvoice.invoiceNumber || createdInvoice.id}.pdf`);
                toast.success('PDF downloaded!');
                return;
            }

            const tenant = currentTenant;
            const project = projects.find(p => p.id === selectedProjectId);
            const client = clients.find(c => c.id === selectedClientId);

            const formattedLineItems = lineItems.map(item => ({
                description: item.description,
                quantity: item.quantity,
                rate: item.rate,
                amount: item.quantity * item.rate
            }));

            const amountNum = getSubtotal();

            // Build invoice object for preview/draft PDF
            const invoiceData = {
                id: 'DRAFT',
                invoiceNumber: `DRAFT-${Date.now().toString().slice(-4)}`,
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: dueDate,
                status: 'draft' as const,
                subtotal: amountNum,
                tax: 0,
                total: amountNum,
                lineItems: formattedLineItems,
                bankDetails: bankDetails,
                mobilePaymentDetails: mobileDetails,
                client: client ? {
                    name: client.name,
                    email: client.email
                } : undefined,
                project: project ? {
                    name: project.name
                } : undefined
            };

            const signature = signatureType === 'draw' && signatureData ? { type: 'draw' as const, data: signatureData }
                : signatureType === 'type' && typedSignature ? { type: 'type' as const, data: typedSignature }
                    : undefined;

            const doc = businessInvoiceService.generatePDF(invoiceData, tenant, invoiceData.client, signature);
            doc.save(`Invoice-${invoiceData.invoiceNumber}.pdf`);
            toast.success('Draft PDF downloaded!');
        } catch (err) {
            console.error('PDF generation error:', err);
            toast.error('Failed to generate PDF');
        }
    };

    const resetForm = () => {
        setLineItems([{ description: '', quantity: 1, rate: 0 }]);
        setSelectedProjectId('');
        setSelectedClientId('');
        setDueDate('');
        setPaymentMethod('stripe');
        setBankDetails(tenantDefaults.bank);
        setMobileDetails(tenantDefaults.mobile);
        setTaxRate(0);
        setDiscountAmount(0);
        setSignatureData(null);
        setSignatureType('draw');
        setTypedSignature('');
        setStep('edit');
    };

    const handleCopyPaymentLink = async () => {
        if (!createdInvoiceId) return;
        try {
            const origin = window.location.origin;
            // Enable public access by marking as public first
            const { businessInvoiceService } = await import('../../services/businessInvoiceService');
            await businessInvoiceService.updateInvoice(createdInvoiceId, { isPublic: true, status: 'sent' });
            const paymentUrl = `${origin}/invoice/${createdInvoiceId}`;
            await navigator.clipboard.writeText(paymentUrl);
            toast.success('Payment link copied to clipboard! Share it with your client.');
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

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-4xl bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl my-8">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <DollarSign className="w-6 h-6 text-teal-400" />
                            {currentTenant?.name || 'Business'} Invoice
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            {step === 'edit' && 'Fill in invoice details'}
                            {step === 'preview' && 'Review invoice before saving'}
                            {step === 'success' && 'Invoice created successfully'}
                        </p>
                    </div>
                    <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {/* STEP 1: Edit Details */}
                    {step === 'edit' && (
                        <div className="space-y-6">
                            <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 flex items-start gap-3">
                                <Edit3 className="w-5 h-5 text-teal-400 mt-0.5" />
                                <div>
                                    <h3 className="text-teal-400 font-bold text-sm">Invoice Details</h3>
                                    <p className="text-slate-400 text-xs mt-1">
                                        Fill in the invoice information. You'll see a preview before saving.
                                    </p>
                                </div>
                            </div>

                            {/* Quick Templates */}
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-[10px] uppercase font-bold"
                                    onClick={() => {
                                        setLineItems([{ description: 'Standard Consultation', quantity: 1, rate: 500 }]);
                                        setDueDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
                                    }}
                                >
                                    ⚡ Standard Template
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 text-[10px] uppercase font-bold"
                                    onClick={() => {
                                        setLineItems([{ description: 'Development Milestone', quantity: 1, rate: 2500 }]);
                                        setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
                                    }}
                                >
                                    ⚡ Dev Milestone
                                </Button>
                            </div>

                            {/* Client & Project Selection */}
                            <div className="border-t border-slate-800 pt-4">
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-teal-400" />
                                    Client & Project (Optional)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Link to Project</label>
                                        <select
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                                            value={selectedProjectId}
                                            onChange={(e) => {
                                                setSelectedProjectId(e.target.value);
                                                if (e.target.value) setSelectedClientId('');
                                            }}
                                        >
                                            <option value="">Standalone Invoice</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {!selectedProjectId && (
                                        <div className="animate-fade-in-down">
                                            <label className="block text-sm font-medium text-slate-300 mb-1">Select Client</label>
                                            <select
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                                                value={selectedClientId}
                                                onChange={(e) => setSelectedClientId(e.target.value)}
                                            >
                                                <option value="">Select a client...</option>
                                                {clients.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Invoice Details */}
                            <div className="border-t border-slate-800 pt-4">
                                <h3 className="text-white font-bold mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-green-400" />
                                        Line Items
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-[10px] uppercase border-teal-500/30 text-teal-400 hover:bg-teal-500/10"
                                            onClick={() => {
                                                const newItems = [...lineItems, { description: '', quantity: 1, rate: 0 }];
                                                setLineItems(newItems);
                                            }}
                                        >
                                            + Add Custom
                                        </Button>
                                    </div>
                                </h3>

                                {/* Select from "My Services" Dropdown */}
                                {Object.keys(myServices).length > 0 && (
                                    <div className="mb-4 p-4 bg-teal-500/5 border border-teal-500/20 rounded-xl">
                                        <label className="block text-[10px] font-bold text-teal-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <List className="w-3 h-3" />
                                            Quick Add from My Services
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(myServices).map(([id, service]: [string, any]) => (
                                                <button
                                                    key={id}
                                                    onClick={() => {
                                                        // Replace the first empty item or add a new one
                                                        const emptyIdx = lineItems.findIndex(item => !item.description);
                                                        if (emptyIdx !== -1) {
                                                            const newItems = [...lineItems];
                                                            newItems[emptyIdx] = {
                                                                description: service.name,
                                                                quantity: 1,
                                                                rate: service.defaultPrice || 0
                                                            };
                                                            setLineItems(newItems);
                                                        } else {
                                                            setLineItems([...lineItems, {
                                                                description: service.name,
                                                                quantity: 1,
                                                                rate: service.defaultPrice || 0
                                                            }]);
                                                        }
                                                        toast.success(`Added ${service.name}`);
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-950 border border-slate-700 hover:border-teal-400 hover:bg-teal-400/10 rounded-lg text-xs text-slate-300 transition-all flex items-center gap-2"
                                                >
                                                    <Plus className="w-3 h-3 text-teal-400" />
                                                    {service.name} (${service.defaultPrice})
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {lineItems.map((item, index) => (
                                        <div key={index} className="relative bg-slate-900/50 p-4 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
                                            {/* Service Quick Select for empty items */}
                                            {item.description === '' && (
                                                <div className="mb-4">
                                                    <label className="block text-[10px] font-bold text-teal-500 uppercase tracking-widest mb-2 flex items-center gap-1">
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
                                                                    className="px-3 py-1.5 bg-slate-950 border border-slate-700 hover:border-teal-500/50 hover:bg-teal-500/5 rounded-lg text-xs text-slate-300 transition-all"
                                                                >
                                                                    {service.name}
                                                                </button>
                                                            ))}

                                                        <select
                                                            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
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
                                                        </select>
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
                                                <div className="md:col-span-1 pb-2 flex justify-end">
                                                    <button
                                                        onClick={() => {
                                                            if (lineItems.length > 1) {
                                                                setLineItems(lineItems.filter((_, i) => i !== index));
                                                            } else {
                                                                setLineItems([{ description: '', quantity: 1, rate: 0 }]);
                                                            }
                                                        }}
                                                        className="text-slate-500 hover:text-red-400 transition-colors p-2"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 flex justify-between items-end">
                                    <div className="w-1/2">
                                        <Input
                                            label="Due Date *"
                                            type="date"
                                            value={dueDate}
                                            onChange={(e) => setDueDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-24">
                                            <Input
                                                label="Tax (%)"
                                                type="number"
                                                value={taxRate.toString()}
                                                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                                                min="0"
                                            />
                                        </div>
                                        <div className="w-24">
                                            <Input
                                                label="Discount ($)"
                                                type="number"
                                                value={discountAmount.toString()}
                                                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                                                min="0"
                                            />
                                        </div>
                                        <div className="text-right ml-4">
                                            <p className="text-slate-400 text-sm">Total</p>
                                            <p className="text-xl font-bold text-white">${getTotal().toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div className="border-t border-slate-800 pt-4">
                                <h3 className="text-white font-bold mb-3">Payment Method</h3>
                                <select
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    value={paymentMethod}
                                    onChange={(e) => handleMethodChange(e.target.value as any)}
                                >
                                    <option value="stripe">Stripe (Card / Online)</option>
                                    <option value="bank">Bank Transfer (Manual)</option>
                                    <option value="mobile_money">Mobile Payment (Manual)</option>
                                </select>

                                {paymentMethod === 'bank' && (
                                    <div className="mt-4 animate-fade-in">
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Bank Transfer Details
                                            <span className="text-xs text-slate-500 ml-2 font-normal">(Editable for this invoice)</span>
                                        </label>
                                        <textarea
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                                            rows={4}
                                            value={bankDetails}
                                            onChange={(e) => setBankDetails(e.target.value)}
                                            placeholder="Bank Name, Account Number, SWIFT Code..."
                                        />
                                    </div>
                                )}

                                {paymentMethod === 'mobile_money' && (
                                    <div className="mt-4 animate-fade-in">
                                        <label className="block text-sm font-medium text-slate-300 mb-1">
                                            Mobile Money Details
                                            <span className="text-xs text-slate-500 ml-2 font-normal">(Editable for this invoice)</span>
                                        </label>
                                        <textarea
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                                            rows={3}
                                            value={mobileDetails}
                                            onChange={(e) => setMobileDetails(e.target.value)}
                                            placeholder="Provider Name, Phone Number, Name..."
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-800">
                                <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">Cancel</Button>
                                <Button onClick={handleGeneratePreview} className="bg-teal-600 hover:bg-teal-500 w-full sm:w-auto">
                                    <Save className="w-4 h-4 mr-2" />
                                    Generate Preview
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Preview Invoice */}
                    {step === 'preview' && (
                        <div className="space-y-6">
                            {/* Invoice Preview Container block */}
                            <div className="bg-white text-black p-4 sm:p-6 md:p-8 rounded-lg border-4 border-slate-700">
                                {/* Header */}
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
                                    {currentTenant?.logo_url && (
                                        <img src={currentTenant.logo_url} alt="Logo" className="h-12 sm:h-16 object-contain" />
                                    )}
                                    <div className="text-left sm:text-right">
                                        <h1 className="text-2xl sm:text-3xl font-bold">INVOICE</h1>
                                        <p className="text-gray-600 text-sm">#{createdInvoiceId || 'DRAFT'}</p>
                                    </div>
                                </div>

                                {/* Business Info */}
                                <div className="mb-8">
                                    <h2 className="font-bold text-base sm:text-lg">
                                        {currentTenant?.name || tenantDefaults?.organizationName || 'Organization Name Missing'}
                                    </h2>
                                    {(!currentTenant?.name && !tenantDefaults?.organizationName) && (
                                        <p className="text-red-500 text-xs mt-1">⚠️ Please set your organization name in Settings</p>
                                    )}
                                    <p className="text-gray-600 text-sm">Professional Services</p>
                                </div>

                                {/* Client Info */}
                                {(selectedProject || selectedClient) && (
                                    <div className="mb-8">
                                        <h3 className="font-bold text-sm mb-2">Bill To:</h3>
                                        <p className="text-gray-800">{selectedProject?.ownerName || selectedClient?.name || 'Client'}</p>
                                        {selectedProject && <p className="text-gray-600 text-sm">Project: {selectedProject.name}</p>}
                                        {selectedClient && <p className="text-gray-600 text-sm">{selectedClient.email}</p>}
                                    </div>
                                )}

                                {/* Invoice Details */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-sm">
                                    <div>
                                        <p className="text-gray-600">Issue Date:</p>
                                        <p className="font-semibold">{new Date().toLocaleDateString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600">Due Date:</p>
                                        <p className="font-semibold">{new Date(dueDate).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                {/* Line Items */}
                                <div className="overflow-x-auto mb-8">
                                    <table className="w-full text-sm">
                                        <thead className="border-b-2 border-gray-300">
                                            <tr>
                                                <th className="text-left py-2">Item Description</th>
                                                <th className="text-right py-2">Qty</th>
                                                <th className="text-right py-2">Rate</th>
                                                <th className="text-right py-2">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lineItems.map((item, idx) => (
                                                <tr key={idx} className="border-b border-gray-100">
                                                    <td className="py-3 font-medium text-gray-800">{item.description}</td>
                                                    <td className="text-right py-3">{item.quantity}</td>
                                                    <td className="text-right py-3">${item.rate.toFixed(2)}</td>
                                                    <td className="text-right py-3 font-semibold">${(item.quantity * item.rate).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Total */}
                                <div className="flex justify-end mb-8">
                                    <div className="w-full sm:w-64">
                                        <div className="flex justify-between py-2 text-sm">
                                            <span className="text-gray-600">Subtotal:</span>
                                            <span>${getSubtotal().toFixed(2)}</span>
                                        </div>
                                        {taxRate > 0 && (
                                            <div className="flex justify-between py-2 text-sm text-gray-600">
                                                <span>Tax ({taxRate}%):</span>
                                                <span>+${getTaxAmount().toFixed(2)}</span>
                                            </div>
                                        )}
                                        {discountAmount > 0 && (
                                            <div className="flex justify-between py-2 text-sm text-green-600">
                                                <span>Discount:</span>
                                                <span>-${discountAmount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between py-2 border-t-2 border-gray-800 font-bold text-base sm:text-lg">
                                            <span>Total:</span>
                                            <span>${getTotal().toFixed(2)} USD</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Instructions */}
                                {(paymentMethod !== 'stripe' || bankDetails || mobileDetails) && (
                                    <div className="bg-gray-100 p-4 rounded-lg">
                                        <h3 className="font-bold text-sm mb-2">Payment Instructions:</h3>

                                        {bankDetails && (
                                            <div className="mb-3">
                                                <p className="text-xs font-bold text-gray-500 uppercase">Bank Transfer</p>
                                                <p className="text-gray-700 text-sm whitespace-pre-wrap font-mono">{bankDetails}</p>
                                            </div>
                                        )}

                                        {mobileDetails && (
                                            <div className="mb-3">
                                                <p className="text-xs font-bold text-gray-500 uppercase">Mobile Money</p>
                                                <p className="text-gray-700 text-sm whitespace-pre-wrap font-mono">{mobileDetails}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Signature Section */}
                                <div className="mt-6 border-t-2 border-gray-200 pt-6">
                                    <div className="flex flex-col sm:flex-row items-center justify-between mb-3 gap-3">
                                        <h3 className="font-bold text-sm flex items-center gap-2">
                                            <PenLine className="w-4 h-4 text-gray-600" />
                                            Authorized Signature
                                        </h3>
                                        <div className="flex items-center gap-4">
                                            <div className="flex bg-gray-100 rounded-lg p-1">
                                                <button
                                                    onClick={() => setSignatureType('draw')}
                                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${signatureType === 'draw' ? 'bg-white shadow-sm text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    DRAW
                                                </button>
                                                <button
                                                    onClick={() => setSignatureType('type')}
                                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${signatureType === 'type' ? 'bg-white shadow-sm text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    TYPE
                                                </button>
                                            </div>
                                            {(signatureData || typedSignature) && (
                                                <button
                                                    onClick={() => {
                                                        setSignatureData(null);
                                                        setTypedSignature('');
                                                        if (canvasRef.current) {
                                                            const ctx = canvasRef.current.getContext('2d')!;
                                                            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                                                        }
                                                    }}
                                                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {signatureType === 'draw' ? (
                                        signatureData ? (
                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-2 bg-gray-50">
                                                <img src={signatureData} alt="Signature" className="max-h-20 mx-auto" />
                                            </div>
                                        ) : (
                                            <div>
                                                <canvas
                                                    ref={canvasRef}
                                                    width={500}
                                                    height={100}
                                                    className="w-full border-2 border-dashed border-gray-300 rounded-lg cursor-crosshair bg-gray-50"
                                                    style={{ touchAction: 'none' }}
                                                    onMouseDown={(e) => {
                                                        isDrawing.current = true;
                                                        const canvas = canvasRef.current!;
                                                        const ctx = canvas.getContext('2d')!;
                                                        const rect = canvas.getBoundingClientRect();
                                                        ctx.beginPath();
                                                        ctx.moveTo((e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height));
                                                    }}
                                                    onMouseMove={(e) => {
                                                        if (!isDrawing.current) return;
                                                        const canvas = canvasRef.current!;
                                                        const ctx = canvas.getContext('2d')!;
                                                        const rect = canvas.getBoundingClientRect();
                                                        ctx.lineWidth = 2;
                                                        ctx.lineCap = 'round';
                                                        ctx.strokeStyle = '#1e293b';
                                                        ctx.lineTo((e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height));
                                                        ctx.stroke();
                                                    }}
                                                    onMouseUp={() => { isDrawing.current = false; setSignatureData(canvasRef.current!.toDataURL()); }}
                                                    onMouseLeave={() => { isDrawing.current = false; }}
                                                    onTouchStart={(e) => {
                                                        e.preventDefault(); isDrawing.current = true;
                                                        const canvas = canvasRef.current!;
                                                        const ctx = canvas.getContext('2d')!;
                                                        const rect = canvas.getBoundingClientRect();
                                                        const t = e.touches[0];
                                                        ctx.beginPath();
                                                        ctx.moveTo((t.clientX - rect.left) * (canvas.width / rect.width), (t.clientY - rect.top) * (canvas.height / rect.height));
                                                    }}
                                                    onTouchMove={(e) => {
                                                        e.preventDefault();
                                                        if (!isDrawing.current) return;
                                                        const canvas = canvasRef.current!;
                                                        const ctx = canvas.getContext('2d')!;
                                                        const rect = canvas.getBoundingClientRect();
                                                        const t = e.touches[0];
                                                        ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';
                                                        ctx.lineTo((t.clientX - rect.left) * (canvas.width / rect.width), (t.clientY - rect.top) * (canvas.height / rect.height));
                                                        ctx.stroke();
                                                    }}
                                                    onTouchEnd={() => { isDrawing.current = false; setSignatureData(canvasRef.current!.toDataURL()); }}
                                                />
                                                <p className="text-xs text-gray-400 text-center mt-1 uppercase tracking-tighter font-bold">Draw your signature above</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                className="w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:outline-none focus:border-teal-500 transition-colors"
                                                placeholder="Type your full legal name..."
                                                value={typedSignature}
                                                onChange={(e) => setTypedSignature(e.target.value)}
                                            />
                                            {typedSignature && (
                                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                                                    <span className="text-3xl font-cursive text-gray-800 block" style={{ fontFamily: "'Dancing Script', 'Sacramento', cursive" }}>
                                                        {typedSignature}
                                                    </span>
                                                    <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest font-bold">Digital Signature Preview</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {paymentMethod === 'stripe' && (
                                    <div className="bg-blue-50 p-4 rounded-lg mt-6">
                                        <p className="text-blue-800 text-sm">
                                            <strong>Payment Method:</strong> Online payment via Stripe (Card/Online)
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center pt-4 border-t border-slate-800 gap-3">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button variant="outline" onClick={() => setStep('edit')} className="w-full sm:w-auto">
                                        <Edit3 className="w-4 h-4 mr-2" />
                                        Edit Details
                                    </Button>
                                    <Button variant="outline" onClick={handleDownloadPDF} className="w-full sm:w-auto">
                                        <Download className="w-4 h-4 mr-2" />
                                        Download Draft
                                    </Button>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">Cancel</Button>
                                    <Button onClick={handleSaveInvoice} disabled={isSubmitting} className="bg-green-600 hover:bg-green-500 w-full sm:w-auto">
                                        <CheckCircle className="w-4 h-4 mr-2" />
                                        {isSubmitting ? 'Saving...' : 'Save & Finalize'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Success */}
                    {step === 'success' && (
                        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in-up">
                            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle className="w-10 h-10 text-green-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Invoice Created Successfully!</h3>
                            <p className="text-slate-400 max-w-md mb-8">
                                Your invoice has been saved. Download the PDF or send your client a secure payment link.
                            </p>

                            {/* Share Invoice Link */}
                            <div className="w-full max-w-sm mb-6">
                                <button
                                    onClick={handleCopyPaymentLink}
                                    className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
                                >
                                    <Copy className="w-4 h-4" />
                                    Copy &amp; Share Invoice Link
                                </button>
                                <p className="text-xs text-slate-500 text-center mt-2">Clients can view the invoice and pay via bank or mobile money</p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                <Button variant="outline" onClick={handleDownloadPDF} className="w-full sm:w-auto">
                                    <Download className="w-4 h-4 mr-2" />
                                    Download PDF
                                </Button>
                                <Button onClick={handleClose} className="bg-teal-600 hover:bg-teal-500 w-full sm:w-auto">
                                    Close Window
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
};

export default CreateInvoiceModal;
