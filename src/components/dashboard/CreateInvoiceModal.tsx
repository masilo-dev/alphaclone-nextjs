import React, { useState } from 'react';
import { X, DollarSign, FileText, CheckCircle, Edit3, Save, Download } from 'lucide-react';
import { Button, Input } from '../ui/UIComponents';
import { paymentService } from '../../services/paymentService';
import { Project } from '../../types';
import toast from 'react-hot-toast';
import { useTenant } from '../../contexts/TenantContext';

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
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedClientId, setSelectedClientId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'bank' | 'mobile_money'>('stripe');
    const [manualInstructions, setManualInstructions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clients, setClients] = useState<any[]>([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

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
                setLoadingClients(true);
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
                    setTenantDefaults({
                        bank: settingsRes.data.bank_details || '',
                        mobile: settingsRes.data.mobile_payment_details || '',
                        organizationName: settingsRes.data.organization_name || ''
                    });
                }

                if (clientsRes.clients) {
                    setClients(clientsRes.clients);
                }
                setLoadingClients(false);
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
        if (method === 'bank') {
            setManualInstructions(tenantDefaults.bank);
        } else if (method === 'mobile_money') {
            setManualInstructions(tenantDefaults.mobile);
        } else {
            setManualInstructions('');
        }
    };

    const handleGeneratePreview = () => {
        if (!amount || !description || !dueDate) {
            toast.error('Please fill in required fields');
            return;
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setStep('preview');
        toast.success('Invoice preview generated');
    };

    const handleSaveInvoice = async () => {
        if (!currentTenant?.id) {
            toast.error('No active organization session');
            return;
        }

        const amountNum = parseFloat(amount);
        setIsSubmitting(true);

        const project = projects.find(p => p.id === selectedProjectId);
        // Use selected client, or project's linked client. 
        // Do NOT use project.ownerId as it is a User ID, not a Business Client ID.
        const finalClientId = selectedClientId || project?.clientId || undefined;

        try {
            const { businessInvoiceService } = await import('../../services/businessInvoiceService');

            // Map to BusinessInvoice schema
            const invoiceData = {
                clientId: finalClientId,
                projectId: selectedProjectId || undefined,
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: dueDate,
                status: 'draft' as const, // Always start as draft, user can send/finalize later
                subtotal: amountNum,
                taxRate: 0,
                tax: 0,
                discountAmount: 0,
                total: amountNum,
                lineItems: [{
                    description: description,
                    quantity: 1,
                    rate: amountNum,
                    amount: amountNum
                }],
                notes: paymentMethod !== 'stripe' ? manualInstructions : undefined,
                isPublic: false
            };

            const { invoice, error } = await businessInvoiceService.createInvoice(currentTenant.id, invoiceData);

            if (error) {
                console.error('Invoice creation error:', error);
                toast.error(`Failed to create invoice: ${error}`);
            } else if (invoice) {
                setCreatedInvoiceId(invoice.id);
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
            const { useTenant } = await import('../../contexts/TenantContext');

            const tenant = currentTenant;
            const project = projects.find(p => p.id === selectedProjectId);
            const client = clients.find(c => c.id === selectedClientId);

            // Build invoice object for PDF
            const invoiceData = {
                id: createdInvoiceId || 'DRAFT',
                invoiceNumber: `INV-${Date.now()}`,
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: dueDate,
                status: 'draft' as const,
                subtotal: parseFloat(amount),
                tax: 0,
                total: parseFloat(amount),
                lineItems: [{
                    description: description,
                    quantity: 1,
                    rate: parseFloat(amount),
                    amount: parseFloat(amount)
                }],
                notes: paymentMethod !== 'stripe' ? manualInstructions : undefined,
                client: client ? {
                    name: client.name,
                    email: client.email
                } : undefined,
                project: project ? {
                    name: project.name
                } : undefined
            };

            const doc = businessInvoiceService.generatePDF(invoiceData, tenant, invoiceData.client);
            doc.save(`Invoice-${invoiceData.invoiceNumber}.pdf`);
            toast.success('PDF downloaded!');
        } catch (err) {
            console.error('PDF generation error:', err);
            toast.error('Failed to generate PDF');
        }
    };

    const resetForm = () => {
        setAmount('');
        setDescription('');
        setSelectedProjectId('');
        setSelectedClientId('');
        setDueDate('');
        setPaymentMethod('stripe');
        setManualInstructions('');
        setCreatedInvoiceId(null);
        setStep('edit');
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
                                        setAmount('500');
                                        setDescription('Standard Consultation');
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
                                        setAmount('2500');
                                        setDescription('Development Milestone');
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
                                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-green-400" />
                                    Invoice Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Description *"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="e.g. Initial Deposit"
                                    />
                                    <Input
                                        label="Amount (USD) *"
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="mt-4">
                                    <Input
                                        label="Due Date *"
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                    />
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

                                {paymentMethod !== 'stripe' && (
                                    <div className="mt-4 animate-fade-in">
                                        <label className="block text-sm font-medium text-slate-300 mb-1">Payment Instructions</label>
                                        <textarea
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                            rows={3}
                                            value={manualInstructions}
                                            onChange={(e) => setManualInstructions(e.target.value)}
                                            placeholder="Enter payment instructions for the client..."
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
                            {/* Invoice Preview */}
                            <div className="bg-white text-black p-4 sm:p-6 md:p-8 rounded-lg max-h-[500px] overflow-y-auto border-4 border-slate-700">
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
                                                <th className="text-left py-2">Description</th>
                                                <th className="text-right py-2">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b border-gray-200">
                                                <td className="py-3">{description}</td>
                                                <td className="text-right py-3">${parseFloat(amount).toFixed(2)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Total */}
                                <div className="flex justify-end mb-8">
                                    <div className="w-full sm:w-64">
                                        <div className="flex justify-between py-2 text-sm">
                                            <span className="text-gray-600">Subtotal:</span>
                                            <span>${parseFloat(amount).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between py-2 border-t-2 border-gray-800 font-bold text-base sm:text-lg">
                                            <span>Total:</span>
                                            <span>${parseFloat(amount).toFixed(2)} USD</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Payment Instructions */}
                                {paymentMethod !== 'stripe' && manualInstructions && (
                                    <div className="bg-gray-100 p-4 rounded-lg">
                                        <h3 className="font-bold text-sm mb-2">Payment Instructions:</h3>
                                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{manualInstructions}</p>
                                    </div>
                                )}

                                {paymentMethod === 'stripe' && (
                                    <div className="bg-blue-50 p-4 rounded-lg">
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
                                Your invoice has been saved and is ready to send to your client.
                            </p>

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
            </div>
        </div>
    );
};

export default CreateInvoiceModal;
