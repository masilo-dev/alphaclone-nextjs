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
    const [isSubmitting, setIsSubmitting] = useState(false);

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
