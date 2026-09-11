import React, { useRef, useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { X, Check, PenTool, RotateCcw, Loader2, BookmarkCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { stampSavedSignature, stampSignatureCanvas } from '@/lib/contracts/signatureImage';
import type { SavedSignature } from '@/lib/contracts/signerProfile';

interface SignaturePadProps {
    onSave: (dataUrl: string, fullName: string) => void;
    onClear: () => void;
    /**
     * The signer's previously adopted signature. When present the pad offers a
     * one-click "Sign with saved signature" instead of forcing a redraw.
     */
    savedSignature?: Pick<SavedSignature, 'dataUrl' | 'fullName'> | null;
    /**
     * Called with the *clean* (unstamped) signature after the signer adopts a
     * freshly drawn one with "remember" ticked. Omit to hide the remember option
     * (e.g. on the public client signing page).
     */
    onRememberSignature?: (cleanDataUrl: string, fullName: string) => void | Promise<void>;
    /** Pre-fill the legal name field (e.g. from the saved profile). */
    initialFullName?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
    onSave,
    onClear,
    savedSignature = null,
    onRememberSignature,
    initialFullName = '',
}) => {
    const { t } = useLanguage();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [fullName, setFullName] = useState(initialFullName);
    const [hasDrawn, setHasDrawn] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalSignatureData, setModalSignatureData] = useState<string | null>(null);
    const [rememberSignature, setRememberSignature] = useState(Boolean(onRememberSignature));
    const [applyingSaved, setApplyingSaved] = useState(false);

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
        if (!canvas || !ctx) return;

        // Capture the strokes before stamping so the remembered copy can be
        // re-stamped with a fresh date on every future contract.
        const cleanDataUrl = canvas.toDataURL('image/png', 1.0);
        stampSignatureCanvas(ctx, canvas.width, canvas.height, { fullName });
        const dataUrl = canvas.toDataURL('image/png', 1.0);

        setModalSignatureData(dataUrl);
        setIsConfirmed(true);
        onSave(dataUrl, fullName);
        setIsModalOpen(false);
        if (rememberSignature && onRememberSignature) {
            void onRememberSignature(cleanDataUrl, fullName.trim());
        }
    };

    const handleUseSaved = async () => {
        if (!savedSignature) return;
        setApplyingSaved(true);
        try {
            const stamped = await stampSavedSignature(savedSignature.dataUrl, { fullName: savedSignature.fullName });
            setFullName(savedSignature.fullName);
            setModalSignatureData(stamped);
            setIsConfirmed(true);
            onSave(stamped, savedSignature.fullName);
        } finally {
            setApplyingSaved(false);
        }
    };

    const handleClear = () => {
        setFullName(initialFullName);
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
    }, []);


    if (isConfirmed && modalSignatureData) {
        return (
            <div className="space-y-4">
                <div className="border border-green-500/30 bg-slate-900/40 rounded-2xl p-5 flex flex-col items-center justify-center relative">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">{t('Adopted Signature')}</p>
                    <img src={modalSignatureData} alt={t('Signature')} className="h-20 object-contain bg-white p-2 rounded-xl" />
                    <p className="text-sm font-semibold text-white font-mono mt-3">{fullName}</p>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="mt-4 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
                    >
                        {t('Clear & Sign Again')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {savedSignature ? (
                <div
                    className="border border-teal-500/30 bg-slate-900/40 rounded-2xl p-5 flex flex-col items-center gap-3"
                    data-testid="saved-signature-card"
                >
                    <p className="text-[10px] text-teal-300 font-black uppercase tracking-widest flex items-center gap-1.5">
                        <BookmarkCheck className="w-3.5 h-3.5" /> {t('Your saved signature')}
                    </p>
                    <img
                        src={savedSignature.dataUrl}
                        alt={t('Saved signature')}
                        className="h-16 object-contain bg-white px-3 py-1.5 rounded-xl"
                    />
                    <p className="text-sm font-semibold text-white font-mono">{savedSignature.fullName}</p>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={handleUseSaved}
                            disabled={applyingSaved}
                            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-900/25"
                        >
                            {applyingSaved ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            {t('Sign with saved signature')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                        >
                            <PenTool className="w-3.5 h-3.5" /> {t('Draw a new signature')}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    className="w-full h-36 border-2 border-dashed border-white/10 hover:border-teal-500/40 bg-slate-900/40 hover:bg-slate-900/60 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all"
                >
                    <div className="p-3 bg-teal-500/10 rounded-xl group-hover:scale-110 transition-transform">
                        <PenTool className="w-5 h-5 text-teal-400" />
                    </div>
                    <span className="text-sm font-bold text-white uppercase tracking-wider text-[11px]">{t('Click to Sign Document')}</span>
                    <span className="text-[10px] text-slate-500">{t('Opens secure full-screen e-sign canvas')}</span>
                </button>
            )}

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[1100] flex flex-col bg-slate-950/95 backdrop-blur-md overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 bg-slate-900/50 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-white text-base font-black uppercase tracking-wider">{t('Secure E-Signature')}</h3>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-mono">{t('Sign below to execute the agreement')}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setIsModalOpen(false); handleClear(); }}
                                className="p-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                aria-label={t('Close')}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-6 flex flex-col gap-6 justify-between max-w-lg mx-auto w-full overflow-y-auto">
                            {/* Legal Name */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                    {t('Legal Full Name')} *
                                </label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder={t('Type your official legal name')}
                                    className="w-full bg-slate-905 border border-white/10 rounded-2xl p-4 text-white text-base font-medium outline-none focus:ring-2 focus:ring-teal-500 placeholder-slate-600"
                                />
                            </div>

                            {/* Canvas Drawing Board */}
                            <div className="flex-1 flex flex-col gap-2 min-h-[250px]">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <PenTool className="w-3.5 h-3.5 text-teal-400" /> {t('Draw Signature')} *
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
                                            <RotateCcw className="w-3.5 h-3.5" /> {t('Clear Canvas')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {onRememberSignature && (
                                <label className="flex items-start gap-3 rounded-2xl border border-white/5 bg-slate-900/60 p-4 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={rememberSignature}
                                        onChange={(e) => setRememberSignature(e.target.checked)}
                                        className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500"
                                    />
                                    <span className="text-xs text-slate-300 leading-relaxed">
                                        <span className="font-bold text-white block">{t('Remember this signature')}</span>
                                        {t('Next time you can sign any contract with one click instead of drawing again. You can replace it anytime under My signature.')}
                                    </span>
                                </label>
                            )}

                            {/* Sticky Actions */}
                            <div className="flex gap-4 border-t border-white/5 pt-4">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); handleClear(); }}
                                    className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 border border-white/5 text-slate-300 rounded-2xl font-bold text-sm transition-all text-center"
                                >
                                    {t('Cancel')}
                                </button>
                                <button
                                    type="button"
                                    disabled={!fullName.trim() || !hasDrawn}
                                    onClick={handleConfirm}
                                    className="flex-1 py-4 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm transition-all text-center shadow-lg shadow-teal-900/25 flex items-center justify-center gap-2"
                                >
                                    <Check className="w-4 h-4" /> {t('Adopt & Sign')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};
