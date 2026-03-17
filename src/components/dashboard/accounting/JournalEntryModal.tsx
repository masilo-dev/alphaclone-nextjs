'use client';

import React, { useState, useEffect } from 'react';
import { ChartOfAccount } from '../../../services/accounting/chartOfAccountsService';
import { journalEntryService } from '../../../services/accounting/journalEntryService';

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
                alert(`Entry not balanced! Debits: $${totalDebits.toFixed(2)}, Credits: $${totalCredits.toFixed(2)}`);
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
                alert(`Error creating entry: ${err}`);
            } else {
                // Auto-post the entry
                if (entry) {
                    const { success, error: postErr } = await journalEntryService.postEntry(entry.id);
                    if (postErr) {
                        alert(`Entry created but posting failed: ${postErr}`);
                    }
                }
                onSuccess();
                onClose();
            }
        } catch (error) {
            console.error('Error creating journal entry:', error);
            alert('An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const totalDebits = formData.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
    const totalCredits = formData.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
            <div className="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-white mb-4">Create Journal Entry</h2>

                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Date *
                            </label>
                            <input
                                type="date"
                                value={formData.entryDate}
                                onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1">
                                Reference
                            </label>
                            <input
                                type="text"
                                value={formData.reference}
                                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                placeholder="e.g., INV-001"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1">
                            Description *
                        </label>
                        <input
                            type="text"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            placeholder="e.g., Record monthly rent expense"
                        />
                    </div>
                </div>

                {/* Entry Lines */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-lg font-semibold text-white">Entry Lines</h3>
                        <button
                            onClick={addLine}
                            className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                        >
                            + Add Line
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-700">
                            <thead className="bg-slate-900">
                                <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Account</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase">Description</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase">Debit</th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-slate-400 uppercase">Credit</th>
                                    <th className="px-3 py-2"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-slate-800 divide-y divide-slate-700">
                                {formData.lines.map((line, index) => (
                                    <tr key={index}>
                                        <td className="px-3 py-2">
                                            <select
                                                value={line.accountId}
                                                onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                                                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                                                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                                                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                                                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 text-white placeholder-slate-400 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                placeholder="0.00"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            {formData.lines.length > 2 && (
                                                <button
                                                    onClick={() => removeLine(index)}
                                                    className="text-red-400 hover:text-red-300 text-sm transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-900">
                                <tr>
                                    <td colSpan={2} className="px-3 py-2 text-right font-semibold text-white">Totals:</td>
                                    <td className="px-3 py-2 text-right font-mono font-semibold text-white">
                                        ${totalDebits.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-semibold text-white">
                                        ${totalCredits.toFixed(2)}
                                    </td>
                                    <td className="px-3 py-2"></td>
                                </tr>
                                <tr>
                                    <td colSpan={5} className="px-3 py-2 text-center">
                                        {isBalanced ? (
                                            <span className="text-green-400 font-semibold">✓ Entry is balanced</span>
                                        ) : (
                                            <span className="text-red-400 font-semibold">
                                                ⚠ Entry not balanced (difference: ${Math.abs(totalDebits - totalCredits).toFixed(2)})
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!isBalanced || loading}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Processing...' : 'Create & Post Entry'}
                    </button>
                </div>
            </div>
        </div>
    );
}
