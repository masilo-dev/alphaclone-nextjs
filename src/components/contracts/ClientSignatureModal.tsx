'use client';

import React, { useRef, useState, useEffect } from 'react';
import { X, Check, RotateCcw, PenTool, ShieldCheck, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface ClientSignatureModalProps {
  contractTitle: string;
  clientName: string;
  onSaveSignature: (signatureDataUrl: string, signerName: string) => void;
  onClose: () => void;
}

export function ClientSignatureModal({
  contractTitle,
  clientName,
  onSaveSignature,
  onClose,
}: ClientSignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState(clientName);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High resolution canvas setup
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#38bdf8'; // Sky 400
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = () => {
    if (!hasSignature) {
      toast.error('Please draw your signature before submitting');
      return;
    }
    if (!signerName.trim()) {
      toast.error('Please enter the signer full name');
      return;
    }
    if (!agreed) {
      toast.error('You must agree to the legally binding terms');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSaveSignature(dataUrl, signerName.trim());
    toast.success('Signature recorded successfully');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <PenTool size={16} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Execute E-Signature</h3>
              <p className="text-xs text-slate-400 truncate max-w-xs">{contractTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Signer Legal Name
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-teal-500/50 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Signature Pad (Draw below)
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-white transition-colors"
              >
                <RotateCcw size={12} /> Clear
              </button>
            </div>
            <div className="relative rounded-xl border border-dashed border-white/20 bg-slate-950 overflow-hidden touch-none">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-40 cursor-crosshair"
              />
              {!hasSignature && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-600 text-xs font-medium">
                  Draw your signature here with mouse or touch
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 bg-teal-500/5 border border-teal-500/20 rounded-xl">
            <input
              type="checkbox"
              id="legal-agree"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 rounded border-white/20 bg-slate-950 text-teal-500 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="legal-agree" className="text-xs text-slate-300 leading-relaxed cursor-pointer">
              I acknowledge that this electronic signature carries the same legal weight as a handwritten signature under the ESIGN and UETA Acts.
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-slate-950">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck size={14} className="text-teal-400" /> 256-Bit SSL Secured
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-950 bg-teal-400 hover:bg-teal-300 transition-colors shadow-lg shadow-teal-500/20"
            >
              <Check size={14} /> Execute & Sign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
