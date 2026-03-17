import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
    onSave: (dataUrl: string, fullName: string) => void;
    onClear: () => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [fullName, setFullName] = useState('');
    const [hasDrawn, setHasDrawn] = useState(false);
    const [isConfirmed, setIsConfirmed] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Fill background with white to prevent PDF transparency issues
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
            }
        }
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (isConfirmed) return;
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
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            setHasDrawn(true);
        }
    };

    const handleConfirm = () => {
        if (!fullName.trim() || !hasDrawn) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            // Draw the name on the canvas
            ctx.font = '14px Arial';
            ctx.fillStyle = '#64748b'; // slate-500
            ctx.textAlign = 'right';
            ctx.fillText(`Signed by: ${fullName}`, canvas.width - 10, canvas.height - 10);

            ctx.textAlign = 'left';
            ctx.fillText(new Date().toLocaleDateString(), 10, canvas.height - 10);

            onSave(canvas.toDataURL('image/png', 1.0), fullName);
            setIsConfirmed(true);
        }
    };

    const getCoordinates = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
        let offsetX, offsetY;
        if ((e as React.TouchEvent).touches) {
            const rect = canvas.getBoundingClientRect();
            const touch = (e as React.TouchEvent).touches?.[0];
            if (touch) {
                offsetX = touch.clientX - rect.left;
                offsetY = touch.clientY - rect.top;
            } else {
                offsetX = 0;
                offsetY = 0;
            }
        } else {
            offsetX = (e as React.MouseEvent).nativeEvent.offsetX;
            offsetY = (e as React.MouseEvent).nativeEvent.offsetY;
        }
        return { offsetX, offsetY };
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            setHasDrawn(false);
            setIsConfirmed(false);
            onClear();
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Legal Full Name *
                </label>
                <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isConfirmed}
                    placeholder="Enter your legal full name"
                    className="w-full bg-slate-50 border border-slate-300 dark:bg-slate-900 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                />
            </div>

            <div className={`border ${isConfirmed ? 'border-green-500' : 'border-slate-600'} rounded-lg bg-white overflow-hidden touch-none h-40 relative`}>
                <canvas
                    ref={canvasRef}
                    className={`w-full h-full ${isConfirmed ? 'cursor-not-allowed opacity-80' : 'cursor-crosshair'}`}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                {!isConfirmed && hasDrawn && fullName.trim() && (
                    <div className="absolute bottom-2 right-2">
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-lg transition-colors"
                        >
                            Confirm Signature
                        </button>
                    </div>
                )}
            </div>
            <div className="flex justify-between text-sm text-slate-400">
                <span>{isConfirmed ? 'Signature confirmed' : 'Draw your signature above'}</span>
                <button
                    type="button"
                    onClick={handleClear}
                    className="text-teal-400 hover:text-teal-300 transition-colors"
                >
                    Clear Signature
                </button>
            </div>
        </div>
    );
};
