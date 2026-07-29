import React, { useState } from 'react';
import Image from 'next/image';
import { X, Upload, Loader2, Camera, Receipt } from 'lucide-react';
import { Card, Button, Input, Modal } from '../../ui/UIComponents';
import { useTenant } from '../../../contexts/TenantContext';

import { chartOfAccountsService, ChartOfAccount } from '../../../services/accounting/chartOfAccountsService';
import { receiptService } from '../../../services/accounting/receiptService';
import toast from 'react-hot-toast';
<<<<<<< HEAD
import { DailyCall } from '@daily-co/daily-js';
import { sendAuditToMeeting } from '../../../lib/meetingAudit';
=======
>>>>>>> origin/main

interface ReceiptUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    accounts: ChartOfAccount[];
<<<<<<< HEAD
    callObject?: DailyCall | null;
}

export default function ReceiptUploadModal({ isOpen, onClose, onSuccess, accounts, callObject }: ReceiptUploadModalProps) {
=======
}

export default function ReceiptUploadModal({ isOpen, onClose, onSuccess, accounts }: ReceiptUploadModalProps) {
>>>>>>> origin/main
    const { currentTenant } = useTenant();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<any | null>(null);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [selectedAssetAccountId, setSelectedAssetAccountId] = useState('');
    const [isPaid, setIsPaid] = useState(true);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) {
            if (!selected.type.startsWith('image/')) {
                setError('Please upload an image file (JPEG, PNG, etc).');
                return;
            }
            if (selected.size > 5 * 1024 * 1024) { // 5MB limit
                setError('File must be less than 5MB');
                return;
            }
            setFile(selected);
            setError(null);
            setExtractedData(null);

            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(selected);
        }
    };

    const handleProcessReceipt = async () => {
        if (!file || !currentTenant) return;

        setIsProcessing(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('tenantId', currentTenant.id);

            const res = await fetch('/api/ai/vision', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to process receipt');
            }

            setExtractedData(data.data);

        } catch (err: any) {
            console.error('Error processing receipt:', err);
            setError(err.message || 'Failed to analyze the receipt. Please try entering manually.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirm = async () => {
        if (!extractedData || !currentTenant) return;
        
        setIsSaving(true);
        try {
            const { receipt, error: createError } = await receiptService.createReceipt({
                receiptDate: extractedData.date,
                description: extractedData.description,
                amount: extractedData.amount,
                category: extractedData.category,
                accountId: selectedAccountId || undefined,
<<<<<<< HEAD
                status: 'pending',
                assetAccountId: isPaid ? (selectedAssetAccountId || undefined) : undefined,
                imageUrl: extractedData.receiptUrl || undefined,
=======
                status: isPaid ? 'paid' : 'pending',
                assetAccountId: isPaid ? (selectedAssetAccountId || undefined) : undefined,
                imageUrl: preview || undefined, // In production, this would be a permanent URL
>>>>>>> origin/main
                rawAiData: extractedData
            });

            if (createError) throw new Error(createError);

            if (isPaid && receipt && selectedAssetAccountId) {
                const { error: payError } = await receiptService.markAsPaid(receipt.id, selectedAssetAccountId);
                if (payError) toast.error(`Linked to ledger failed: ${payError}`);
                else toast.success('Expense recorded and paid!');
            } else {
                toast.success('Receipt saved as pending expense');
            }

<<<<<<< HEAD
            // Send audit to meeting
            if (callObject) {
                sendAuditToMeeting(callObject, {
                    source: 'accounting',
                    type: 'receipt_saved',
                    details: {
                        receiptId: receipt?.id,
                        description: extractedData.description,
                        amount: extractedData.amount,
                        category: extractedData.category,
                    },
                    timestamp: new Date().toISOString(),
                });
            }

=======
>>>>>>> origin/main
            onSuccess();
            handleClose();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save receipt');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setPreview(null);
        setExtractedData(null);
        setError(null);
        setIsProcessing(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Upload Receipt for AI Extraction">
            <div className="space-y-6">
                {!extractedData ? (
                    <>
                        <div className="text-center text-slate-300 text-sm">
                            Upload a photo or scanned copy of a receipt. Our AI will automatically extract the date, vendor/description, and amount.
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {!preview ? (
                            <div className="flex justify-center w-full">
                                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-900/60 hover:bg-slate-900 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Camera className="w-10 h-10 text-emerald-400 mb-3" />
                                        <p className="mb-2 text-sm text-slate-300"><span className="font-semibold text-emerald-400">Click to upload</span> or drag and drop</p>
                                        <p className="text-xs text-slate-400">PNG, JPG or JPEG (MAX. 5MB)</p>
                                    </div>
                                    <input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                </label>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black/50 aspect-video flex items-center justify-center">
                                    <Image
                                        src={preview}
                                        alt="Receipt preview"
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                    <button
                                        onClick={() => { setFile(null); setPreview(null); }}
                                        className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black text-white rounded-full transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <Button
                                    className="w-full"
                                    onClick={handleProcessReceipt}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing using Vision AI...</>
                                    ) : (
                                        <><Upload className="w-4 h-4 mr-2" /> Extract Data</>
                                    )}
                                </Button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="space-y-6">
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-4">
                            <Receipt className="w-6 h-6 text-emerald-400 shrink-0 mt-1" />
                            <div>
                                <h4 className="text-white font-medium mb-1">Receipt Analyzed Successfully</h4>
                                <p className="text-sm text-slate-300 mb-4">Please review the extracted data before saving.</p>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">Description / Vendor</label>
                                        <Input
                                            value={extractedData.description || ''}
                                            onChange={(e) => setExtractedData({ ...extractedData, description: e.target.value })}
                                            className="bg-slate-900"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Date</label>
                                            <Input
                                                type="date"
                                                value={extractedData.date || ''}
                                                onChange={(e) => setExtractedData({ ...extractedData, date: e.target.value })}
                                                className="bg-slate-900"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Amount</label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={extractedData.amount || ''}
                                                onChange={(e) => setExtractedData({ ...extractedData, amount: parseFloat(e.target.value) })}
                                                className="bg-slate-900"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Category / Expense Account</label>
                                        <select
                                            value={selectedAccountId}
                                            onChange={(e) => setSelectedAccountId(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all cursor-pointer"
                                        >
                                            <option value="">Select account...</option>
                                            {accounts
                                                .filter(a => a.accountType === 'expense' || a.accountType === 'other_expense')
                                                .map(account => (
                                                <option key={account.id} value={account.id}>
                                                    {account.accountName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="pt-4 border-t border-slate-800">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm font-bold text-white">Already Paid?</span>
                                            <button 
                                                onClick={() => setIsPaid(!isPaid)}
                                                className={`w-12 h-6 rounded-full transition-colors relative ${isPaid ? 'bg-teal-500' : 'bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isPaid ? 'right-1' : 'left-1'}`} />
                                            </button>
                                        </div>

                                        {isPaid && (
                                            <div>
                                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Paid from account</label>
                                                <select
                                                    value={selectedAssetAccountId}
                                                    onChange={(e) => setSelectedAssetAccountId(e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all cursor-pointer"
                                                >
                                                    <option value="">Select cash/bank account...</option>
                                                    {accounts
                                                        .filter(a => a.accountType === 'asset' || a.accountType === 'liability')
                                                        .map(account => (
                                                        <option key={account.id} value={account.id}>
                                                            {account.accountName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                            <Button variant="ghost" onClick={() => setExtractedData(null)} disabled={isSaving}>
                                Retry Upload
                            </Button>
                            <Button onClick={handleConfirm} isLoading={isSaving} disabled={!selectedAccountId || (isPaid && !selectedAssetAccountId)}>
                                Confirm & Save Expense
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
