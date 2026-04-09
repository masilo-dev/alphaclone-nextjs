'use client';

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ChartOfAccount } from '../../../services/accounting/chartOfAccountsService';
import { journalEntryService } from '../../../services/accounting/journalEntryService';
import { Modal, Input, Button } from '../../ui/UIComponents';
import { Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface JournalEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    accounts: ChartOfAccount[];
}

export function JournalEntryModal({ isOpen, onClose, onSuccess, accounts }: JournalEntryModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        entryDate: new Date().toISOString().split('T')[0],
        description: '',
        reference: '',
        lines: [
            { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
            { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
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
                    { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
                    { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
                ],
            });
        }
    }, [isOpen]);

    const addLine = () => {
        setFormData({
            ...formData,
            lines: [...formData.lines, { accountId: '', debitAmount: 0, creditAmount: 0, description: '' }],
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
            // Validate lines
            const totalDebits = formData.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
            const totalCredits = formData.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);

            if (Math.abs(totalDebits - totalCredits) > 0.01) {
                toast.error(`Entry not balanced! Debits: $${totalDebits.toFixed(2)}, Credits: $${totalCredits.toFixed(2)}`);
                setLoading(false);
                return;
            }

            const { entry, error: err } = await journalEntryService.createEntry({
                entryDate: formData.entryDate,
                description: formData.description,
                reference: formData.reference || undefined,
                lines: formData.lines.filter(line => line.accountId),
            });

            if (err) {
                toast.error(`Error creating entry: ${err}`);
            } else {
                // Auto-post the entry
                if (entry) {
                    const { success, error: postErr } = await journalEntryService.postEntry(entry.id);
                    if (postErr) {
                        toast.error(`Entry created but posting failed: ${postErr}`);
                    }
                }
                onSuccess();
                onClose();
            }
        } catch (error) {
            console.error('Error creating journal entry:', error);
            toast.error('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const totalDebits = formData.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredits = formData.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Create Journal Entry"
            maxWidth="max-w-4xl"
        >
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Date *"
                        type="date"
                        value={formData.entryDate}
                        onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                    />
                    <Input
                        label="Reference"
                        type="text"
                        value={formData.reference}
                        onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                        placeholder="e.g., INV-001"
                    />
                </div>

                <Input
                    label="Description *"
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="e.g., Record monthly rent expense"
                />

                {/* Entry Lines */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Entry Lines</h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={addLine}
                            icon={<Plus className="w-4 h-4" />}
                            className="text-teal-400 hover:text-teal-300"
                        >
                            Add Line
                        </Button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
                        <table className="min-w-full divide-y divide-slate-800">
                            <thead className="bg-slate-900">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Account</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Debit</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Credit</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {formData.lines.map((line, index) => (
                                    <tr key={index} className="group hover:bg-slate-800/30 transition-colors">
                                        <td className="px-3 py-2">
                                            <select
                                                value={line.accountId}
                                                onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all cursor-pointer"
                                            >
                                                <option value="">Select account...</option>
                                                {accounts.map(account => (
                                                    <option key={account.id} value={account.id}>
                                                        {account.accountCode} - {account.accountName}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="text"
                                                value={line.description}
                                                onChange={(e) => updateLine(index, 'description', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                                                placeholder="Line description..."
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={line.debitAmount || ''}
                                                onChange={(e) => {
                                                    updateLine(index, 'debitAmount', parseFloat(e.target.value) || 0);
                                                    updateLine(index, 'creditAmount', 0);
                                                }}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 text-right focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-mono"
                                                placeholder="0.00"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={line.creditAmount || ''}
                                                onChange={(e) => {
                                                    updateLine(index, 'creditAmount', parseFloat(e.target.value) || 0);
                                                    updateLine(index, 'debitAmount', 0);
                                                }}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 text-right focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-mono"
                                                placeholder="0.00"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {formData.lines.length > 2 && (
                                                <button
                                                    onClick={() => removeLine(index)}
                                                    className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-900/80">
                                <tr className="divide-x divide-slate-800">
                                    <td colSpan={2} className="px-4 py-3 text-right font-bold text-slate-400 text-xs uppercase tracking-widest">Totals</td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-teal-400">
                                        ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-teal-400">
                                        ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className={`p-4 rounded-xl border flex items-center justify-center gap-3 transition-all ${isBalanced ? 'bg-teal-500/5 border-teal-500/20 text-teal-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
                        {isBalanced ? (
                            <><CheckCircle2 className="w-5 h-5" /><span className="text-sm font-bold uppercase tracking-tight">Entry Balanced</span></>
                        ) : (
                            <><AlertCircle className="w-5 h-5" /><span className="text-sm font-bold uppercase tracking-tight">Imbalance Detected: ${(totalDebits - totalCredits).toFixed(2)}</span></>
                        )}
                    </div>
                </div>

                <div className="flex gap-4 pt-4">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="flex-1"
                        disabled={loading}
                    >
                        Discard
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={!isBalanced || loading}
                        isLoading={loading}
                        className="flex-[2]"
                    >
                        Sync to General Ledger
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
