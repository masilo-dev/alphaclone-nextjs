'use client';

import { Input as AlphaCloneInput } from '@/components/ui/input';
import { Select as AlphaCloneSelect } from '@/components/ui/select';


import React, { useState, useRef } from 'react';
import { ocrReceiptService, ParsedReceipt } from '@/services/ocrReceiptService';
import { X, Upload, Scan, Check, FileText, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReceiptOCRScannerModalProps {
  onSaveExpense: (expense: { vendor: string; date: string; amount: number; category: string }) => void;
  onClose: () => void;
}

export function ReceiptOCRScannerModal({
  onSaveExpense,
  onClose,
}: ReceiptOCRScannerModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedReceipt | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setImagePreview(dataUrl);
      setScanning(true);

      try {
        const parsed = await ocrReceiptService.parseReceiptImage(file);
        setParsedData(parsed);
        toast.success('Receipt scanned & extracted!');
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'Receipt text extraction is not available. Enter the expense manually.'
        );
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!parsedData) return;
    onSaveExpense({
      vendor: parsedData.vendorName,
      date: parsedData.date,
      amount: parsedData.totalAmount,
      category: parsedData.category,
    });
    toast.success(`Expense saved: $${parsedData.totalAmount} (${parsedData.vendorName})`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--ws-canvas)]/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[var(--ws-panel)] border border-[var(--ws-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ws-border)] bg-[var(--ws-canvas)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Scan size={16} />
            </div>
            <div>
              <h3 className="type-caption font-black text-[var(--ws-text-primary)] uppercase tracking-wider">Smart Receipt OCR Scanner</h3>
              <p className="type-card-description text-[var(--ws-text-muted)]">Upload receipt image to auto-extract expense details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--ws-border-strong)] hover:border-teal-500/50 bg-[var(--ws-canvas)] rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-teal-500/5 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-[var(--ws-panel)] border border-[var(--ws-border)] flex items-center justify-center mx-auto text-[var(--ws-text-muted)] group-hover:text-teal-400 group-hover:scale-110 transition-all">
                <Upload size={22} />
              </div>
              <p className="type-card-description font-bold text-[var(--ws-text-primary)] mt-3">Click or Drag Receipt Photo Here</p>
              <p className="type-card-description text-[var(--ws-text-muted)] mt-1">Supports PNG, JPG, JPEG up to 10MB</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Image Preview */}
              <div className="relative rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)] overflow-hidden h-56 flex items-center justify-center">
                <img src={imagePreview} alt="Receipt" className="max-h-full object-contain" />
                {scanning && (
                  <div className="absolute inset-0 bg-[var(--ws-canvas)]/80 backdrop-blur-sm flex flex-col items-center justify-center text-teal-400 space-y-2">
                    <Scan size={28} className="animate-bounce" />
                    <span className="type-caption font-bold uppercase tracking-wider">Scanning Receipt OCR...</span>
                  </div>
                )}
              </div>

              {/* Parsed Fields */}
              <div className="space-y-3">
                {parsedData ? (
                  <>
                    <div className="flex items-center justify-between type-ui text-teal-400 bg-teal-500/10 px-3 py-1 rounded-lg border border-teal-500/20 font-bold">
                      <span className="flex items-center gap-1"><Sparkles size={12} /> Confidence Score</span>
                      <span>{parsedData.confidenceScore}% Match</span>
                    </div>

                    <div>
                      <label className="block type-caption font-bold uppercase tracking-wider text-[var(--ws-text-muted)] mb-1">
                        Vendor Name
                      </label>
                      <AlphaCloneInput
                        type="text"
                        value={parsedData.vendorName}
                        onChange={(e) => setParsedData({ ...parsedData, vendorName: e.target.value })}
                        className="w-full px-3 py-2 font-bold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block type-caption font-bold uppercase tracking-wider text-[var(--ws-text-muted)] mb-1">
                          Amount ($)
                        </label>
                        <AlphaCloneInput
                          type="number"
                          value={parsedData.totalAmount}
                          onChange={(e) => setParsedData({ ...parsedData, totalAmount: Number(e.target.value) })}
                          className="w-full px-3 py-2 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block type-caption font-bold uppercase tracking-wider text-[var(--ws-text-muted)] mb-1">
                          Date
                        </label>
                        <AlphaCloneInput
                          type="date"
                          value={parsedData.date}
                          onChange={(e) => setParsedData({ ...parsedData, date: e.target.value })}
                          className="w-full px-3 py-2 font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block type-caption font-bold uppercase tracking-wider text-[var(--ws-text-muted)] mb-1">
                        Expense Category
                      </label>
                      <AlphaCloneSelect
                        value={parsedData.category}
                        onChange={(e) => setParsedData({ ...parsedData, category: e.target.value as any })}
                        className="w-full px-3 py-2 font-bold"
                      >
                        <option value="Software & Tools">Software & Tools</option>
                        <option value="Office & Supplies">Office & Supplies</option>
                        <option value="Travel & Transport">Travel & Transport</option>
                        <option value="Meals & Entertainment">Meals & Entertainment</option>
                        <option value="Utilities">Utilities</option>
                        <option value="General Expense">General Expense</option>
                      </AlphaCloneSelect>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-[var(--ws-text-muted)] type-caption italic">
                    Waiting for scanner completion...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--ws-border)] bg-[var(--ws-canvas)]">
          <button
            onClick={() => {
              setImagePreview(null);
              setParsedData(null);
            }}
            className="type-caption font-bold text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] transition-colors"
          >
            Reset Scanner
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 type-caption font-bold text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!parsedData}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl type-caption font-black uppercase tracking-wider text-slate-950 bg-[var(--brand-blue-400)] hover:bg-teal-300 transition-colors disabled:opacity-50 shadow-lg shadow-teal-500/20"
            >
              <Check size={14} /> Add to Accounting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
