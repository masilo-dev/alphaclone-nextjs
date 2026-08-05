'use client';

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
        toast.error('Failed to parse receipt image');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Scan size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Smart Receipt OCR Scanner</h3>
              <p className="text-xs text-slate-400">Upload receipt image to auto-extract expense details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 hover:border-teal-500/50 bg-slate-950 rounded-2xl p-8 text-center cursor-pointer transition-all hover:bg-teal-500/5 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center mx-auto text-slate-400 group-hover:text-teal-400 group-hover:scale-110 transition-all">
                <Upload size={22} />
              </div>
              <p className="text-xs font-bold text-white mt-3">Click or Drag Receipt Photo Here</p>
              <p className="text-[11px] text-slate-500 mt-1">Supports PNG, JPG, JPEG up to 10MB</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Image Preview */}
              <div className="relative rounded-xl border border-white/10 bg-slate-950 overflow-hidden h-56 flex items-center justify-center">
                <img src={imagePreview} alt="Receipt" className="max-h-full object-contain" />
                {scanning && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-teal-400 space-y-2">
                    <Scan size={28} className="animate-bounce" />
                    <span className="text-xs font-bold uppercase tracking-wider">Scanning Receipt OCR...</span>
                  </div>
                )}
              </div>

              {/* Parsed Fields */}
              <div className="space-y-3">
                {parsedData ? (
                  <>
                    <div className="flex items-center justify-between text-[11px] text-teal-400 bg-teal-500/10 px-3 py-1 rounded-lg border border-teal-500/20 font-bold">
                      <span className="flex items-center gap-1"><Sparkles size={12} /> Confidence Score</span>
                      <span>{parsedData.confidenceScore}% Match</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Vendor Name
                      </label>
                      <input
                        type="text"
                        value={parsedData.vendorName}
                        onChange={(e) => setParsedData({ ...parsedData, vendorName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-teal-500/50"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Amount ($)
                        </label>
                        <input
                          type="number"
                          value={parsedData.totalAmount}
                          onChange={(e) => setParsedData({ ...parsedData, totalAmount: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-teal-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Date
                        </label>
                        <input
                          type="date"
                          value={parsedData.date}
                          onChange={(e) => setParsedData({ ...parsedData, date: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-teal-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Expense Category
                      </label>
                      <select
                        value={parsedData.category}
                        onChange={(e) => setParsedData({ ...parsedData, category: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-bold outline-none focus:border-teal-500/50"
                      >
                        <option value="Software & Tools">Software & Tools</option>
                        <option value="Office & Supplies">Office & Supplies</option>
                        <option value="Travel & Transport">Travel & Transport</option>
                        <option value="Meals & Entertainment">Meals & Entertainment</option>
                        <option value="Utilities">Utilities</option>
                        <option value="General Expense">General Expense</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                    Waiting for scanner completion...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-slate-950">
          <button
            onClick={() => {
              setImagePreview(null);
              setParsedData(null);
            }}
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            Reset Scanner
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!parsedData}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors disabled:opacity-50 shadow-lg shadow-teal-500/20"
            >
              <Check size={14} /> Add to Accounting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
