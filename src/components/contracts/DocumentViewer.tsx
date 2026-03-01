import React, { useState, useRef, useEffect } from 'react';
import {
    X,
    MessageSquare,
    Save,
    Trash2,
    Maximize2,
    Minimize2,
    Eraser,
    Type,
    MousePointer2,
    Download,
    PenLine,
    Loader2
} from 'lucide-react';
import { Button } from '../ui/UIComponents';
import { toast } from 'react-hot-toast';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDFJS worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    // Configure worker with a more reliable CDN fallback for the specific version
    // Using unpkg.com as it often handles versioned sub-paths better than cdnjs for pdfjs-dist
    const PDF_WORKER_URL = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
}

export interface Annotation {
    id: string;
    type: 'note' | 'redact' | 'text' | 'signature';
    pageNumber: number; // Anchor to a specific page
    x: number; // Percentage of page width
    y: number; // Percentage of page height
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
    const [activeAnnotation, setActiveAnnotation] = useState<string | null>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [renderScale, setRenderScale] = useState(1.5);

    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

    // Load PDF
    useEffect(() => {
        const loadPdf = async () => {
            setIsLoading(true);
            try {
                const loadingTask = pdfjsLib.getDocument(url);
                const pdfDoc = await loadingTask.promise;
                setPdf(pdfDoc);
                setNumPages(pdfDoc.numPages);
            } catch (error) {
                console.error('PDF Load Error:', error);
                toast.error('Failed to render PDF background');
            } finally {
                setIsLoading(false);
            }
        };
        loadPdf();
    }, [url]);

    const handlePageClick = (e: React.MouseEvent, pageNumber: number) => {
        if (tool === 'select' || !pageRefs.current[pageNumber]) return;

        const rect = pageRefs.current[pageNumber]!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const newAnnotation: Annotation = {
            id: Date.now().toString(),
            type: tool as any,
            pageNumber,
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
        <div className={`relative flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden ${isFullscreen ? 'fixed inset-0 z-[60] m-0 rounded-none' : 'h-[750px] shadow-2xl'}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl shrink-0">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    <Button size="sm" variant={tool === 'select' ? 'primary' : 'ghost'} onClick={() => setTool('select')} className="w-10 h-10 p-0 shrink-0">
                        <MousePointer2 className="w-4 h-4" />
                    </Button>
                    <div className="w-px h-6 bg-slate-700 mx-1 shrink-0" />
                    <Button size="sm" variant={tool === 'note' ? 'primary' : 'ghost'} onClick={() => setTool('note')} className="flex items-center gap-2 shrink-0">
                        <MessageSquare className="w-4 h-4" />
                        <span className="hidden lg:inline">Comment</span>
                    </Button>
                    <Button size="sm" variant={tool === 'text' ? 'primary' : 'ghost'} onClick={() => setTool('text')} className="flex items-center gap-2 shrink-0">
                        <Type className="w-4 h-4" />
                        <span className="hidden lg:inline">Type</span>
                    </Button>
                    <Button size="sm" variant={tool === 'signature' ? 'primary' : 'ghost'} onClick={() => setTool('signature')} className="flex items-center gap-2 shrink-0">
                        <PenLine className="w-4 h-4" />
                        <span className="hidden lg:inline">Signature</span>
                    </Button>
                    <Button size="sm" variant={tool === 'redact' ? 'primary' : 'ghost'} onClick={() => setTool('redact')} className="flex items-center gap-2 shrink-0">
                        <Eraser className="w-4 h-4" />
                        <span className="hidden lg:inline">Redact</span>
                    </Button>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden sm:flex items-center bg-slate-800 rounded-lg px-2 mr-2">
                        <Button size="sm" variant="ghost" onClick={() => setRenderScale(s => Math.max(0.5, s - 0.25))} className="p-1 h-8 w-8 hover:bg-slate-700">
                            <span className="text-lg">-</span>
                        </Button>
                        <span className="text-[10px] font-bold w-12 text-center text-slate-400">{Math.round(renderScale * 100)}%</span>
                        <Button size="sm" variant="ghost" onClick={() => setRenderScale(s => Math.min(3, s + 0.25))} className="p-1 h-8 w-8 hover:bg-slate-700">
                            <span className="text-lg">+</span>
                        </Button>
                    </div>
                    {onDownload && (
                        <Button size="sm" variant="outline" onClick={onDownload} className="w-10 h-10 p-0">
                            <Download className="w-4 h-4" />
                        </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setIsFullscreen(!isFullscreen)} className="w-10 h-10 p-0">
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="primary" onClick={handleSave} className="bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-500/20 px-4">
                        <Save className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Commit Edits</span>
                    </Button>
                </div>
            </div>

            {/* Viewer Area */}
            <div className="flex-1 overflow-auto bg-slate-950 p-4 sm:p-8 scroll-smooth" ref={containerRef}>
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
                        <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
                        <p className="text-sm font-medium animate-pulse">Initializing Secure PDF Canvas...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-0 pb-20 max-w-full mx-auto bg-white" id="editor-pdf-content">
                        {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNo => (
                            <div key={pageNo} className="relative group">
                                <div className="absolute -left-12 top-0 text-slate-600 font-black text-xs h-full flex flex-col items-center pt-2 gap-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span>P. {pageNo}</span>
                                    <div className="w-px flex-1 bg-slate-800" />
                                </div>
                                <PDFPage
                                    pageNumber={pageNo}
                                    pdf={pdf!}
                                    scale={renderScale}
                                    onPageClick={(e) => handlePageClick(e, pageNo)}
                                    ref={(el) => { if (el) pageRefs.current[pageNo] = el; }}
                                >
                                    {/* Render annotations anchored to this specific page */}
                                    {annotations
                                        .filter(anno => anno.pageNumber === pageNo)
                                        .map(anno => (
                                            <AnnotationItem
                                                key={anno.id}
                                                annotation={anno}
                                                isActive={activeAnnotation === anno.id}
                                                userName={userName}
                                                onActivate={() => setActiveAnnotation(anno.id)}
                                                onDelete={() => deleteAnnotation(anno.id)}
                                                onUpdate={(updates) => updateAnnotation(anno.id, updates)}
                                                onDeactivate={() => setActiveAnnotation(null)}
                                            />
                                        ))
                                    }
                                </PDFPage>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2.5 bg-slate-900/90 backdrop-blur-xl text-white text-[10px] font-bold rounded-full shadow-2xl border border-white/10 uppercase tracking-widest pointer-events-none z-50 ring-1 ring-white/5">
                {tool === 'note' && <span className="flex items-center gap-2"><MessageSquare className="w-3 h-3 text-teal-400" /> Click to drop a note</span>}
                {tool === 'redact' && <span className="flex items-center gap-2"><Eraser className="w-3 h-3 text-red-400" /> Click to redact content</span>}
                {tool === 'text' && <span className="flex items-center gap-2"><Type className="w-3 h-3 text-blue-400" /> Click to type text</span>}
                {tool === 'signature' && <span className="flex items-center gap-2"><PenLine className="w-3 h-3 text-teal-400" /> Click to drop signature</span>}
                {tool === 'select' && <span className="text-slate-400">Select tools from top to edit document</span>}
            </div>
        </div>
    );
};

// ── PDF PAGE RENDERER ─────────────────────────────────────────────────────

interface PDFPageProps {
    pdf: pdfjsLib.PDFDocumentProxy;
    pageNumber: number;
    scale: number;
    onPageClick: (e: React.MouseEvent) => void;
    children?: React.ReactNode;
}

const PDFPage = React.forwardRef<HTMLDivElement, PDFPageProps>(({
    pdf,
    pageNumber,
    scale,
    onPageClick,
    children
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [renderPending, setRenderPending] = useState(false);

    useEffect(() => {
        const renderPage = async () => {
            if (!canvasRef.current) return;
            setRenderPending(true);
            try {
                const page = await pdf.getPage(pageNumber);
                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: context!,
                    viewport: viewport,
                    canvas: canvasRef.current!
                };

                await page.render(renderContext).promise;
            } catch (error) {
                console.error('Page Render Error:', error);
            } finally {
                setRenderPending(false);
            }
        };

        renderPage();
    }, [pdf, pageNumber, scale]);

    return (
        <div
            ref={ref}
            className="relative bg-white shadow-2xl ring-1 ring-slate-800/50 cursor-crosshair overflow-hidden canvas-pdf-page"
            onClick={onPageClick}
            style={{
                width: 'fit-content',
                margin: '0 auto'
            }}
        >
            <canvas ref={canvasRef} className="block shadow-inner" />
            {renderPending && (
                <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[1px] flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-400 opacity-50" />
                </div>
            )}
            {/* The Annotations Layer */}
            <div className="absolute inset-0 pointer-events-none annotation-layer">
                {children}
            </div>
        </div>
    );
});

// ── ANNOTATION ITEM ──────────────────────────────────────────────────────

interface AnnotationItemProps {
    annotation: Annotation;
    isActive: boolean;
    userName: string;
    onActivate: () => void;
    onDelete: () => void;
    onUpdate: (updates: Partial<Annotation>) => void;
    onDeactivate: () => void;
}

const AnnotationItem: React.FC<AnnotationItemProps> = ({
    annotation,
    isActive,
    userName,
    onActivate,
    onDelete,
    onUpdate,
    onDeactivate
}) => {
    return (
        <div
            className="absolute pointer-events-auto"
            style={{
                left: `${annotation.x}%`,
                top: `${annotation.y}%`,
                transform: annotation.type === 'redact' ? 'none' : 'translate(-50%, -50%)',
                zIndex: isActive ? 50 : 10
            }}
        >
            {annotation.type === 'note' && (
                <div className="relative group/note">
                    <button
                        onClick={(e) => { e.stopPropagation(); onActivate(); }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center shadow-2xl transition-all border-2 border-white/20 ${isActive ? 'bg-teal-500 scale-125 ring-4 ring-teal-500/30' : 'bg-teal-600 hover:scale-110'}`}
                    >
                        <MessageSquare className="w-3.5 h-3.5 text-white" />
                    </button>
                    {isActive && (
                        <div className="absolute top-0 left-full ml-4 w-72 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 z-[100] animate-in fade-in zoom-in duration-200 origin-left ring-1 ring-white/5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest bg-teal-400/10 px-2 py-0.5 rounded-md">Note - {annotation.author}</span>
                                <button onClick={onDelete} className="text-slate-500 hover:text-red-400 transition-colors p-1 hover:bg-red-500/10 rounded-lg">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <textarea
                                autoFocus
                                className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-3 text-sm text-slate-200 outline-none focus:border-teal-500/50 min-h-[100px] shadow-inner transition-all placeholder:text-slate-700"
                                value={annotation.text}
                                onChange={(e) => onUpdate({ text: e.target.value })}
                                placeholder="Write your comment..."
                            />
                            <div className="mt-3 flex justify-end">
                                <button
                                    onClick={onDeactivate}
                                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold rounded-lg transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {annotation.type === 'text' && (
                <div className="relative">
                    {isActive ? (
                        <input
                            autoFocus
                            className="bg-white/95 backdrop-blur-sm text-slate-900 font-serif border-2 border-teal-500 rounded-lg shadow-2xl outline-none p-2 leading-none min-w-[120px] pointer-events-auto ring-4 ring-teal-500/20"
                            value={annotation.text}
                            onChange={(e) => onUpdate({ text: e.target.value })}
                            onBlur={onDeactivate}
                        />
                    ) : (
                        <span
                            className="text-slate-950 font-serif cursor-text bg-white/20 hover:bg-white/60 px-2 py-1 rounded-lg transition-all border border-transparent hover:border-teal-500/30 font-semibold"
                            onClick={(e) => { e.stopPropagation(); onActivate(); }}
                        >
                            {annotation.text || 'Type here...'}
                        </span>
                    )}
                </div>
            )}

            {annotation.type === 'redact' && (
                <div
                    className={`bg-slate-950 border border-white/20 relative group shadow-2xl rounded-sm ${isActive ? 'ring-2 ring-red-500 border-red-500/50' : ''}`}
                    style={{
                        width: annotation.width ? `${annotation.width * 5}px` : '100px',
                        height: annotation.height ? `${annotation.height * 4}px` : '20px'
                    }}
                    onClick={(e) => { e.stopPropagation(); onActivate(); }}
                >
                    {isActive && (
                        <button
                            onClick={onDelete}
                            className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-1.5 shadow-2xl border border-white/20 hover:bg-red-500 active:scale-90 transition-all"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}

            {annotation.type === 'signature' && (
                <div className="relative group/sig">
                    {annotation.signatureType === 'draw' && annotation.signatureData ? (
                        <div
                            className={`cursor-pointer transition-all duration-300 ${isActive ? 'scale-110' : 'hover:scale-110 active:scale-95'}`}
                            onClick={(e) => { e.stopPropagation(); onActivate(); }}
                        >
                            <img src={annotation.signatureData} alt="Signature" className="max-h-24 filter drop-shadow-xl" />
                        </div>
                    ) : (
                        <span
                            className={`text-teal-600 text-4xl cursor-pointer transition-all duration-300 block whitespace-nowrap font-signature drop-shadow-lg ${isActive ? 'scale-110' : 'hover:scale-110 active:scale-95'}`}
                            style={{ fontFamily: "'Dancing Script', 'Sacramento', cursive" }}
                            onClick={(e) => { e.stopPropagation(); onActivate(); }}
                        >
                            {annotation.text || userName}
                        </span>
                    )}

                    {isActive && (
                        <div className="absolute top-0 left-full ml-6 w-80 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-5 z-[100] animate-in fade-in zoom-in duration-200 pointer-events-auto origin-left ring-1 ring-white/5">
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex bg-slate-950/80 p-1 rounded-xl border border-white/5 ring-1 ring-white/5">
                                    <button
                                        onClick={() => onUpdate({ signatureType: 'type' })}
                                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${annotation.signatureType === 'type' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        Type
                                    </button>
                                    <button
                                        onClick={() => onUpdate({ signatureType: 'draw' })}
                                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${annotation.signatureType === 'draw' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-500 hover:text-white'}`}
                                    >
                                        Draw
                                    </button>
                                </div>
                                <button onClick={onDelete} className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-xl transition-colors ring-1 ring-transparent hover:ring-red-500/20">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {annotation.signatureType === 'type' ? (
                                <input
                                    autoFocus
                                    placeholder="Enter your full legal name"
                                    className="w-full bg-slate-950/50 border border-white/5 rounded-xl p-4 text-lg text-white outline-none focus:border-teal-500/50 shadow-inner font-signature placeholder:text-slate-700"
                                    style={{ fontFamily: "'Dancing Script', cursive" }}
                                    value={annotation.text}
                                    onChange={(e) => onUpdate({ text: e.target.value })}
                                />
                            ) : (
                                <SignatureCanvas
                                    onSave={(data) => onUpdate({ signatureData: data })}
                                    initialData={annotation.signatureData}
                                />
                            )}
                            <div className="mt-4 flex justify-between items-center">
                                <span className="text-[10px] text-slate-500 font-medium">ESIGN Secure Signature</span>
                                <Button size="sm" variant="primary" onClick={onDeactivate} className="text-[10px] h-9 px-6 bg-teal-600 hover:bg-teal-500">Done</Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
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
    }, [initialData]);

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

        ctx.lineWidth = 2.5;
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
        <div className="relative group/canvas">
            <canvas
                ref={canvasRef}
                width={280}
                height={140}
                className="w-full h-[140px] bg-slate-950/80 rounded-xl border border-white/5 cursor-crosshair touch-none shadow-inner"
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
                    ctx?.clearRect(0, 0, 280, 140);
                    onSave('');
                }}
                className="absolute top-3 right-3 p-2 bg-slate-900 border border-white/5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all shadow-xl opacity-0 group-hover/canvas:opacity-100"
                title="Clear Signature"
            >
                <Eraser className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};
