import React, { useState } from 'react';
import { X, Upload, Loader2, Camera, Receipt } from 'lucide-react';
import { Card, Button, Input, Modal } from '../../ui/UIComponents';
import { useTenant } from '../../../contexts/TenantContext';

interface ReceiptUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (data: any) => void;
}

export default function ReceiptUploadModal({ isOpen, onClose, onSuccess }: ReceiptUploadModalProps) {
    const { currentTenant } = useTenant();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<any | null>(null);

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

    const handleConfirm = () => {
        if (extractedData) {
            onSuccess(extractedData);
            handleClose();
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
                        <div className="text-center text-slate-400 text-sm">
                            Upload a photo or scanned copy of a receipt. Our AI will automatically extract the date, vendor/description, and amount.
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        {!preview ? (
                            <div className="flex justify-center w-full">
                                <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-800/50 hover:bg-slate-800 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Camera className="w-10 h-10 text-teal-500 mb-3" />
                                        <p className="mb-2 text-sm text-slate-300"><span className="font-semibold text-teal-400">Click to upload</span> or drag and drop</p>
                                        <p className="text-xs text-slate-500">PNG, JPG or JPEG (MAX. 5MB)</p>
                                    </div>
                                    <input id="dropzone-file" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                </label>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black/50 aspect-video flex items-center justify-center">
                                    <img src={preview} alt="Receipt preview" className="max-h-full max-w-full object-contain" />
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
                        <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-xl flex items-start gap-4">
                            <Receipt className="w-6 h-6 text-teal-400 shrink-0 mt-1" />
                            <div>
                                <h4 className="text-white font-medium mb-1">Receipt Analyzed Successfully</h4>
                                <p className="text-sm text-slate-400 mb-4">Please review the extracted data before saving.</p>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Description / Vendor</label>
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
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Category</label>
                                        <Input
                                            value={extractedData.category || ''}
                                            onChange={(e) => setExtractedData({ ...extractedData, category: e.target.value })}
                                            placeholder="e.g. Office Supplies, Travel, Software..."
                                            className="bg-slate-900"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                            <Button variant="ghost" onClick={() => setExtractedData(null)}>
                                Retry Upload
                            </Button>
                            <Button onClick={handleConfirm}>
                                Confirm & Save Expense
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}
