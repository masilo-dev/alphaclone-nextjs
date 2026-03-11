import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Upload, Search, Trash2, FolderOpen, FileText, File as FileIcon, X,
    Download, Eye, Loader2, Plus, RotateCcw, Edit3, Save,
    ChevronLeft, AlertTriangle, FileCheck, AlertCircle, CheckCircle2,
    Filter,
    Printer,
    Share2,
    Presentation,
    ScanLine,
    Image as ImageIcon,
    Type
} from 'lucide-react';
import { googleDriveService } from '../../services/googleDriveService';
import { useAuth } from '../../contexts/AuthContext';
import mammoth from 'mammoth';
import { fileUploadService } from '../../services/fileUploadService';
import { DocumentViewer } from '../contracts/DocumentViewer';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { notificationService } from '../../services/dashboardService';
import dynamic from 'next/dynamic';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
import 'react-quill-new/dist/quill.snow.css';

const quillModules = {
    toolbar: [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        [{ 'color': [] }, { 'background': [] }],
        ['link', 'image'],
        ['clean']
    ],
};

interface DocumentHubProps {
    user: User;
}

type ViewMode = 'list' | 'viewer' | 'editor' | 'image' | 'presentation';

interface Slide {
    id: string;
    title: string;
    content: string;
    image?: string;
}

interface HubFile {
    id: string;
    original_filename: string;
    file_type: string;
    file_size: number;
    storage_path: string;
    created_at: string;
    deleted_at: string | null;
    entity_type?: string;
    annotations?: any[];
}

const BYTES_TO_MB = 1024 * 1024;

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < BYTES_TO_MB) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / BYTES_TO_MB).toFixed(2)} MB`;
}

function getFileIcon(fileType: string) {
    if (fileType === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />;
    if (fileType.includes('word') || fileType.includes('msword')) return <FileText className="w-5 h-5 text-blue-400" />;
    if (fileType.includes('image')) return <FileIcon className="w-5 h-5 text-green-400" />;
    return <FileIcon className="w-5 h-5 text-slate-400" />;
}

function getFileLabel(fileType: string): string {
    if (fileType === 'application/pdf') return 'PDF';
    if (fileType.includes('wordprocessingml') || fileType.includes('msword')) return 'Word';
    if (fileType.includes('spreadsheetml') || fileType.includes('ms-excel')) return 'Excel';
    if (fileType.includes('image')) return 'Image';
    return 'File';
}

const DocumentHub: React.FC<DocumentHubProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const [files, setFiles] = useState<HubFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [documentFilter, setDocumentFilter] = useState<string>('all');
    const [viewTrash, setViewTrash] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [selectedFile, setSelectedFile] = useState<HubFile | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [storageUsed, setStorageUsed] = useState(0);
    const { user: authUser } = useAuth();
    const [isSavingToDrive, setIsSavingToDrive] = useState<string | null>(null);
    const [slides, setSlides] = useState<Slide[]>([{ id: '1', title: 'New Presentation', content: 'Subtitle or description' }]);
    const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scanInputRef = useRef<HTMLInputElement>(null);

    const loadFiles = useCallback(async () => {
        if (!currentTenant?.id) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const result = viewTrash
                ? await fileUploadService.getDeletedFilesByTenant(currentTenant.id)
                : await fileUploadService.getFilesByTenant(currentTenant.id);
            setFiles((result.files as HubFile[]) || []);
        } catch {
            toast.error('Failed to load documents');
        } finally {
            setIsLoading(false);
        }
    }, [currentTenant?.id, viewTrash]);

    const loadStorageUsage = useCallback(async () => {
        const used = await fileUploadService.getUserStorageUsage(user.id);
        setStorageUsed(used);
    }, [user.id]);

    useEffect(() => {
        loadFiles();
        loadStorageUsage();
    }, [loadFiles, loadStorageUsage]);

    const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        const toastId = toast.loading('Scanning document with AI Vision...');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'document_scan'); // Tell API to just extract text

            const response = await fetch('/api/ai/vision', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Scan failed');

            const data = await response.json();
            
            // Create a new document with the scanned text
            const scannedContent = `
                <h1>Scanned Document</h1>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <hr/>
                <p>${data.description || data.text || 'No text extracted'}</p>
                ${data.amount ? `<p><strong>Detected Amount:</strong> ${data.amount}</p>` : ''}
            `;
            
            setEditorContent(scannedContent);
            setSelectedFile({
                id: 'new-scan',
                original_filename: `Scan-${format(new Date(), 'yyyy-MM-dd-HHmm')}.docx`,
                file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                file_size: 0,
                storage_path: '',
                created_at: new Date().toISOString(),
                deleted_at: null
            });
            setViewMode('editor');
            toast.success('Document scanned successfully', { id: toastId });
        } catch (error) {
            console.error('Scan error:', error);
            toast.error('Failed to scan document', { id: toastId });
        } finally {
            setIsLoading(false);
            if (scanInputRef.current) scanInputRef.current.value = '';
        }
    };

    const handleCreateDocument = () => {
        setEditorContent('<h1>New Document</h1><p>Start typing...</p>');
        setSelectedFile({
            id: 'new-doc',
            original_filename: `Document-${format(new Date(), 'yyyy-MM-dd-HHmm')}.docx`,
            file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            file_size: 0,
            storage_path: '',
            created_at: new Date().toISOString(),
            deleted_at: null
        });
        setViewMode('editor');
    };

    const handleCreatePresentation = () => {
        setSlides([{ id: '1', title: 'Presentation Title', content: 'Subtitle or description' }]);
        setCurrentSlideIndex(0);
        setSelectedFile({
            id: 'new-ppt',
            original_filename: `Presentation-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`,
            file_type: 'application/pdf', // We export as PDF
            file_size: 0,
            storage_path: '',
            created_at: new Date().toISOString(),
            deleted_at: null
        });
        setViewMode('presentation');
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const result = await fileUploadService.uploadFile(file, 'hub', undefined, user.id, currentTenant?.id);
            if (result.success) {
                toast.success(`"${file.name}" uploaded successfully`);

                // Create Notification
                await notificationService.createNotification({
                    user_id: user.id,
                    tenant_id: currentTenant?.id || '',
                    type: 'system',
                    title: 'Document Uploaded',
                    message: `File "${file.name}" has been uploaded to the Document Hub.`,
                    read: false,
                    link: '/dashboard/documents'
                });

                loadFiles();
                loadStorageUsage();
            } else {
                toast.error(result.error || 'Upload failed');
            }
        } catch {
            toast.error('An error occurred during upload');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handlePrint = (fileUrl: string) => {
        const printWindow = window.open(fileUrl, '_blank');
        if (printWindow) {
            printWindow.addEventListener('load', () => {
                printWindow.print();
            });
        }
    };

    const handleSaveToDrive = async (file: HubFile) => {
        if (!authUser) {
            toast.error('You must be logged in to save to Google Drive');
            return;
        }

        setIsSavingToDrive(file.id);
        const toastId = toast.loading('Saving to Google Drive...');
        try {
            // Use proxied URL to hide Supabase origin
            const downloadUrl = fileUploadService.getProxiedUrl('uploads', file.storage_path);

            if (!downloadUrl) {
                throw new Error('Could not generate download URL');
            }

            const fetchResponse = await fetch(downloadUrl);
            const blob = await fetchResponse.blob();
            await googleDriveService.uploadFile(authUser.id, blob, file.original_filename);
            toast.success('Successfully saved to Google Drive!', { id: toastId });
        } catch (error: any) {
            console.error('Drive upload error:', error);
            toast.error(error.message || 'Failed to save to Google Drive', { id: toastId });
        } finally {
            setIsSavingToDrive(null);
        }
    };

    const handleOpenFile = async (file: HubFile) => {
        setSelectedFile(file);

        try {
            // Use proxied URL instead of direct Supabase download
            const proxiedUrl = fileUploadService.getProxiedUrl('uploads', file.storage_path);
            const response = await fetch(proxiedUrl);

            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.statusText}`);
            }

            const data = await response.blob();

            const isPdf = file.file_type === 'application/pdf';
            const isWord = file.file_type.includes('word') || file.file_type.includes('officedocument');
            const isImage = file.file_type.includes('image');

            if (isPdf) {
                const url = window.URL.createObjectURL(data);
                setFileUrl(url);
                setViewMode('viewer');
            } else if (isImage) {
                const url = window.URL.createObjectURL(data);
                setFileUrl(url);
                setViewMode('image');
            } else if (isWord) {
                // Use mammoth to convert docx to HTML
                const arrayBuffer = await data.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                setEditorContent(result.value);
                setViewMode('editor');
                toast('Word document opened in editor mode.', { icon: '📄' });
            } else {
                const text = await data.text();
                setEditorContent(text);
                setViewMode('editor');
            }
        } catch (error) {
            console.error('Error opening file:', error);
            toast.error('Failed to open document');
        }
    };

    const handleSoftDelete = async (fileId: string) => {
        const result = await fileUploadService.deleteFile(fileId);
        if (result.success) {
            toast.success('Moved to trash');
            loadFiles();
        } else {
            toast.error(result.error || 'Failed to delete');
        }
    };

    const handleRestore = async (fileId: string) => {
        const result = await fileUploadService.restoreFile(fileId);
        if (result.success) {
            toast.success('File restored');
            loadFiles();
        } else {
            toast.error(result.error || 'Failed to restore');
        }
    };

    const handlePermanentDelete = async (fileId: string) => {
        if (!window.confirm('Permanently delete this file? This cannot be undone.')) return;
        const result = await fileUploadService.permanentDeleteFile(fileId);
        if (result.success) {
            toast.success('File permanently deleted');
            loadFiles();
            loadStorageUsage();
        } else {
            toast.error(result.error || 'Failed to delete');
        }
    };

    const handleEmptyTrash = async () => {
        if (!currentTenant?.id) return;
        if (!window.confirm('Empty entire trash? This cannot be undone.')) return;
        await fileUploadService.emptyTrash(currentTenant.id);
        toast.success('Trash emptied');
        loadFiles();
        loadStorageUsage();
    };

    const handleSaveAnnotations = async (annotations: any[]) => {
        if (!selectedFile) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from('file_uploads')
                .update({ annotations })
                .eq('id', selectedFile.id);

            if (error) throw error;
            toast.success('Annotations saved');
            loadFiles();
        } catch (error) {
            console.error('Error saving annotations:', error);
            toast.error('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = async (file: HubFile) => {
        const hasAnnotations = file.annotations && file.annotations.length > 0;

        if (hasAnnotations && file.file_type === 'application/pdf') {
            const confirmFlatten = window.confirm('This document has signatures or notes. Would you like to download it with these saved annotations?');
            if (confirmFlatten) {
                return handleDownloadAsPDF(true);
            }
        }

        try {
            // Use proxied URL instead of direct Supabase download
            const proxiedUrl = fileUploadService.getProxiedUrl('uploads', file.storage_path);
            const response = await fetch(proxiedUrl);

            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.statusText}`);
            }

            const data = await response.blob();

            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.original_filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading file:', error);
            toast.error('Failed to download file');
        }
    };

    const handleSaveEdits = async () => {
        if (!selectedFile) return;
        setIsSaving(true);
        try {
            const isWord = selectedFile.original_filename.match(/\.(doc|docx)$/i);

            let blob: Blob;
            let finalFilename = selectedFile.original_filename;

            if (isWord) {
                // Dynamically import to avoid SSR issues
                const htmlDocx = (await import('html-docx-js-typescript')).default;
                const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${editorContent}</body></html>`;

                const docData = htmlDocx.asBlob(htmlContent) as unknown as Blob;
                blob = docData;
                finalFilename = finalFilename.replace(/\.doc$/i, '.docx');
            } else {
                blob = new Blob([editorContent], { type: 'text/plain' });
                finalFilename = finalFilename.replace(/\.(doc|docx)$/i, '.txt');
            }

            const file = new File([blob], finalFilename, { type: blob.type });
            const result = await fileUploadService.uploadFile(file, 'hub');

            if (result.success) {
                toast.success('Saved as new version');
                loadFiles();
            } else {
                toast.error(result.error || 'Save failed');
            }
        } catch (error) {
            console.error('Save edits error:', error);
            toast.error('Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadAsPDF = async (flattenViewer = false) => {
        if (!selectedFile) return;
        setIsSaving(true);
        const toastId = toast.loading('Generating PDF...');
        try {
            // Dynamically import html2pdf to avoid SSR issues
            const html2pdf = (await import('html2pdf.js')).default;

            let element: HTMLElement | null = null;

            // Search for our dedicated content container
            element = document.getElementById('editor-pdf-content');

            if (!element) {
                // Fallback to the viewer wrapper if specific ID not found
                element = document.querySelector('.document-viewer-container') as HTMLElement;
            }

            if (!element) {
                toast.error('Could not find content to print', { id: toastId });
                return;
            }

            const opt: any = {
                margin: 0,
                filename: selectedFile.original_filename.replace(/\.(doc|docx|txt)$/i, '.pdf'),
                image: { type: 'jpeg', quality: 1 },
                html2canvas: {
                    scale: 3, // Higher scale for better quality
                    useCORS: true,
                    logging: false,
                    letterRendering: true,
                    backgroundColor: '#ffffff' // Ensure white background
                },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            await html2pdf().from(element).set(opt).save();
            toast.success('Downloaded as PDF', { id: toastId });
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF', { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    const filteredFiles = files.filter(f => {
        const matchesSearch = f.original_filename.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = documentFilter === 'all'
            ? true
            : documentFilter === 'pdf'
                ? f.file_type === 'application/pdf'
                : documentFilter === 'word'
                    ? f.file_type.includes('word') || f.file_type.includes('officedocument')
                    : documentFilter === 'image'
                        ? f.file_type.includes('image')
                        : true;
        return matchesSearch && matchesFilter;
    });

    const storagePercent = Math.min((storageUsed / (100 * BYTES_TO_MB)) * 100, 100);

    // ── VIEWER / EDITOR MODE ──────────────────────────────────────────────────
    if (viewMode !== 'list' && selectedFile) {
        const isPdf = selectedFile.file_type === 'application/pdf';
        return (
            <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 animate-in fade-in duration-200">
                {/* Toolbar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-slate-900 shrink-0 shadow-2xl gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <button
                            onClick={() => { setViewMode('list'); setSelectedFile(null); setFileUrl(null); }}
                            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all text-xs sm:text-sm font-bold shrink-0"
                        >
                            <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Close Viewer</span><span className="sm:hidden">Back</span>
                        </button>
                        <div className="w-px h-6 bg-white/10 hidden sm:block" />
                        <div className="min-w-0">
                            <span className="text-white font-bold text-xs sm:text-sm block truncate max-w-[150px] sm:max-w-xs">{selectedFile.original_filename}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {viewMode === 'editor' && (
                            <>
                                <button
                                    onClick={() => handleDownloadAsPDF(false)}
                                    disabled={isSaving}
                                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[10px] sm:text-xs font-bold transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Save as PDF
                                </button>
                                <button
                                    onClick={handleSaveEdits}
                                    disabled={isSaving}
                                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[10px] sm:text-xs font-bold transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Save Changes
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => handleDownload(selectedFile)}
                            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[10px] sm:text-xs font-bold transition-all border border-white/5"
                        >
                            <Download className="w-4 h-4" /> Download
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden bg-slate-950">
                    {isPdf && fileUrl ? (
                        <div className="h-full document-viewer-container">
                            <DocumentViewer
                                url={fileUrl}
                                userName={user.name || 'User'}
                                initialAnnotations={selectedFile.annotations || []}
                                onSaveAnnotations={handleSaveAnnotations}
                                onDownload={() => handleDownload(selectedFile)}
                            />
                        </div>
                    ) : viewMode === 'image' && fileUrl ? (
                        <div className="h-full flex items-center justify-center p-6 sm:p-12 hover:bg-slate-900/50 transition-colors">
                            <img
                                src={fileUrl}
                                alt={selectedFile.original_filename}
                                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
                            />
                        </div>
                    ) : viewMode === 'editor' ? (
                        <div className="h-full overflow-auto flex flex-col items-center bg-slate-900/50 py-12 px-6">
                            <div className="w-full max-w-4xl bg-white text-slate-900 shadow-2xl rounded-sm min-h-screen mb-12 animate-in slide-in-from-bottom-4 duration-500">
                                {/* Editor wrapper gets custom quill styling */}
                                <div className="h-full min-h-[800px] flex flex-col [&_.ql-toolbar]:rounded-t-sm [&_.ql-container]:rounded-b-sm [&_.ql-container]:flex-1 [&_.ql-editor]:min-h-[800px] [&_.ql-editor]:text-base [&_.ql-editor]:bg-white [&_.ql-editor]:text-black [&_.ql-editor]:!text-[#000000] [&_.ql-editor]:shadow-inner [&_.ql-toolbar]:border-slate-300 [&_.ql-container]:border-slate-300 [&_.ql-toolbar]:bg-slate-50">
                                    <ReactQuill
                                        theme="snow"
                                        value={editorContent}
                                        onChange={setEditorContent}
                                        modules={quillModules}
                                    />
                                </div>
                                {/* Hidden element required for rendering clean HTML to PDF without editor toolbars */}
                                <div className="hidden">
                                    {/* Removed 'prose prose-slate' because Tailwind uses oklch/lab which html2canvas cannot parse. Using exact hex codes and standard CSS mimics to prevent the color crash. */}
                                    <div
                                        id="editor-pdf-content"
                                        className="p-10 max-w-none min-h-[1056px] [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-6 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4 [&_strong]:font-bold [&_em]:italic"
                                        style={{ color: '#000000', backgroundColor: '#ffffff' }}
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editorContent) }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : viewMode === 'presentation' ? (
                        <div className="h-full flex overflow-hidden bg-slate-900">
                            {/* Slides Sidebar */}
                            <div className="w-48 bg-slate-950 border-r border-white/10 flex flex-col">
                                <div className="p-4 overflow-y-auto flex-1 space-y-3">
                                    {slides.map((slide, idx) => (
                                        <button
                                            key={slide.id}
                                            onClick={() => setCurrentSlideIndex(idx)}
                                            className={`w-full aspect-video rounded border-2 transition-all p-2 text-[8px] overflow-hidden text-left relative group ${currentSlideIndex === idx ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 hover:border-slate-600'}`}
                                        >
                                            <div className="font-bold text-white truncate">{slide.title || 'Untitled'}</div>
                                            <div className="text-slate-500 truncate">{slide.content}</div>
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="bg-slate-900 text-slate-400 text-[8px] px-1 rounded">{idx + 1}</span>
                                            </div>
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => {
                                            const newSlide = { id: Date.now().toString(), title: 'New Slide', content: 'Click to edit' };
                                            setSlides([...slides, newSlide]);
                                            setCurrentSlideIndex(slides.length);
                                        }}
                                        className="w-full py-3 border-2 border-dashed border-slate-800 rounded hover:border-slate-600 hover:bg-slate-900 transition-all text-slate-500 hover:text-white text-xs font-bold flex items-center justify-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Slide
                                    </button>
                                </div>
                            </div>

                            {/* Main Slide Editor */}
                            <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-900">
                                <div className="flex-1 p-8 sm:p-12 flex items-center justify-center overflow-auto">
                                    <div
                                        id="presentation-content"
                                        className="aspect-video w-full max-w-4xl bg-white shadow-2xl rounded-sm p-12 flex flex-col relative"
                                    >
                                        <input
                                            value={slides[currentSlideIndex]?.title || ''}
                                            onChange={(e) => {
                                                const newSlides = [...slides];
                                                newSlides[currentSlideIndex].title = e.target.value;
                                                setSlides(newSlides);
                                            }}
                                            placeholder="Click to add title"
                                            className="text-4xl sm:text-5xl font-bold text-slate-900 border-none focus:ring-0 placeholder:text-slate-300 bg-transparent mb-6"
                                        />
                                        <textarea
                                            value={slides[currentSlideIndex]?.content || ''}
                                            onChange={(e) => {
                                                const newSlides = [...slides];
                                                newSlides[currentSlideIndex].content = e.target.value;
                                                setSlides(newSlides);
                                            }}
                                            placeholder="Click to add text"
                                            className="flex-1 text-xl sm:text-2xl text-slate-600 border-none focus:ring-0 placeholder:text-slate-200 bg-transparent resize-none leading-relaxed"
                                        />
                                        
                                        {/* Logo / Branding Placeholder */}
                                        <div className="absolute bottom-8 right-8 opacity-50">
                                            {currentTenant?.logo_url ? (
                                                <img src={currentTenant.logo_url} className="h-8 object-contain" alt="Logo" />
                                            ) : (
                                                <span className="text-slate-300 font-bold uppercase tracking-widest text-sm">
                                                    {currentTenant?.name || 'COMPANY'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : fileUrl ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="bg-slate-900 border border-white/5 p-12 rounded-3xl text-center max-w-sm">
                                <FileIcon className="w-16 h-16 text-slate-700 mx-auto mb-6" />
                                <h3 className="text-white font-bold text-lg mb-2">No Preview Available</h3>
                                <p className="text-slate-400 text-sm mb-8">This file type cannot be viewed inside the platform yet.</p>
                                <button
                                    onClick={() => handleDownload(selectedFile)}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-all mb-2"
                                >
                                    <Download className="w-4 h-4" /> Download File
                                </button>
                                <button
                                    onClick={() => handlePrint(fileUrl || '')}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-all mb-2"
                                >
                                    <Printer className="w-4 h-4" /> Print
                                </button>
                                <button
                                    onClick={() => selectedFile && handleSaveToDrive(selectedFile)}
                                    disabled={selectedFile ? isSavingToDrive === selectedFile.id : false}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold transition-all shadow-lg shadow-teal-500/20"
                                >
                                    {selectedFile && isSavingToDrive === selectedFile.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                                    Save to Drive
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div >
        );
    }

    // ── LIST MODE ─────────────────────────────────────────────────────────────
    return (
        <div className="space-y-4 p-4 sm:p-6" style={{ touchAction: 'pan-y' }}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-teal-400" />
                        Document Hub
                    </h2>
                    <p className="text-slate-400 text-xs sm:text-sm mt-0.5">Upload, view, and edit your PDF and Word documents</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => { setViewTrash(!viewTrash); }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewTrash ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-slate-900 text-slate-500 hover:text-white border border-white/5'}`}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {viewTrash ? 'Exit Trash' : 'Trash'}
                    </button>

                    {viewTrash ? (
                        <button
                            onClick={handleEmptyTrash}
                            className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white transition-all flex items-center gap-2"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Empty Trash
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <label className="cursor-pointer">
                                <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors border border-white/5">
                                    {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                    <span className="hidden sm:inline">Upload</span>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    onChange={handleUpload}
                                    disabled={isUploading}
                                />
                            </label>

                            <button
                                onClick={handleCreateDocument}
                                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-bold transition-colors border border-blue-500/30"
                            >
                                <Type className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Write Doc</span>
                            </button>

                            <button
                                onClick={handleCreatePresentation}
                                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 text-xs font-bold transition-colors border border-orange-500/30"
                            >
                                <Presentation className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Slides</span>
                            </button>

                            <label className="cursor-pointer">
                                <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors shadow-lg shadow-teal-500/20">
                                    <ScanLine className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Scan</span>
                                </div>
                                <input
                                    ref={scanInputRef}
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleScan}
                                    disabled={isLoading}
                                />
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* Storage bar */}
            {!viewTrash && (
                <div className="bg-slate-900 border border-white/5 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-slate-400 font-medium">Storage Used</span>
                        <span className="text-xs text-slate-300 font-bold">{formatBytes(storageUsed)} / 100 MB</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${storagePercent > 80 ? 'bg-red-500' : storagePercent > 60 ? 'bg-amber-500' : 'bg-teal-500'}`}
                            style={{ width: `${storagePercent}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder={viewTrash ? 'Search trash...' : 'Search documents...'}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-teal-500/30 outline-none transition-all"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                {!viewTrash && (
                    <div className="relative shrink-0">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <select
                            value={documentFilter}
                            onChange={(e) => setDocumentFilter(e.target.value)}
                            className="w-full sm:w-40 bg-slate-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-8 text-sm text-white focus:ring-2 focus:ring-teal-500/30 outline-none transition-all appearance-none cursor-pointer"
                        >
                            <option value="all">All Files</option>
                            <option value="pdf">PDFs</option>
                            <option value="word">Word Docs</option>
                            <option value="image">Images</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                            <ChevronLeft className="w-4 h-4 -rotate-90" />
                        </div>
                    </div>
                )}
            </div>

            {/* File list */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                </div>
            ) : filteredFiles.length === 0 ? (
                <div className="text-center py-20">
                    <FolderOpen className="w-14 h-14 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">
                        {viewTrash ? 'Trash is empty' : searchQuery ? 'No documents match your search' : 'No documents yet'}
                    </p>
                    {!viewTrash && !searchQuery && (
                        <p className="text-slate-600 text-sm mt-1">Upload a PDF or Word document to get started</p>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filteredFiles.map(file => (
                        <div
                            key={file.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 border border-white/5 rounded-xl hover:border-teal-500/20 transition-all group"
                        >
                            {/* File info */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="p-2.5 bg-slate-800 rounded-lg shrink-0">
                                    {getFileIcon(file.file_type)}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white font-medium text-sm truncate">{file.original_filename}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-slate-800 text-slate-500">
                                            {getFileLabel(file.file_type)}
                                        </span>
                                        <span className="text-xs text-slate-500">{formatBytes(file.file_size)}</span>
                                        <span className="text-xs text-slate-600">
                                            {format(new Date(file.created_at), 'MMM d, yyyy')}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-slate-800/50 sm:border-t-0 shrink-0 opacity-100 transition-opacity">
                                {viewTrash ? (
                                    <>
                                        <button
                                            onClick={() => handleRestore(file.id)}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-teal-500/20 text-slate-400 hover:text-teal-400 transition-colors text-sm sm:text-xs font-bold border border-transparent"
                                        >
                                            <RotateCcw className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> Restore
                                        </button>
                                        <button
                                            onClick={() => handlePermanentDelete(file.id)}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors text-sm sm:text-xs font-bold border border-transparent"
                                        >
                                            <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> Delete
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        {file.file_type !== 'application/pdf' && (
                                            <button
                                                onClick={() => handleOpenFile(file)}
                                                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 transition-colors text-sm sm:text-xs font-bold border border-teal-500/20"
                                            >
                                                {file.file_type.includes('image') ? (
                                                    <><Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> View Image</>
                                                ) : (
                                                    <><Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> Open Editor</>
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDownload(file)}
                                            className="p-2 sm:p-2 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-transparent flex justify-center items-center"
                                            title="Download"
                                        >
                                            <Download className="w-5 h-5 sm:w-4 sm:h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const proxiedUrl = fileUploadService.getProxiedUrl('uploads', file.storage_path);
                                                handlePrint(proxiedUrl);
                                            }}
                                            className="p-2 sm:p-2 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-transparent flex justify-center items-center"
                                            title="Print"
                                        >
                                            <Printer className="w-5 h-5 sm:w-4 sm:h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleSaveToDrive(file)}
                                            disabled={isSavingToDrive === file.id}
                                            className="p-2 sm:p-2 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-transparent flex justify-center items-center"
                                            title="Save to Google Drive"
                                        >
                                            {isSavingToDrive === file.id ? <Loader2 className="w-5 h-5 sm:w-4 sm:h-4 animate-spin" /> : <Share2 className="w-5 h-5 sm:w-4 sm:h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleSoftDelete(file.id)}
                                            className="p-2 sm:p-2 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors border border-transparent flex justify-center items-center"
                                            title="Move to trash"
                                        >
                                            <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DocumentHub;
