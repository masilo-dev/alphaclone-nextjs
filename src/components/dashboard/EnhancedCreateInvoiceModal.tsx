import React, { useState, useRef } from 'react';
import { X, DollarSign, FileText, CheckCircle, Edit3, Save, Download, PenLine, Copy, List, Plus, Users, Search, CheckCircle2, Send, Mail, AlertCircle } from 'lucide-react';
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
    const [enablePaymentLinks, setEnablePaymentLinks] = useState(false); // DISABLED by default
    const [sendAsDraft, setSendAsDraft] = useState(false);
    const [clientEmail, setClientEmail] = useState('');

    // Set default bank and mobile money details from tenant
    const tenantDefaults = {
        bank: currentTenant?.paymentMethods?.bank || 'Bank: ABSA\nAccount: 123456789\nBranch: Sandton',
        mobile: currentTenant?.paymentMethods?.mobile || 'Mobile Money: +27 123 456 7890',
    };

    React.useEffect(() => {
        if (currentTenant?.paymentMethods) {
            setBankDetails(currentTenant.paymentMethods.bank || tenantDefaults.bank);
            setMobileDetails(currentTenant.paymentMethods.mobile || tenantDefaults.mobile);
        }
    }, [currentTenant]);

    // Load clients when component mounts or project changes
    React.useEffect(() => {
        const loadClients = async () => {
            try {
                const { businessClientService } = await import('../../services/businessClientService');
                const { clients } = await businessClientService.getClients();
                setClients(clients || []);
            } catch (error) {
                console.error('Failed to load clients:', error);
            }
        };
        loadClients();
    }, []);

    // Load user services and sectors
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

    // Update client email when client is selected
    React.useEffect(() => {
        const selectedClient = clients.find(c => c.id === selectedClientId);
        if (selectedClient?.email) {
            setClientEmail(selectedClient.email);
        }
    }, [selectedClientId, clients]);

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
        return (calculateSubtotal() * taxRate) / 100;
    };

    const calculateTotal = () => {
        return calculateSubtotal() + calculateTax() - discountAmount;
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const { businessInvoiceService } = await import('../../services/businessInvoiceService');
            
            const invoiceData = {
                clientId: selectedClientId,
                projectId: selectedProjectId,
                lineItems: lineItems.filter(item => item.description.trim()),
                dueDate: dueDate,
                paymentMethod: paymentMethod,
                bankDetails: paymentMethod === 'bank' ? bankDetails : '',
                mobileDetails: paymentMethod === 'mobile_money' ? mobileDetails : '',
                taxRate: taxRate,
                discountAmount: discountAmount,
                template: selectedTemplate,
                signature: signatureData,
                signatureType: signatureType,
                typedSignature: typedSignature,
                status: sendAsDraft ? 'draft' : 'sent',
                isPublic: !sendAsDraft, // Only make public if not draft
                enablePaymentLinks: enablePaymentLinks // Explicitly set payment links status
            };

            const { invoice, error } = await businessInvoiceService.createInvoice(invoiceData);

            if (error) {
                toast.error(error);
                return;
            }

            setCreatedInvoiceId(invoice.id);
            setCreatedInvoice(invoice);
            setStep('success');
            onInvoiceCreated();

            // Send email notification if not draft
            if (!sendAsDraft && clientEmail) {
                await sendInvoiceEmail(invoice);
            }

        } catch (error) {
            console.error('Failed to create invoice:', error);
            toast.error('Failed to create invoice');
        } finally {
            setIsSubmitting(false);
        }
    };

    const sendInvoiceEmail = async (invoice: any) => {
        try {
            const { emailCampaignService } = await import('../../services/emailCampaignService');
            const invoiceUrl = `${window.location.origin}/invoice/${invoice.id}`;
            
            await emailCampaignService.sendTransactionalEmail(
                clientEmail,
                `New Invoice from ${currentTenant?.name || 'Your Business'}`,
                {
                    invoiceNumber: invoice.invoiceNumber,
                    amount: calculateTotal(),
                    dueDate: dueDate,
                    invoiceUrl: invoiceUrl,
                    clientName: clients.find(c => c.id === selectedClientId)?.name || 'Client',
                    businessName: currentTenant?.name || 'Your Business',
                    paymentInstructions: getPaymentInstructions()
                }
            );
            
            toast.success('Invoice sent to client via email');
        } catch (error) {
            console.error('Failed to send invoice email:', error);
            toast.error('Failed to send invoice email');
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
        setDueDate('');
        setPaymentMethod('stripe');
        setBankDetails(tenantDefaults.bank);
        setMobileDetails(tenantDefaults.mobile);
        setTaxRate(0);
        setDiscountAmount(0);
        setSignatureData(null);
        setSignatureType('draw');
        setTypedSignature('');
        setEnablePaymentLinks(false);
        setSendAsDraft(false);
        setClientEmail('');
        setStep('edit');
    };

    const handleCopyPaymentLink = async () => {
        if (!createdInvoiceId || !enablePaymentLinks) return;
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

                            {/* Payment Links Warning */}
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                                    <div className="flex-1">
                                        <h3 className="text-yellow-400 font-bold text-sm">Payment Links</h3>
                                        <p className="text-slate-400 text-xs mt-1">
                                            Payment links are currently disabled for security. Enable only if needed.
                                        </p>
                                        <label className="flex items-center mt-3 space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={enablePaymentLinks}
                                                onChange={(e) => setEnablePaymentLinks(e.target.checked)}
                                                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                            />
                                            <span className="text-sm text-white">Enable payment links</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Draft Option */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <Mail className="w-5 h-5 text-blue-400 mt-0.5" />
                                    <div className="flex-1">
                                        <h3 className="text-blue-400 font-bold text-sm">Send Options</h3>
                                        <div className="mt-3 space-y-3">
                                            <label className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={sendAsDraft}
                                                    onChange={(e) => setSendAsDraft(e.target.checked)}
                                                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                                />
                                                <span className="text-sm text-white">Save as draft (don't send to client)</span>
                                            </label>
                                            
                                            {!sendAsDraft && (
                                                <div className="ml-6">
                                                    <Input
                                                        label="Client Email (for invoice notification)"
                                                        type="email"
                                                        value={clientEmail}
                                                        onChange={(e) => setClientEmail(e.target.value)}
                                                        placeholder="client@example.com"
                                                        className="text-sm"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Template Selector */}
                            <div className="border-b border-slate-800 pb-6">
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-teal-400" />
                                    Choose Style
                                </h3>
                                <div className="grid grid-cols-5 gap-2">
                                    {[
                                        { id: 1, name: 'Classic', color: 'bg-white' },
                                        { id: 2, name: 'Modern', color: 'bg-teal-50' },
                                        { id: 3, name: 'Dark', color: 'bg-slate-900 border border-white/20' },
                                        { id: 4, name: 'Minimal', color: 'bg-gray-50' },
                                        { id: 5, name: 'Bold', color: 'bg-slate-200' }
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setSelectedTemplate(t.id as any)}
                                            className={`relative aspect-[3/4] rounded-lg border-2 transition-all overflow-hidden group ${selectedTemplate === t.id ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-700 hover:border-slate-500'}`}
                                        >
                                            <div className={`absolute inset-0 ${t.color} opacity-50`} />
                                            <div className="absolute inset-x-2 top-2 h-2 bg-current opacity-20 rounded-sm" />
                                            <div className="absolute inset-x-2 top-5 bottom-2 bg-current opacity-10 rounded-sm" />
                                            <span className="absolute bottom-2 inset-x-2 text-xs font-medium text-white text-center bg-black/50 rounded py-1">
                                                {t.name}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Client and Project Selection */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Client *</label>
                                    <select
                                        value={selectedClientId}
                                        onChange={(e) => setSelectedClientId(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    >
                                        <option value="">Select a client</option>
                                        {clients.map((client) => (
                                            <option key={client.id} value={client.id}>
                                                {client.name} - {client.email}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Project (Optional)</label>
                                    <select
                                        value={selectedProjectId}
                                        onChange={(e) => setSelectedProjectId(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    >
                                        <option value="">Select a project</option>
                                        {projects.map((project) => (
                                            <option key={project.id} value={project.id}>
                                                {project.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Due Date */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Due Date *</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                />
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Payment Method *</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {[
                                        { value: 'stripe', label: 'Online Payment (Stripe)', icon: '💳' },
                                        { value: 'bank', label: 'Bank Transfer', icon: '🏦' },
                                        { value: 'mobile_money', label: 'Mobile Money', icon: '📱' }
                                    ].map((method) => (
                                        <button
                                            key={method.value}
                                            onClick={() => setPaymentMethod(method.value as any)}
                                            className={`p-3 rounded-lg border-2 transition-all ${
                                                paymentMethod === method.value
                                                    ? 'border-teal-500 bg-teal-500/10'
                                                    : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                                            }`}
                                        >
                                            <div className="text-2xl mb-1">{method.icon}</div>
                                            <div className="text-white text-sm font-medium">{method.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Payment Details */}
                            {paymentMethod === 'bank' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Bank Details *</label>
                                    <textarea
                                        value={bankDetails}
                                        onChange={(e) => setBankDetails(e.target.value)}
                                        placeholder="Bank Name\nAccount Number\nBranch Code\nAccount Holder Name"
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        rows={4}
                                    />
                                </div>
                            )}

                            {paymentMethod === 'mobile_money' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Mobile Money Details *</label>
                                    <Input
                                        value={mobileDetails}
                                        onChange={(e) => setMobileDetails(e.target.value)}
                                        placeholder="Phone Number or Wallet ID"
                                    />
                                </div>
                            )}

                            {/* Line Items */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-white font-bold">Line Items</h3>
                                    <button
                                        onClick={addLineItem}
                                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Item
                                    </button>
                                </div>

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

                                            <div className="text-right text-sm text-slate-400 mt-2">
                                                Subtotal: ${(item.quantity * item.rate).toFixed(2)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tax and Discount */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Tax Rate (%)</label>
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
                                    <label className="block text-sm font-medium text-slate-300 mb-2">Discount ($)</label>
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
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-300">
                                        <span>Subtotal:</span>
                                        <span>${calculateSubtotal().toFixed(2)}</span>
                                    </div>
                                    {taxRate > 0 && (
                                        <div className="flex justify-between text-slate-300">
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
                                    <div className="border-t border-slate-600 pt-2 flex justify-between font-bold text-white text-lg">
                                        <span>Total:</span>
                                        <span>${calculateTotal().toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Digital Signature */}
                            <div className="border-t border-slate-800 pt-6">
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                    <PenLine className="w-5 h-5 text-teal-400" />
                                    Digital Signature (Optional)
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setSignatureType('draw')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                signatureType === 'draw'
                                                    ? 'bg-teal-600 text-white'
                                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                            }`}
                                        >
                                            Draw Signature
                                        </button>
                                        <button
                                            onClick={() => setSignatureType('type')}
                                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                signatureType === 'type'
                                                    ? 'bg-teal-600 text-white'
                                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                            }`}
                                        >
                                            Type Signature
                                        </button>
                                    </div>

                                    {signatureType === 'draw' && (
                                        <div className="bg-white rounded-lg p-4">
                                            <canvas
                                                ref={(canvas) => {
                                                    if (canvas) {
                                                        const ctx = canvas.getContext('2d');
                                                        if (ctx) {
                                                            // Set canvas size
                                                            canvas.width = canvas.offsetWidth;
                                                            canvas.height = 150;
                                                            
                                                            // Set drawing style
                                                            ctx.strokeStyle = '#000000';
                                                            ctx.lineWidth = 2;
                                                            ctx.lineCap = 'round';
                                                            ctx.lineJoin = 'round';

                                                            let isDrawing = false;
                                                            let lastX = 0;
                                                            let lastY = 0;

                                                            const startDrawing = (e: MouseEvent | TouchEvent) => {
                                                                isDrawing = true;
                                                                const rect = canvas.getBoundingClientRect();
                                                                const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.offsetX;
                                                                const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.offsetY;
                                                                lastX = x;
                                                                lastY = y;
                                                            };

                                                            const draw = (e: MouseEvent | TouchEvent) => {
                                                                if (!isDrawing) return;
                                                                e.preventDefault();
                                                                const rect = canvas.getBoundingClientRect();
                                                                const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.offsetX;
                                                                const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.offsetY;

                                                                ctx.beginPath();
                                                                ctx.moveTo(lastX, lastY);
                                                                ctx.lineTo(x, y);
                                                                ctx.stroke();

                                                                lastX = x;
                                                                lastY = y;
                                                            };

                                                            const stopDrawing = () => {
                                                                isDrawing = false;
                                                                setSignatureData(canvas.toDataURL());
                                                            };

                                                            canvas.addEventListener('mousedown', startDrawing);
                                                            canvas.addEventListener('mousemove', draw);
                                                            canvas.addEventListener('mouseup', stopDrawing);
                                                            canvas.addEventListener('mouseout', stopDrawing);
                                                            canvas.addEventListener('touchstart', startDrawing);
                                                            canvas.addEventListener('touchmove', draw);
                                                            canvas.addEventListener('touchend', stopDrawing);

                                                            // Clear button
                                                            const clearButton = document.createElement('button');
                                                            clearButton.textContent = 'Clear';
                                                            clearButton.className = 'mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700';
                                                            clearButton.onclick = () => {
                                                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                                                                setSignatureData(null);
                                                            };
                                                            canvas.parentNode?.appendChild(clearButton);
                                                        }
                                                    }
                                                }}
                                                className="border border-gray-300 rounded cursor-crosshair w-full"
                                                style={{ height: '150px' }}
                                            />
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
                            <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4 flex items-start gap-3">
                                <FileText className="w-5 h-5 text-teal-400 mt-0.5" />
                                <div>
                                    <h3 className="text-teal-400 font-bold text-sm">Invoice Preview</h3>
                                    <p className="text-slate-400 text-xs mt-1">
                                        Review your invoice details before creating it.
                                    </p>
                                </div>
                            </div>

                            {/* Invoice Preview */}
                            <div className="bg-white rounded-lg p-6 text-black">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold">{currentTenant?.name || 'Business Name'}</h2>
                                        <p className="text-gray-600">Invoice</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold">Invoice #INV-{Date.now().toString().slice(-6)}</p>
                                        <p className="text-gray-600">Due: {dueDate}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <h3 className="font-bold mb-2">Bill To:</h3>
                                        <p>{selectedClient?.name || 'Client Name'}</p>
                                        <p className="text-gray-600">{selectedClient?.email || 'client@example.com'}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-bold mb-2">Project:</h3>
                                        <p>{selectedProject?.name || 'General Services'}</p>
                                    </div>
                                </div>

                                <table className="w-full mb-6">
                                    <thead>
                                        <tr className="border-b-2 border-gray-300">
                                            <th className="text-left py-2">Description</th>
                                            <th className="text-right py-2">Qty</th>
                                            <th className="text-right py-2">Rate</th>
                                            <th className="text-right py-2">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lineItems.filter(item => item.description.trim()).map((item, index) => (
                                            <tr key={index} className="border-b border-gray-200">
                                                <td className="py-2">{item.description}</td>
                                                <td className="text-right py-2">{item.quantity}</td>
                                                <td className="text-right py-2">${item.rate.toFixed(2)}</td>
                                                <td className="text-right py-2">${(item.quantity * item.rate).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="flex justify-end">
                                    <div className="w-64">
                                        <div className="space-y-2 text-sm">
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
                                                <div className="flex justify-between text-red-600">
                                                    <span>Discount:</span>
                                                    <span>-${discountAmount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-lg">
                                                <span>Total:</span>
                                                <span>${calculateTotal().toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {signatureData && (
                                    <div className="mt-6">
                                        <p className="text-gray-600 mb-2">Authorized Signature:</p>
                                        <img src={signatureData} alt="Signature" className="h-16" />
                                    </div>
                                )}

                                {typedSignature && (
                                    <div className="mt-6">
                                        <p className="text-gray-600 mb-2">Authorized Signature:</p>
                                        <p className="text-2xl font-script">{typedSignature}</p>
                                    </div>
                                )}
                            </div>

                            {/* Status Summary */}
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                <h4 className="text-white font-bold mb-2">Invoice Status</h4>
                                <div className="space-y-1 text-sm text-slate-300">
                                    <div className="flex justify-between">
                                        <span>Status:</span>
                                        <span className={sendAsDraft ? "text-yellow-400" : "text-green-400"}>
                                            {sendAsDraft ? "Draft (Internal Only)" : "Sent to Client"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Payment Links:</span>
                                        <span className={enablePaymentLinks ? "text-green-400" : "text-red-400"}>
                                            {enablePaymentLinks ? "Enabled" : "Disabled"}
                                        </span>
                                    </div>
                                    {!sendAsDraft && (
                                        <div className="flex justify-between">
                                            <span>Client Notification:</span>
                                            <span className="text-green-400">Email will be sent</span>
                                        </div>
                                    )}
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
                            <h3 className="text-2xl font-bold text-white mb-2">Invoice Created Successfully!</h3>
                            <p className="text-slate-400 max-w-md mx-auto mb-8">
                                {sendAsDraft 
                                    ? "Your invoice has been saved as a draft. You can send it to the client later."
                                    : "Your invoice has been created and sent to the client."
                                }
                            </p>

                            {/* Payment Link - Only show if enabled */}
                            {enablePaymentLinks && (
                                <div className="w-full max-w-sm mb-6 mx-auto">
                                    <button
                                        onClick={handleCopyPaymentLink}
                                        className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
                                    >
                                        <Copy className="w-4 h-4" />
                                        Copy & Share Invoice Link
                                    </button>
                                    <p className="text-xs text-slate-500 text-center mt-2">Clients can view the invoice and pay via bank or mobile money</p>
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

                            {/* Next Steps */}
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-left">
                                <h4 className="text-white font-bold mb-2">Next Steps</h4>
                                <ul className="text-slate-300 text-sm space-y-1">
                                    {sendAsDraft ? (
                                        <>
                                            <li>• Review and edit the draft as needed</li>
                                            <li>• Send to client when ready</li>
                                            <li>• Track payment status</li>
                                        </>
                                    ) : (
                                        <>
                                            <li>• Track payment status in your dashboard</li>
                                            <li>• Send reminders if needed</li>
                                            <li>• Mark as paid when payment is received</li>
                                        </>
                                    )}
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-slate-800 bg-slate-900/50">
                    <div className="text-sm text-slate-400">
                        Total: <span className="text-white font-bold">${calculateTotal().toFixed(2)}</span>
                    </div>
                    <div className="flex gap-3">
                        {step === 'edit' && (
                            <Button
                                variant="outline"
                                onClick={handleClose}
                            >
                                Cancel
                            </Button>
                        )}
                        {step === 'preview' && (
                            <Button
                                variant="outline"
                                onClick={() => setStep('edit')}
                            >
                                <Edit3 className="w-4 h-4 mr-2" />
                                Edit
                            </Button>
                        )}
                        {step === 'preview' && (
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !selectedClientId || !dueDate || calculateTotal() <= 0}
                                className="flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {sendAsDraft ? 'Save as Draft' : 'Create Invoice'}
                                    </>
                                )}
                            </Button>
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