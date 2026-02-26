import React, { useState, useEffect } from 'react';
import { X, Receipt, CheckCircle, Save } from 'lucide-react';
import { Button, Input } from '../ui/UIComponents';
import toast from 'react-hot-toast';
import { useTenant } from '../../contexts/TenantContext';

interface AddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExpenseAdded: () => void;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose, onExpenseAdded }) => {
    const { currentTenant } = useTenant();

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');

    // Accounting state
    const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
    const [assetAccounts, setAssetAccounts] = useState<any[]>([]);
    const [selectedExpenseAccount, setSelectedExpenseAccount] = useState('');
    const [selectedAssetAccount, setSelectedAssetAccount] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState<'edit' | 'success'>('edit');

    useEffect(() => {
        const fetchAccounts = async () => {
            if (!isOpen || !currentTenant?.id) return;
            try {
                const { chartOfAccountsService } = await import('../../services/accounting/chartOfAccountsService');

                const [expenseRes, assetRes] = await Promise.all([
                    chartOfAccountsService.getAccountsByType('expense'),
                    chartOfAccountsService.getAccountsByType('asset')
                ]);

                if (expenseRes.accounts) {
                    setExpenseAccounts(expenseRes.accounts);
                    if (expenseRes.accounts.length > 0) setSelectedExpenseAccount(expenseRes.accounts[0].id);
                }

                if (assetRes.accounts) {
                    // Filter for 'Cash' or current assets
                    const currentAssets = assetRes.accounts.filter(a => a.accountSubtype === 'current_asset' || a.accountName.toLowerCase().includes('cash'));
                    setAssetAccounts(currentAssets.length > 0 ? currentAssets : assetRes.accounts);
                    if (currentAssets.length > 0) setSelectedAssetAccount(currentAssets[0].id);
                    else if (assetRes.accounts.length > 0) setSelectedAssetAccount(assetRes.accounts[0].id);
                }
            } catch (err) {
                console.error("Failed to fetch chart of accounts:", err);
                toast.error("Failed to load accounting categories.");
            }
        };

        fetchAccounts();
        setStep('edit');
    }, [isOpen, currentTenant?.id]);

    const resetForm = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setDescription('');
        setAmount('');
        setStep('edit');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSave = async () => {
        if (!currentTenant?.id) {
            toast.error('No active organization session');
            return;
        }

        if (!description || !amount || !selectedExpenseAccount || !selectedAssetAccount) {
            toast.error('Please fill in all required fields');
            return;
        }

        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setIsSubmitting(true);

        try {
            const { journalEntryService } = await import('../../services/accounting/journalEntryService');

            // Debit Expense, Credit Asset
            const { entry, error: createError } = await journalEntryService.createSimpleEntry(
                date,
                `Expense: ${description}`,
                selectedExpenseAccount, // Debit side
                selectedAssetAccount,   // Credit side
                amountNum,
                undefined,
                'manual'
            );

            if (createError) {
                throw new Error(createError);
            }

            if (entry) {
                const { error: postError } = await journalEntryService.postEntry(entry.id);
                if (postError) {
                    throw new Error(`Entry created but failed to post: ${postError}`);
                }

                setStep('success');
                toast.success('Expense recorded successfully!');
                onExpenseAdded();
            }
        } catch (err: any) {
            console.error('Expense submission error:', err);
            toast.error(`Failed to record expense: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-2xl bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl my-8">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Receipt className="w-6 h-6 text-red-500" />
                            Record Expense
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            {step === 'edit' && 'Add a new business expense to your General Ledger'}
                            {step === 'success' && 'Expense recorded successfully'}
                        </p>
                    </div>
                    <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6">
                    {step === 'edit' && (
                        <div className="space-y-6">

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Date *"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                />
                                <Input
                                    label="Amount (USD) *"
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>

                            <div>
                                <Input
                                    label="Description / Vendor *"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="e.g. AWS Hosting, Office Supplies, Target"
                                />
                            </div>

                            {/* Hidden Account Selections (Handled Automatically) */}
                            <div className="hidden">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800 pt-4">
                                    <div>
                                        <select
                                            value={selectedExpenseAccount}
                                            onChange={(e) => setSelectedExpenseAccount(e.target.value)}
                                            disabled={expenseAccounts.length === 0}
                                        >
                                            <option value="">Select a category...</option>
                                            {expenseAccounts.map(a => (
                                                <option key={a.id} value={a.id}>{a.accountName} ({a.accountCode})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <select
                                            value={selectedAssetAccount}
                                            onChange={(e) => setSelectedAssetAccount(e.target.value)}
                                            disabled={assetAccounts.length === 0}
                                        >
                                            <option value="">Select a payment source...</option>
                                            {assetAccounts.map(a => (
                                                <option key={a.id} value={a.id}>{a.accountName} ({a.accountCode})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Receipt Upload (UI Only for Quick Expense) */}
                            <div className="border-t border-slate-800 pt-4 mt-2">
                                <label className="block text-sm font-medium text-slate-300 mb-2">Receipt (Optional)</label>
                                <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:bg-slate-800/50 transition-colors cursor-pointer">
                                    <Receipt className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                                    <p className="text-sm text-slate-400">Click to upload or drag and drop</p>
                                    <p className="text-xs text-slate-500 mt-1">PNG, JPG, PDF up to 5MB</p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSubmitting || !selectedExpenseAccount || !selectedAssetAccount}
                                    className="bg-red-600 hover:bg-red-500"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {isSubmitting ? 'Recording...' : 'Record Expense'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in-up">
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle className="w-8 h-8 text-green-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Expense Recorded!</h3>
                            <p className="text-slate-400 max-w-sm mb-6 text-sm">
                                The journal entry has been posted to your General Ledger successfully.
                            </p>

                            <Button onClick={handleClose} className="bg-slate-700 hover:bg-slate-600 w-full sm:w-auto">
                                Close Modal
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddExpenseModal;
