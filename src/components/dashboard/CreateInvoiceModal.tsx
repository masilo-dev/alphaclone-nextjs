import React, { useState, useRef } from 'react';
import { X, DollarSign, FileText, CheckCircle, Edit3, Save, Download, PenLine, Copy, List, Plus, Users, Search, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    const [selectedTemplate, setSelectedTemplate] = useState<1 | 2 | 3 | 4 | 5>(1);
    const [lastCreatedFile, setLastCreatedFile] = useState<any>(null);

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
    const [searchQuery, setSearchQuery] = useState('');
    const [showContactDropdown, setShowContactDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
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
                        .select('bank_details, mobile_payment_details, organization_name, settings')
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

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowContactDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const handleOpenFile = async (file: any) => {
        if (!file?.storage_path) return;
        const { fileUploadService } = await import('../../services/fileUploadService');
        const proxiedUrl = fileUploadService.getProxiedUrl('uploads', file.storage_path);
        window.open(proxiedUrl, '_blank');
    };

    const getSubtotal = () => Math.round(lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0) * 100) / 100;
    const getTaxAmount = () => {
        const subtotal = getSubtotal();
        const taxableAmount = Math.max(0, subtotal - discountAmount);
        return Math.round((taxableAmount * (taxRate / 100)) * 100) / 100;
    };
    const getTotal = () => {
        const subtotal = getSubtotal();
        const taxableAmount = Math.max(0, subtotal - discountAmount);
        const tax = getTaxAmount();
        return Math.round((taxableAmount + tax) * 100) / 100;
    };

    const handleSaveInvoice = async () => {
        if (!currentTenant?.id) {
            toast.error('No active organization session');
            return;
        }

        setIsSubmitting(true);
        try {
            const { businessInvoiceService } = await import('../../services/businessInvoiceService');
            const { fileUploadService } = await import('../../services/fileUploadService');

            const invoiceSubtotal = getSubtotal();
            const taxAmount = getTaxAmount();
            const invoiceTotal = getTotal();

            const project = projects.find(p => p.id === selectedProjectId);
            const finalClientId = selectedClientId || project?.clientId || undefined;

            const formattedLineItems = lineItems.map(item => ({
                description: item.description,
                quantity: item.quantity,
                rate: item.rate,
                amount: Math.round(item.quantity * item.rate * 100) / 100
            }));

            const invoiceData = {
                clientId: finalClientId,
                projectId: selectedProjectId || undefined,
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: dueDate,
                status: 'pending' as const,
                subtotal: invoiceSubtotal,
                taxRate: taxRate,
                tax: taxAmount,
                discountAmount: discountAmount,
                total: invoiceTotal,
                lineItems: formattedLineItems,
                paymentMethod: paymentMethod,
                bankDetails: paymentMethod === 'bank' ? bankDetails : undefined,
                mobilePaymentDetails: paymentMethod === 'mobile_money' ? mobileDetails : undefined,
                signature: signatureType === 'draw' && signatureData ? { type: 'draw' as const, data: signatureData }
                    : signatureType === 'type' && typedSignature ? { type: 'type' as const, data: typedSignature }
                        : undefined,
                currency: 'USD'
            };

            const { invoice, error } = await businessInvoiceService.createInvoice(currentTenant.id, invoiceData as any);

            if (error) {
                throw new Error(error);
            }

            if (invoice) {
                setCreatedInvoiceId(invoice.id);
                setCreatedInvoice(invoice);

                // Auto-save PDF
                try {
                    const client = clients.find(c => c.id === finalClientId);
                    // generatePDF(invoice: any, tenant: any, client: any, signature?: { type: 'draw' | 'type', data: string })
                    const doc = businessInvoiceService.generatePDF(invoice, currentTenant, client, invoiceData.signature);
                    const pdfBlob = doc.output('blob');
                    
                    const filename = `Invoice_${invoice.invoiceNumber || invoice.id}_${Date.now()}.pdf`;
                    const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
                    
                    const uploadedFile = await fileUploadService.uploadFile(
                        pdfFile,
                        'invoice',
                        invoice.id,
                        currentTenant.id, // userId
                        currentTenant.id, // tenantId
                        {
                            category: 'Invoices',
                            tags: ['Automated', 'Invoice']
                        }
                    );

                    if (uploadedFile && uploadedFile.success) {
                        // We need the full file object for handleOpenFile, but uploadFile returns FileUploadResult
                        // Let's fetch the file record or just pass enough info
                        const { file: fullFile } = await fileUploadService.getFileInfo(uploadedFile.fileId!);
                        setLastCreatedFile(fullFile);
                    }
                } catch (pdfErr) {
                    console.error('Failed to auto-save invoice PDF:', pdfErr);
                }

                setStep('success');
                toast.success('Invoice created and saved');
                onInvoiceCreated();
            }
        } catch (err: any) {
            console.error('Invoice creation error:', err);
            toast.error(err.message || 'Failed to create invoice');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const { businessInvoiceService } = await import('../../services/businessInvoiceService');

            if (createdInvoice) {
                const client = clients.find(c => c.id === (createdInvoice.client_id || createdInvoice.clientId));
                const signature = signatureType === 'draw' && signatureData ? { type: 'draw' as const, data: signatureData }
                    : signatureType === 'type' && typedSignature ? { type: 'type' as const, data: typedSignature }
                        : undefined;

                const doc = businessInvoiceService.generatePDF(createdInvoice, currentTenant, client, signature);
                doc.save(`Invoice-${createdInvoice.invoice_number || createdInvoice.invoiceNumber || createdInvoice.id}.pdf`);
                return;
            }

            // Draft PDF
            const formattedLineItems = lineItems.map(item => ({
                description: item.description,
                quantity: item.quantity,
                rate: item.rate,
                amount: Math.round(item.quantity * item.rate * 100) / 100
            }));

            const invoiceData = {
                id: 'DRAFT',
                invoiceNumber: `DRAFT-${Date.now().toString().slice(-4)}`,
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: dueDate,
                status: 'draft' as const,
                subtotal: getSubtotal(),
                tax: getTaxAmount(),
                total: getTotal(),
                lineItems: formattedLineItems,
                bankDetails: bankDetails,
                mobilePaymentDetails: mobileDetails
            };

            const client = clients.find(c => c.id === selectedClientId);
            const signature = signatureType === 'draw' && signatureData ? { type: 'draw' as const, data: signatureData }
                : signatureType === 'type' && typedSignature ? { type: 'type' as const, data: typedSignature }
                    : undefined;

            const doc = businessInvoiceService.generatePDF(invoiceData, currentTenant, client, signature);
            doc.save(`Invoice-DRAFT.pdf`);
        } catch (err) {
            console.error('PDF error:', err);
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
            const { businessInvoiceService } = await import('../../services/businessInvoiceService');
            await businessInvoiceService.updateInvoice(createdInvoiceId, { isPublic: true, status: 'sent' });
            const paymentUrl = `${window.location.origin}/invoice/${createdInvoiceId}`;
            await navigator.clipboard.writeText(paymentUrl);
            toast.success('Payment link copied!');
        } catch (err) {
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pt-safe pb-safe md:pl-64">
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative w-full max-w-2xl bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl animate-fade-in overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-teal-400" />
                            {currentTenant?.name || 'Business'} Invoice
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            {step === 'edit' && 'Fill in invoice details'}
                            {step === 'preview' && 'Review invoice before saving'}
                            {step === 'success' && 'Invoice created successfully'}
                        </p>
                    </div>
                    <button onClick={handleClose} className="text-slate-400 hover:text-white p-2">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    {step === 'edit' && (
                        <div className="space-y-5">
                            <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 flex items-start gap-3">
                                <Edit3 className="w-4 h-4 text-teal-400 mt-0.5" />
                                <div>
                                    <h3 className="text-teal-400 font-bold text-xs">Invoice Details</h3>
                                    <p className="text-slate-400 text-[10px] mt-0.5">Fill in the invoice information.</p>
                                </div>
                            </div>

                            <div className="border-b border-slate-800 pb-5">
                                <h3 className="text-white font-bold mb-3 text-sm flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-teal-400" />
                                    Choose Style
                                </h3>
                                <div className="grid grid-cols-5 gap-3">
                                    {[1, 2, 3, 4, 5].map((id) => (
                                        <button
                                            key={id}
                                            onClick={() => setSelectedTemplate(id as any)}
                                            className={`relative aspect-[3/4] rounded-lg border-2 transition-all overflow-hidden ${selectedTemplate === id ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-800 hover:border-slate-600'}`}
                                        >
                                            <div className={`absolute inset-0 bg-slate-950/40 ${selectedTemplate === id ? 'opacity-0' : 'opacity-100'}`} />
                                            {selectedTemplate === id && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-teal-500/10">
                                                    <CheckCircle2 className="w-5 h-5 text-teal-400" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Project</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                                        value={selectedProjectId}
                                        onChange={(e) => setSelectedProjectId(e.target.value)}
                                    >
                                        <option value="">Standalone Invoice</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>

                                <div className="relative" ref={dropdownRef}>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Client</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                            <Users className="w-3 h-3 text-slate-500" />
                                        </div>
                                        <input
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-10 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-teal-500"
                                            type="text"
                                            value={selectedClientId ? clients.find(c => c.id === selectedClientId)?.name || '' : searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                setShowContactDropdown(true);
                                                if (selectedClientId) setSelectedClientId('');
                                            }}
                                            onFocus={() => setShowContactDropdown(true)}
                                            placeholder="Search clients..."
                                        />
                                    </div>
                                    <AnimatePresence>
                                        {showContactDropdown && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className="absolute w-full mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto p-2"
                                            >
                                                {clients.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase())).map(c => (
                                                    <button
                                                        key={c.id}
                                                        onClick={() => {
                                                            setSelectedClientId(c.id);
                                                            setShowContactDropdown(false);
                                                        }}
                                                        className="w-full text-left p-2 rounded-lg hover:bg-white/5 flex items-center gap-3"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                                                            <span className="text-teal-400 text-xs font-bold">{c.name?.charAt(0)}</span>
                                                        </div>
                                                        <span className="text-sm text-slate-200">{c.name}</span>
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            <div className="border-t border-slate-800 pt-5">
                                <h3 className="text-white font-bold mb-3 text-sm">Line Items</h3>
                                <div className="space-y-3">
                                    {lineItems.map((item, index) => (
                                        <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                                            <div className="md:col-span-6">
                                                <Input
                                                    label={index === 0 ? "Description" : ""}
                                                    placeholder="Description"
                                                    value={item.description}
                                                    className="h-10 text-sm"
                                                    onChange={(e) => {
                                                        const newItems = [...lineItems];
                                                        newItems[index].description = e.target.value;
                                                        setLineItems(newItems);
                                                    }}
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <Input
                                                    label={index === 0 ? "Qty" : ""}
                                                    type="number"
                                                    value={item.quantity.toString()}
                                                    className="h-10 text-sm"
                                                    onChange={(e) => {
                                                        const newItems = [...lineItems];
                                                        newItems[index].quantity = parseInt(e.target.value) || 0;
                                                        setLineItems(newItems);
                                                    }}
                                                />
                                            </div>
                                            <div className="md:col-span-3">
                                                <Input
                                                    label={index === 0 ? "Rate" : ""}
                                                    type="number"
                                                    value={item.rate.toString()}
                                                    className="h-10 text-sm"
                                                    onChange={(e) => {
                                                        const newItems = [...lineItems];
                                                        newItems[index].rate = parseFloat(e.target.value) || 0;
                                                        setLineItems(newItems);
                                                    }}
                                                />
                                            </div>
                                            <div className="md:col-span-1 pb-1.5 flex justify-end">
                                                <button onClick={() => setLineItems(lineItems.filter((_, i) => i !== index))} className="text-slate-500 hover:text-red-400 p-1">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <Button size="sm" variant="ghost" onClick={() => setLineItems([...lineItems, { description: '', quantity: 1, rate: 0 }])} className="text-teal-400 hover:text-teal-300">
                                        + Add Line Item
                                    </Button>
                                    <div className="flex gap-6 justify-between items-end border-t border-slate-800 pt-5">
                                        <div className="w-1/2"><Input label="Due Date" type="date" value={dueDate} className="h-10 text-sm" onChange={(e) => setDueDate(e.target.value)} /></div>
                                        <div className="text-right">
                                            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total</p>
                                            <p className="text-2xl font-bold text-white tracking-tight">${getTotal().toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                                <Button onClick={handleGeneratePreview} className="bg-teal-600">Preview</Button>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-6">
                            <div className={`p-6 rounded-lg ${selectedTemplate === 3 ? 'bg-slate-950 text-white' : 'bg-white text-black'}`}>
                                <h1 className="text-3xl font-bold">INVOICE</h1>
                                <p className="opacity-50 mt-1">#DRAFT</p>
                                <div className="mt-8">
                                    <h3 className="font-bold uppercase opacity-50 text-xs">Bill To:</h3>
                                    <p className="text-lg font-bold">{selectedClient?.name || 'Client'}</p>
                                    <p className="opacity-70">{selectedClient?.email}</p>
                                </div>
                                <table className="w-full mt-8 text-sm">
                                    <thead className="border-b"><tr><th className="text-left py-2">Item</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Amount</th></tr></thead>
                                    <tbody>
                                        {lineItems.map((item, i) => (
                                            <tr key={i} className="border-b border-gray-100">
                                                <td className="py-3 font-medium">{item.description}</td>
                                                <td className="text-right">{item.quantity}</td>
                                                <td className="text-right font-bold">${(item.quantity * item.rate).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="flex justify-end mt-4">
                                    <div className="w-64 text-right">
                                        <p className="font-bold text-xl border-t pt-2">Total: ${getTotal().toFixed(2)} USD</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between gap-3 pt-4 border-t border-slate-800">
                                <Button variant="outline" onClick={() => setStep('edit')}>Edit</Button>
                                <div className="flex gap-3">
                                    <Button onClick={handleSaveInvoice} disabled={isSubmitting} className="bg-green-600">
                                        {isSubmitting ? 'Saving...' : 'Save & Finalize'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in-up">
                            <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
                            <h3 className="text-2xl font-bold text-white mb-2">Success!</h3>
                            <p className="text-slate-400 mb-8 px-8">Invoice saved to Document Hub.</p>
                            <div className="flex flex-col gap-3 w-64">
                                <Button onClick={() => lastCreatedFile && handleOpenFile(lastCreatedFile)} className="bg-teal-600">Sign & Finalize</Button>
                                <Button variant="outline" onClick={handleDownloadPDF}>Download</Button>
                                <Button variant="ghost" onClick={handleClose}>Done</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateInvoiceModal;
