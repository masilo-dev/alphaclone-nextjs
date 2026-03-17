import React, { useRef, useEffect, useState } from 'react';
import { Card, Button } from '../ui/UIComponents';
import { Trash2 } from 'lucide-react';
import { User } from '../../types';

interface SharedWhiteboardProps {
    documentId: string;
    user: User;
    onClose?: () => void;
}

const SharedWhiteboard: React.FC<SharedWhiteboardProps> = ({ onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#2dd4bf');
    const [brushSize, setBrushSize] = useState(3);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const resizeCanvas = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        return () => window.removeEventListener('resize', resizeCanvas);
    }, []);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
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
    };

    const colors = ['#2dd4bf', '#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444', '#ffffff', '#000000'];

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col">
                {/* Toolbar */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="flex gap-2">
                            {colors.map((c) => (
                                <button
                                    key={c}
                                    onClick={() => setColor(c)}
                                    className={`w-8 h-8 rounded border-2 transition-all ${
                                        color === c ? 'border-white scale-110' : 'border-slate-700'
                                    }`}
                                    style={{ backgroundColor: c }}
                                />
                            ))}
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="w-24"
                        />
                        <span className="text-sm text-slate-400">{brushSize}px</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={clearCanvas}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Clear
                        </Button>
                        {onClose && (
                            <Button variant="outline" size="sm" onClick={onClose}>
                                Close
                            </Button>
                        )}
                    </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 overflow-hidden bg-white">
                    <canvas
                        ref={canvasRef}
                        className="w-full h-full cursor-crosshair"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                    />
                </div>
            </Card>
        </div>
    );
};

export default SharedWhiteboard;

