import React, { useState } from 'react';
import { Modal, Input, Button } from '../ui/UIComponents';
import { paymentService } from '../../services/paymentService';
import { Project } from '../../types';
import toast from 'react-hot-toast';

interface CreateInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInvoiceCreated: () => void;
    projects: Project[]; // To select a project
    // Fetch users if possible, or just input email/ID for now. Ideally we select a client.
    // For now, let's assume we pick a project and it has an owner (client).
}

const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({ isOpen, onClose, onInvoiceCreated, projects }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'bank' | 'mobile_money'>('stripe');
    const [manualInstructions, setManualInstructions] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch tenant defaults
    const [tenantDefaults, setTenantDefaults] = useState({ bank: '', mobile: '' });

    React.useEffect(() => {
        const fetchDefaults = async () => {
            const { supabase } = await import('../../lib/supabase');
            const { tenantService } = await import('../../services/tenancy/TenantService');
            const tenantId = tenantService.getCurrentTenantId();

            if (tenantId) {
                const { data } = await supabase
                    .from('business_settings')
                    .select('bank_details, mobile_payment_details')
                    .eq('tenant_id', tenantId)
                    .single();

                if (data) {
                    setTenantDefaults({
                        bank: data.bank_details || '',
                        mobile: data.mobile_payment_details || ''
                    });
                }
            }
        };
        fetchDefaults();
    }, []);

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

    const handleSubmit = async () => {
        if (!amount || !description || !selectedProjectId || !dueDate) {
            toast.error('Please fill in all fields');
            return;
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setIsSubmitting(true);

        const project = projects.find(p => p.id === selectedProjectId);
        if (!project || !project.ownerId) {
            toast.error('Selected project has no owner!');
            setIsSubmitting(false);
            return;
        }

        try {
            // Create invoice with timeout
            const invoicePromise = paymentService.createInvoice({
                user_id: project.ownerId,
                project_id: project.id,
                amount: amountNum,
                currency: 'usd',
                description: description,
                due_date: new Date(dueDate).toISOString(),
                payment_method: paymentMethod,
                manual_payment_instructions: manualInstructions,
                items: [{
                    description: description,
                    quantity: 1,
                    unit_price: amountNum,
                    amount: amountNum
                }]
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 10000)
            );

            const { error } = await Promise.race([invoicePromise, timeoutPromise]);

            if (error) {
                console.error('Invoice creation error:', error);
                toast.error(`Failed to create invoice: ${error.message || 'Unknown error'}`);
            } else {
                toast.success('Invoice created successfully!');
                onInvoiceCreated();
                onClose();
                // Reset form
                setAmount('');
                setDescription('');
                setSelectedProjectId('');
                setDueDate('');
            }
        } catch (err) {
            console.error('Invoice submission error:', err);
            if (err instanceof Error && err.message === 'Request timeout') {
                toast.error('Request took too long. Please try again.');
            } else {
                toast.error('Failed to create invoice. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Invoice">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Project</label>
                    <select
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                    >
                        <option value="">Select a project...</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.ownerName || 'Unknown Client'})</option>
                        ))}
                    </select>
                </div>

                <Input
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Initial Deposit"
                />

                <Input
                    label="Amount (USD)"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                />

                <Input
                    label="Due Date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                />

                <div className="pt-2">
                    <label className="block text-sm font-medium text-slate-300 mb-1">Payment Method</label>
                    <select
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        value={paymentMethod}
                        onChange={(e) => handleMethodChange(e.target.value as any)}
                    >
                        <option value="stripe">Stripe (Card / Online)</option>
                        <option value="bank">Bank Transfer (Manual)</option>
                        <option value="mobile_money">Mobile Payment (Manual)</option>
                    </select>
                </div>

                {paymentMethod !== 'stripe' && (
                    <div className="animate-fade-in">
                        <label className="block text-sm font-medium text-slate-300 mb-1">Manual Instructions</label>
                        <textarea
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            rows={3}
                            value={manualInstructions}
                            onChange={(e) => setManualInstructions(e.target.value)}
                            placeholder="Enter payment instructions for the client..."
                        />
                    </div>
                )}

                <div className="pt-4 flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Creating...' : 'Create Invoice'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default CreateInvoiceModal;
