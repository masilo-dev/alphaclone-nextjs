import React, { useState, useRef, useEffect } from 'react';
import {
    X,
    MessageSquare,
    Plus,
    Save,
    Trash2,
    Maximize2,
    Minimize2,
    Eraser,
    Type,
    MousePointer2,
    Download,
    PenLine
} from 'lucide-react';
import { Button } from '../ui/UIComponents';
import { toast } from 'react-hot-toast';

interface Annotation {
    id: string;
    type: 'note' | 'redact' | 'text' | 'signature';
    x: number;
    y: number;
    text?: string;
    signatureType?: 'draw' | 'type';
    signatureData?: string; // base64 for drawn signatures
    width?: number;
    height?: number;
    author: string;
    createdAt: number;
}

interface DocumentViewerProps {
    url: string;
    onSaveAnnotations?: (annotations: Annotation[]) => void;
    initialAnnotations?: Annotation[];
    userName: string;
    onDownload?: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
    url,
    onSaveAnnotations,
    initialAnnotations = [],
    userName,
    onDownload
}) => {
    const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
    const [tool, setTool] = useState<'select' | 'note' | 'redact' | 'text' | 'signature'>('select');
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);

    const handleContainerClick = (e: React.MouseEvent) => {
        if (tool === 'select' || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const newAnnotation: Annotation = {
            id: Date.now().toString(),
            type: tool as 'note' | 'redact' | 'text' | 'signature',
            x,
            y,
            text: tool === 'signature' ? userName : '',
            signatureType: tool === 'signature' ? 'type' : undefined,
            width: tool === 'redact' ? 20 : undefined,
            height: tool === 'redact' ? 5 : undefined,
            author: userName,
            createdAt: Date.now()
        };

        setAnnotations([...annotations, newAnnotation]);
        setActiveAnnotation(newAnnotation.id);
        setTool('select');
    };

    const updateAnnotation = (id: string, updates: Partial<Annotation>) => {
        setAnnotations(annotations.map(a => a.id === id ? { ...a, ...updates } : a));
    };

    const deleteAnnotation = (id: string) => {
        setAnnotations(annotations.filter(a => a.id !== id));
        if (activeAnnotation === id) setActiveAnnotation(null);
    };

    const handleSave = () => {
        if (onSaveAnnotations) {
            onSaveAnnotations(annotations);
            toast.success('All changes saved');
        }
    };

    return (
        <div className={`relative flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[60] m-0 rounded-none' : 'h-[750px]'}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
                <div className="flex items-center gap-1">
                    <Button size="sm" variant={tool === 'select' ? 'primary' : 'ghost'} onClick={() => setTool('select')} className="w-10 h-10 p-0">
                        <MousePointer2 className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-slate-700 mx-1" />
                    <Button size="sm" variant={tool === 'note' ? 'primary' : 'ghost'} onClick={() => setTool('note')} className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        <span className="hidden sm:inline">Comment</span>
                    </Button>
                    <Button size="sm" variant={tool === 'text' ? 'primary' : 'ghost'} onClick={() => setTool('text')} className="flex items-center gap-2">
                        <Type className="w-4 h-4" />
                        <span className="hidden sm:inline">Type</span>
                    </Button>
                    <Button size="sm" variant={tool === 'signature' ? 'primary' : 'ghost'} onClick={() => setTool('signature')} className="flex items-center gap-2">
                        <PenLine className="w-4 h-4" />
                        <span className="hidden sm:inline">Signature</span>
                    </Button>
                    <Button size="sm" variant={tool === 'redact' ? 'primary' : 'ghost'} onClick={() => setTool('redact')} className="flex items-center gap-2">
                        <Eraser className="w-4 h-4" />
                        <span className="hidden sm:inline">Delete Content</span>
                    </Button>
                </div>
                <div className="flex items-center gap-2">
                    {onDownload && (
                        <Button size="sm" variant="outline" onClick={onDownload}>
                            <Download className="w-4 h-4" />
                        </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setIsFullscreen(!isFullscreen)}>
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="primary" onClick={handleSave} className="bg-teal-600 hover:bg-teal-500">
                        <Save className="w-4 h-4 mr-2" />
                        Commit Edits
                    </Button>
                </div>
            </div>

            {/* Viewer Area */}
            <div className="flex-1 relative overflow-auto bg-slate-950" ref={containerRef} onClick={handleContainerClick}>
                <div className="relative shadow-2xl shadow-black/50 overflow-hidden h-full">
                    <iframe
                        src={`${url}#view=FitH`}
                        className="w-full h-full border-none bg-white"
                        title="Document Viewer"
                    />

                    <div className="absolute inset-0 pointer-events-none">
                        {annotations.map((anno) => (
                            <div
                                key={anno.id}
                                className="absolute pointer-events-auto"
                                style={{
                                    left: `${anno.x}%`,
                                    top: `${anno.y}%`,
                                    transform: anno.type === 'redact' ? 'none' : 'translate(-50%, -50%)',
                                    zIndex: activeAnnotation === anno.id ? 20 : 10
                                }}
                            >
                                {anno.type === 'note' && (
                                    <div className="relative group">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActiveAnnotation(anno.id === activeAnnotation ? null : anno.id); }}
                                            className={`w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-all ${activeAnnotation === anno.id ? 'bg-teal-500 scale-125' : 'bg-teal-600 hover:scale-110'}`}
                                        >
                                            <MessageSquare className="w-3.5 h-3.5 text-white" />
                                        </button>
                                        {activeAnnotation === anno.id && (
                                            <div className="absolute top-0 left-full ml-4 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-3 z-30 animate-fade-in origin-left">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">Note - {anno.author}</span>
                                                    <button onClick={() => deleteAnnotation(anno.id)} className="text-slate-500 hover:text-red-400">
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <textarea
                                                    autoFocus
                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-teal-500 min-h-[80px]"
                                                    value={anno.text}
                                                    onChange={(e) => updateAnnotation(anno.id, { text: e.target.value })}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {anno.type === 'text' && (
                                    <div className="relative">
                                        {activeAnnotation === anno.id ? (
                                            <input
                                                autoFocus
                                                className="bg-white text-black font-serif border-b border-teal-500 outline-none p-1 shadow-sm leading-none min-w-[50px] pointer-events-auto"
                                                value={anno.text}
                                                onChange={(e) => updateAnnotation(anno.id, { text: e.target.value })}
                                                onBlur={() => setActiveAnnotation(null)}
                                            />
                                        ) : (
                                            <span
                                                className="text-black font-serif cursor-text bg-white/10 hover:bg-white/40 px-1 py-0.5 rounded transition-colors"
                                                onClick={(e) => { e.stopPropagation(); setActiveAnnotation(anno.id); }}
                                            >
                                                {anno.text || 'Type here...'}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {anno.type === 'redact' && (
                                    <div
                                        className={`bg-black border border-white/10 relative group ${activeAnnotation === anno.id ? 'ring-2 ring-teal-500' : ''}`}
                                        style={{ width: `${anno.width}%`, height: `${anno.height}%` }}
                                        onClick={(e) => { e.stopPropagation(); setActiveAnnotation(anno.id); }}
                                    >
                                        {activeAnnotation === anno.id && (
                                            <button
                                                onClick={() => deleteAnnotation(anno.id)}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                {anno.type === 'signature' && (
                                    <div className="relative group">
                                        {anno.signatureType === 'draw' && anno.signatureData ? (
                                            <div
                                                className="cursor-pointer hover:scale-105 transition-transform"
                                                onClick={(e) => { e.stopPropagation(); setActiveAnnotation(anno.id); }}
                                            >
                                                <img src={anno.signatureData} alt="Signature" className="max-h-16 pointer-events-none" />
                                            </div>
                                        ) : (
                                            <span
                                                className="text-teal-600 text-2xl cursor-pointer hover:scale-105 transition-transform block whitespace-nowrap font-signature"
                                                style={{ fontFamily: "'Dancing Script', 'Sacramento', cursive" }}
                                                onClick={(e) => { e.stopPropagation(); setActiveAnnotation(anno.id); }}
                                            >
                                                {anno.text || userName}
                                            </span>
                                        )}

                                        {activeAnnotation === anno.id && (
                                            <div className="absolute top-0 left-full ml-4 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 z-30 animate-fade-in pointer-events-auto origin-left">
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex bg-slate-950/50 p-1 rounded-lg border border-white/5">
                                                        <button
                                                            onClick={() => updateAnnotation(anno.id, { signatureType: 'type' })}
                                                            className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${anno.signatureType === 'type' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:text-white'}`}
                                                        >
                                                            Type
                                                        </button>
                                                        <button
                                                            onClick={() => updateAnnotation(anno.id, { signatureType: 'draw' })}
                                                            className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-all ${anno.signatureType === 'draw' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:text-white'}`}
                                                        >
                                                            Draw
                                                        </button>
                                                    </div>
                                                    <button onClick={() => deleteAnnotation(anno.id)} className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                {anno.signatureType === 'type' ? (
                                                    <input
                                                        autoFocus
                                                        placeholder="Enter Full Name"
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white outline-none focus:border-teal-500"
                                                        style={{ fontFamily: "'Dancing Script', cursive" }}
                                                        value={anno.text}
                                                        onChange={(e) => updateAnnotation(anno.id, { text: e.target.value })}
                                                    />
                                                ) : (
                                                    <SignatureCanvas
                                                        onSave={(data) => updateAnnotation(anno.id, { signatureData: data })}
                                                        initialData={anno.signatureData}
                                                    />
                                                )}
                                                <div className="mt-3 flex justify-end">
                                                    <Button size="sm" variant="primary" onClick={() => setActiveAnnotation(null)} className="text-[10px] h-8">Done</Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-800/90 backdrop-blur-md text-white text-[10px] font-bold rounded-full shadow-lg border border-white/5 uppercase tracking-widest pointer-events-none">
                {tool === 'note' && 'Click to drop a note'}
                {tool === 'redact' && 'Drag to redact/delete content'}
                {tool === 'text' && 'Click to type/edit text'}
                {tool === 'signature' && 'Click to drop your signature'}
                {tool === 'select' && 'Select tools to edit document'}
            </div>
        </div>
    );
};

const SignatureCanvas: React.FC<{ onSave: (data: string) => void; initialData?: string }> = ({ onSave, initialData }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);

    useEffect(() => {
        if (initialData && canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            const img = new Image();
            img.onload = () => ctx?.drawImage(img, 0, 0);
            img.src = initialData;
        }
    }, []);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        isDrawing.current = true;
        draw(e);
    };

    const stopDrawing = () => {
        isDrawing.current = false;
        if (canvasRef.current) {
            onSave(canvasRef.current.toDataURL());
        }
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current || !canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
        const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0d9488'; // teal-600

        if (!('touches' in e) || e.touches.length === 1) {
            ctx.lineTo(x, y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    };

    return (
        <div className="relative">
            <canvas
                ref={canvasRef}
                width={200}
                height={100}
                className="w-full h-[100px] bg-slate-950 rounded-lg border border-slate-700 cursor-crosshair touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            <button
                onClick={() => {
                    const ctx = canvasRef.current?.getContext('2d');
                    ctx?.clearRect(0, 0, 200, 100);
                    onSave('');
                }}
                className="absolute top-2 right-2 p-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
            >
                <Eraser className="w-3 h-3" />
            </button>
        </div>
    );
};
