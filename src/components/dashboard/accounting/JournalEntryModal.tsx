'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ChartOfAccount } from '../../../services/accounting/chartOfAccountsService';
import { journalEntryService } from '../../../services/accounting/journalEntryService';
import { Modal, Input, Button } from '../../ui/UIComponents';
import { Plus, Trash2, CheckCircle2, AlertCircle, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface JournalEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    accounts: ChartOfAccount[];
}

export function JournalEntryModal({ isOpen, onClose, onSuccess, accounts }: JournalEntryModalProps) {
    const [loading, setLoading] = useState(false);
    const [transactionType, setTransactionType] = useState<'received' | 'spent'>('spent');
    const [formData, setFormData] = useState({
        entryDate: new Date().toISOString().split('T')[0],
        description: '',
        reference: '',
        lines: [
            { accountId: '', amount: 0, description: '' },
        ],
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                entryDate: new Date().toISOString().split('T')[0],
                description: '',
                reference: '',
                lines: [
                    { accountId: '', amount: 0, description: '' },
                ],
            });
            setTransactionType('spent');
        }
    }, [isOpen]);

    const addLine = () => {
        setFormData({
            ...formData,
            lines: [...formData.lines, { accountId: '', amount: 0, description: '' }],
        });
    };

    const removeLine = (index: number) => {
        const newLines = formData.lines.filter((_, i) => i !== index);
        setFormData({ ...formData, lines: newLines });
    };

    const updateLine = (index: number, field: string, value: any) => {
        const newLines = [...formData.lines];
        (newLines[index] as any)[field] = value;
        setFormData({ ...formData, lines: newLines });
    };

    const handleCreate = async () => {
        setLoading(true);
        try {
            // Find appropriate cash/bank account
            const cashAccount = accounts.find(a => 
                a.accountType === 'asset' && 
                (a.accountCode?.startsWith('10') || a.accountName.toLowerCase().includes('cash') || a.accountName.toLowerCase().includes('bank'))
            );

            if (!cashAccount) {
                toast.error('Could not find a cash or bank account in your Chart of Accounts.');
                setLoading(false);
                return;
            }

            const totalAmount = formData.lines.reduce((sum, line) => sum + (line.amount || 0), 0);

            if (totalAmount <= 0) {
                toast.error('Transaction amount must be greater than zero.');
                setLoading(false);
                return;
            }

            // Construct journal lines based on transaction type
            // spent: Debit Expense (line.accountId), Credit Cash (cashAccount.id)
            // received: Debit Cash (cashAccount.id), Credit Revenue (line.accountId)
            const journalLines = [];

            // 1. The Cash side
            journalLines.push({
                accountId: cashAccount.id,
                debitAmount: transactionType === 'received' ? totalAmount : 0,
                creditAmount: transactionType === 'spent' ? totalAmount : 0,
                description: formData.description || (transactionType === 'received' ? 'Money received' : 'Money spent')
            });

            // 2. The Category sides
            formData.lines.forEach(line => {
                if (line.accountId && line.amount > 0) {
                    journalLines.push({
                        accountId: line.accountId,
                        debitAmount: transactionType === 'spent' ? line.amount : 0,
                        creditAmount: transactionType === 'received' ? line.amount : 0,
                        description: line.description || formData.description
                    });
                }
            });

            const { entry, error: err } = await journalEntryService.createEntry({
                entryDate: formData.entryDate,
                description: formData.description,
                reference: formData.reference || undefined,
                lines: journalLines,
            });

            if (err) {
                toast.error(`Error creating transaction: ${err}`);
            } else {
                if (entry) {
                    await journalEntryService.postEntry(entry.id);
                }
                toast.success('Transaction saved and synced to ledger');
                onSuccess();
                onClose();
            }
        } catch (error) {
            console.error('Error creating transaction:', error);
            toast.error('An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const totalAmount = formData.lines.reduce((sum, line) => sum + (line.amount || 0), 0);
    const isValid = totalAmount > 0 && formData.lines.every(l => l.accountId);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Add transaction"
            maxWidth="max-w-2xl"
        >
            <div className="space-y-6">
                <div>
                    <p className="text-slate-400 text-sm mb-6">Record money coming in or going out of your business ledger.</p>
                    
                    {/* Transaction Type Toggle */}
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <button
                            onClick={() => setTransactionType('received')}
                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group ${
                                transactionType === 'received' 
                                ? 'bg-teal-500/10 border-teal-500 shadow-[0_0_20px_rgba(20,184,166,0.15)]' 
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                                transactionType === 'received' ? 'bg-teal-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                            }`}>
                                <ArrowDownCircle className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                                <span className={`block font-bold text-sm ${transactionType === 'received' ? 'text-white' : 'text-slate-400'}`}>Money received</span>
                                <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Income / Revenue</span>
                            </div>
                        </button>

                        <button
                            onClick={() => setTransactionType('spent')}
                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group ${
                                transactionType === 'spent' 
                                ? 'bg-rose-500/10 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.15)]' 
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                                transactionType === 'spent' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                            }`}>
                                <ArrowUpCircle className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                                <span className={`block font-bold text-sm ${transactionType === 'spent' ? 'text-white' : 'text-slate-400'}`}>Money spent</span>
                                <span className="text-xs text-slate-500 uppercase tracking-widest font-medium">Expense / Cost</span>
                            </div>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <Input
                            label="Transaction Date *"
                            type="date"
                            value={formData.entryDate}
                            onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                        />
                        <Input
                            label="Reference (Optional)"
                            type="text"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            placeholder="e.g., INV-001, Check #123"
                        />
                    </div>

                    <Input
                        label="What is this transaction for? *"
                        type="text"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="e.g., Monthly office rent, Client payment for web design"
                    />
                </div>

                {/* Entry Lines */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Transaction lines</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={addLine}
                            icon={<Plus className="w-4 h-4" />}
                            className="text-teal-400 hover:text-teal-300"
                        >
                            Add line
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {formData.lines.map((line, index) => (
                            <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800 group hover:border-slate-700 transition-all">
                                <div className="flex-[2] w-full">
                                    <select
                                        value={line.accountId}
                                        onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all cursor-pointer"
                                    >
                                        <option value="">Select category...</option>
                                        {accounts
                                            .filter(a => transactionType === 'received' ? (a.accountType === 'revenue' || a.accountType === 'other_income') : (a.accountType === 'expense' || a.accountType === 'other_expense'))
                                            .map(account => (
                                            <option key={account.id} value={account.id}>
                                                {account.accountName}
                                            </option>
                                        ))}
                                        {accounts.filter(a => transactionType === 'received' ? (a.accountType === 'revenue' || a.accountType === 'other_income') : (a.accountType === 'expense' || a.accountType === 'other_expense')).length === 0 && (
                                            <option disabled>No {transactionType === 'received' ? 'revenue' : 'expense'} accounts found.</option>
                                        )}
                                    </select>
                                </div>
                                <div className="flex-[2] w-full">
                                    <input
                                        type="text"
                                        value={line.description}
                                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                                        placeholder="Note (optional)..."
                                    />
                                </div>
                                <div className="flex-1 w-full flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm font-mono">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={line.amount || ''}
                                            onChange={(e) => updateLine(index, 'amount', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 text-right focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-mono"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    {formData.lines.length > 1 && (
                                        <button
                                            onClick={() => removeLine(index)}
                                            className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${totalAmount > 0 ? 'bg-teal-500/5 border-teal-500/20 text-teal-400' : 'bg-slate-800/50 border-slate-700/50 text-slate-500'}`}>
                        <div className="flex items-center gap-2">
                            {totalAmount > 0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                            <span className="text-sm font-bold uppercase tracking-tight">
                                {totalAmount > 0 ? 'Transaction balanced' : 'Enter amount'}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-xs block uppercase tracking-widest font-bold opacity-60">Total Value</span>
                            <span className="text-xl font-mono font-bold text-white">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 pt-4">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1"
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="outline"
                        className="flex-1 border-slate-700"
                        disabled={loading}
                    >
                        Save as draft
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={!isValid || loading}
                        isLoading={loading}
                        className="flex-[2] bg-teal-600 hover:bg-teal-500 text-white"
                    >
                        Save transaction
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

