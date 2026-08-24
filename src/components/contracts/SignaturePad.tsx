import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, PenTool, RotateCcw, FileText } from 'lucide-react';

interface SignaturePadProps {
    onSave: (dataUrl: string, fullName: string) => void;
    onClear: () => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [fullName, setFullName] = useState('');
    const [hasDrawn, setHasDrawn] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalSignatureData, setModalSignatureData] = useState<string | null>(null);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const { offsetX, offsetY } = getCoordinates(e, canvas);
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const { offsetX, offsetY } = getCoordinates(e, canvas);
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
        setHasDrawn(true);
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
        }
    };

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        let offsetX = 0;
        let offsetY = 0;
        
        if ((e as React.TouchEvent).touches) {
            const rect = canvas.getBoundingClientRect();
            const touch = (e as React.TouchEvent).touches?.[0];
            if (touch) {
                offsetX = touch.clientX - rect.left;
                offsetY = touch.clientY - rect.top;
            }
        } else {
            offsetX = (e as React.MouseEvent).nativeEvent.offsetX;
            offsetY = (e as React.MouseEvent).nativeEvent.offsetY;
        }
        return { offsetX, offsetY };
    };

    const clearCanvasOnly = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            setHasDrawn(false);
        }
    };

    const handleConfirm = () => {
        if (!fullName.trim() || !hasDrawn) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.font = '14px Arial';
            ctx.fillStyle = '#64748b';
            ctx.textAlign = 'right';
            ctx.fillText(`Signed by: ${fullName}`, canvas.width - 10, canvas.height - 10);

            ctx.textAlign = 'left';
            ctx.fillText(new Date().toLocaleDateString(), 10, canvas.height - 10);

            const dataUrl = canvas.toDataURL('image/png', 1.0);
            setModalSignatureData(dataUrl);
            setIsConfirmed(true);
            onSave(dataUrl, fullName);
            setIsModalOpen(false);
        }
    };

    const handleClear = () => {
        setFullName('');
        setHasDrawn(false);
        setIsConfirmed(false);
        setModalSignatureData(null);
        onClear();
    };

    const modalCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
        if (canvas) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
            }
            canvasRef.current = canvas;
        }
    }, [isModalOpen]);

    if (isConfirmed && modalSignatureData) {
        return (
            <div className="space-y-4">
                <div className="border border-green-500/30 bg-slate-900/40 rounded-2xl p-5 flex flex-col items-center justify-center relative">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">Adopted Signature</p>
                    <img src={modalSignatureData} alt="Signature" className="h-20 object-contain bg-white p-2 rounded-xl" />
                    <p className="text-sm font-semibold text-white font-mono mt-3">{fullName}</p>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="mt-4 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                    >
                        Clear & Sign Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="w-full h-36 border-2 border-dashed border-white/10 hover:border-teal-500/40 bg-slate-900/40 hover:bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all"
            >
                <div className="p-3 bg-teal-500/10 rounded-xl group-hover:scale-110 transition-transform">
                    <PenTool className="w-5 h-5 text-teal-400" />
                </div>
                <span className="text-sm font-bold text-white uppercase tracking-wider text-[11px]">Click to Sign Document</span>
                <span className="text-[10px] text-slate-500">Opens secure full-screen e-sign canvas</span>
            </button>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[1100] flex flex-col bg-slate-950/95 backdrop-blur-md overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 bg-slate-900/50 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-white text-base font-black uppercase tracking-wider">Secure E-Signature</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">Sign below to execute the agreement</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setIsModalOpen(false); handleClear(); }}
                                className="p-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-6 flex flex-col gap-6 justify-between max-w-lg mx-auto w-full">
                            {/* Legal Name */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                    Legal Full Name *
                                </label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Type your official legal name"
                                    className="w-full bg-slate-905 border border-white/10 rounded-2xl p-4 text-white text-base font-medium outline-none focus:ring-2 focus:ring-teal-500 placeholder-slate-600"
                                />
                            </div>

                            {/* Canvas Drawing Board */}
                            <div className="flex-1 flex flex-col gap-2 min-h-[250px]">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <PenTool className="w-3.5 h-3.5 text-teal-400" /> Draw Signature *
                                </label>
                                <div className="flex-1 bg-white rounded-2xl overflow-hidden relative border border-white/10 shadow-inner min-h-[200px]">
                                    <canvas
                                        ref={modalCanvasRef}
                                        className="w-full h-full cursor-crosshair touch-none"
                                        onMouseDown={startDrawing}
                                        onMouseMove={draw}
                                        onMouseUp={stopDrawing}
                                        onMouseLeave={stopDrawing}
                                        onTouchStart={startDrawing}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDrawing}
                                    />
                                    {hasDrawn && (
                                        <button
                                            type="button"
                                            onClick={clearCanvasOnly}
                                            className="absolute top-3 right-3 p-2 bg-slate-950/80 hover:bg-slate-900 text-slate-400 hover:text-white rounded-xl border border-white/5 transition-all flex items-center gap-1.5 text-xs font-bold"
                                        >
                                            <RotateCcw className="w-3.5 h-3.5" /> Clear Canvas
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Sticky Actions */}
                            <div className="flex gap-4 border-t border-white/5 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); handleClear(); }}
                                    className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 border border-white/5 text-slate-300 rounded-2xl font-bold text-sm transition-all text-center"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={!fullName.trim() || !hasDrawn}
                                    onClick={handleConfirm}
                                    className="flex-1 py-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm transition-all text-center shadow-lg shadow-teal-900/25 flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" /> Adopt & Sign
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
