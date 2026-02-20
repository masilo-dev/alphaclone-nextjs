import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Upload, Search, Trash2, FolderOpen, FileText, File as FileIcon, X,
    Download, Eye, Loader2, Plus, RotateCcw, Edit3, Save,
    ChevronLeft, AlertTriangle, FileCheck, AlertCircle, CheckCircle2
} from 'lucide-react';
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

type ViewMode = 'list' | 'viewer' | 'editor';

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
    const [viewTrash, setViewTrash] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [selectedFile, setSelectedFile] = useState<HubFile | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [storageUsed, setStorageUsed] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleOpenFile = async (file: HubFile) => {
        setSelectedFile(file);

        try {
            const { data, error } = await supabase.storage.from('uploads').download(file.storage_path);
            if (error) throw error;

            const isPdf = file.file_type === 'application/pdf';
            const isWord = file.file_type.includes('word') || file.file_type.includes('officedocument');

            if (isPdf) {
                const url = window.URL.createObjectURL(data);
                setFileUrl(url);
                setViewMode('viewer');
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
        try {
            const { data, error } = await supabase.storage.from('uploads').download(file.storage_path);
            if (error) throw error;

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
        // Save editorContent as a text blob back to storage
        try {
            const blob = new Blob([editorContent], { type: 'text/plain' });
            const file = new File([blob], selectedFile.original_filename.replace(/\.(doc|docx)$/, '.txt'), { type: 'text/plain' });
            const result = await fileUploadService.uploadFile(file, 'hub');
            if (result.success) {
                toast.success('Saved as new version');
                loadFiles();
            } else {
                toast.error(result.error || 'Save failed');
            }
        } catch {
            toast.error('Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadAsPDF = async () => {
        if (!selectedFile) return;
        setIsSaving(true);
        const toastId = toast.loading('Generating PDF...');
        try {
            // Dynamically import html2pdf to avoid SSR issues
            const html2pdf = (await import('html2pdf.js')).default;
            const element = document.getElementById('editor-pdf-content');
            if (!element) {
                toast.error('Could not find content to print', { id: toastId });
                return;
            }

            const opt: any = {
                margin: 0.5,
                filename: selectedFile.original_filename.replace(/\.(doc|docx|txt)$/i, '.pdf'),
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            await html2pdf().set(opt).from(element).save();
            toast.success('Downloaded as PDF', { id: toastId });
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.error('Failed to generate PDF', { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    const filteredFiles = files.filter(f =>
        f.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const storagePercent = Math.min((storageUsed / (100 * BYTES_TO_MB)) * 100, 100);

    // ── VIEWER / EDITOR MODE ──────────────────────────────────────────────────
    if (viewMode !== 'list' && selectedFile) {
        const isPdf = selectedFile.file_type === 'application/pdf';
        return (
            <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 animate-in fade-in duration-200">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-900 shrink-0 shadow-2xl">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => { setViewMode('list'); setSelectedFile(null); setFileUrl(null); }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all text-sm font-bold"
                        >
                            <ChevronLeft className="w-4 h-4" /> Close Viewer
                        </button>
                        <div className="w-px h-6 bg-white/10" />
                        <div>
                            <span className="text-white font-bold text-sm block truncate max-w-xs">{selectedFile.original_filename}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {viewMode === 'editor' && (
                            <>
                                <button
                                    onClick={handleDownloadAsPDF}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Save as PDF
                                </button>
                                <button
                                    onClick={handleSaveEdits}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Save Changes
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => handleDownload(selectedFile)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all border border-white/5"
                        >
                            <Download className="w-4 h-4" /> Download
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden bg-slate-950">
                    {isPdf && fileUrl ? (
                        <div className="h-full">
                            <DocumentViewer
                                url={fileUrl}
                                userName={user.name || 'User'}
                                initialAnnotations={selectedFile.annotations || []}
                                onSaveAnnotations={handleSaveAnnotations}
                                onDownload={() => handleDownload(selectedFile)}
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
                    ) : fileUrl ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="bg-slate-900 border border-white/5 p-12 rounded-3xl text-center max-w-sm">
                                <FileIcon className="w-16 h-16 text-slate-700 mx-auto mb-6" />
                                <h3 className="text-white font-bold text-lg mb-2">No Preview Available</h3>
                                <p className="text-slate-400 text-sm mb-8">This file type cannot be viewed inside the platform yet.</p>
                                <button
                                    onClick={() => handleDownload(selectedFile)}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold transition-all shadow-lg shadow-teal-500/20"
                                >
                                    <Download className="w-4 h-4" /> Download File
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
                        <label className="cursor-pointer flex-1 sm:flex-none">
                            <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition-colors shadow-lg shadow-teal-500/20">
                                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                Upload Document
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

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                    type="text"
                    placeholder={viewTrash ? 'Search trash...' : 'Search documents...'}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-teal-500/30 outline-none transition-all"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
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
                            <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t border-slate-800/50 sm:border-t-0 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
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
                                        <button
                                            onClick={() => handleOpenFile(file)}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 transition-colors text-sm sm:text-xs font-bold border border-teal-500/20"
                                        >
                                            {file.file_type === 'application/pdf' ? (
                                                <><Eye className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> View Document</>
                                            ) : (
                                                <><Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> Open Editor</>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleDownload(file)}
                                            className="p-2 sm:p-2 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-transparent flex justify-center items-center"
                                            title="Download"
                                        >
                                            <Download className="w-5 h-5 sm:w-4 sm:h-4" />
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
