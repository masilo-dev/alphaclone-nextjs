import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Upload, Search, Trash2, FolderOpen, FileText, File as FileIcon, X,
    Download, Eye, Loader2, RotateCcw, Edit3,
    ChevronLeft,
    Filter,
    Printer,
    Share2,
    ScanLine,
    Type,
    FileQuestion,
    Quote,
    Mail,
    Send
} from 'lucide-react';
import { googleDriveService } from '../../services/googleDriveService';
import { useAuth } from '../../contexts/AuthContext';
import mammoth from 'mammoth';
import { fileUploadService } from '../../services/fileUploadService';
import { DocumentViewer } from '../contracts/DocumentViewer';
import { useTenant } from '../../contexts/TenantContext';
import { User } from '../../types';
import toast from 'react-hot-toast';
import { validateEmailField } from '@/lib/email/isValidEmail';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EnterpriseModuleChrome } from '@/components/dashboard/responsive/EnterpriseModuleChrome';
import { PageHeader } from '@/components/dashboard/responsive/PageHeader';
import { BulkActions, SelectableItem } from '@/components/BulkActions';
import { ListItemSkeleton } from '@/components/ui/Skeleton';
import { Input, Button, Modal } from '@/components/ui/UIComponents';
import { WORKSPACE, ENTERPRISE } from '@/constants/design';
import CustomContextMenu from '@/components/common/CustomContextMenu';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { notificationService } from '../../services/dashboardService';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { TemplateLibrary } from './TemplateLibrary';

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

type ViewMode = 'list' | 'viewer' | 'editor' | 'image' | 'designer';

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

type DocumentActivityItem = {
    id: string;
    createdAt: string;
    title: string;
    description?: string;
    fileId?: string;
    source: 'system' | 'session';
};

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
    if (fileType.includes('quote') || fileType.includes('quotation')) return <Quote className="w-5 h-5 text-purple-400" />;
    return <FileQuestion className="w-5 h-5 text-slate-400" />;
}

function getFileLabel(fileType: string): string {
    if (fileType === 'application/pdf') return 'PDF';
    if (fileType.includes('wordprocessingml') || fileType.includes('msword')) return 'Word';
    if (fileType.includes('spreadsheetml') || fileType.includes('ms-excel')) return 'Excel';
    if (fileType.includes('image')) return 'Image';
    if (fileType.includes('quote') || fileType.includes('quotation')) return 'Quote';
    return 'Document';
}

const DocumentHub: React.FC<DocumentHubProps> = ({ user }) => {
    const { currentTenant } = useTenant();
    const { confirm } = useConfirmDialog();
    const [files, setFiles] = useState<HubFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [documentFilter, setDocumentFilter] = useState<string>('all');
    const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'size_asc' | 'size_desc'>('newest');
    const [viewTrash, setViewTrash] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [selectedFile, setSelectedFile] = useState<HubFile | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [editorContent, setEditorContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [storageUsed, setStorageUsed] = useState(0);
    const { user: authUser } = useAuth();
    const [isSavingToDrive, setIsSavingToDrive] = useState<string | null>(null);
    const [emailFile, setEmailFile] = useState<HubFile | null>(null);
    const [emailTo, setEmailTo] = useState('');
    const [emailSubject, setEmailSubject] = useState('');
    const [emailMessage, setEmailMessage] = useState('');
    const [isEmailing, setIsEmailing] = useState(false);
    const [activityOpen, setActivityOpen] = useState(false);
    const [activityLoading, setActivityLoading] = useState(false);
    const [systemActivityItems, setSystemActivityItems] = useState<DocumentActivityItem[]>([]);
    const [activityItems, setActivityItems] = useState<DocumentActivityItem[]>([]);
    const activityCounterRef = useRef(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scanInputRef = useRef<HTMLInputElement>(null);

    const recordActivity = useCallback((input: Omit<DocumentActivityItem, 'id' | 'createdAt' | 'source'> & { fileId?: string }) => {
        activityCounterRef.current += 1;
        const now = new Date().toISOString();
        setActivityItems((prev) => [
            {
                id: `session-${activityCounterRef.current}`,
                createdAt: now,
                title: input.title,
                description: input.description,
                fileId: input.fileId,
                source: 'session',
            },
            ...prev,
        ]);
    }, []);

    const openEmailModal = useCallback((file: HubFile) => {
        setEmailFile(file);
        setEmailTo('');
        setEmailSubject(`Document: ${file.original_filename}`);
        setEmailMessage(`Hi,\n\nPlease find attached "${file.original_filename}".\n\nBest regards`);
    }, []);

    const handleEmailDocument = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailFile) return;
        if (!currentTenant?.id) {
            toast.error('No active workspace');
            return;
        }
        const recipient = emailTo.trim();
        const emailError = validateEmailField(recipient);
        if (emailError) {
            toast.error(emailError);
            return;
        }
        setIsEmailing(true);
        const toastId = toast.loading('Sending document...');
        try {
            const safeMessage = emailMessage.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;line-height:1.6;white-space:pre-wrap;">${safeMessage}</div>`;
            const response = await fetch('/api/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    to: recipient,
                    subject: emailSubject.trim() || `Document: ${emailFile.original_filename}`,
                    body_html: html,
                    document_file_ids: [emailFile.id],
                    skipRecipientGate: true,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || data?.success === false) {
                throw new Error(data?.error || 'Failed to send');
            }
            toast.success('Document sent', { id: toastId });
            recordActivity({
                title: 'Emailed',
                description: `Sent "${emailFile.original_filename}" to ${recipient}.`,
                fileId: emailFile.id,
            });
            setEmailFile(null);
        } catch (err: any) {
            console.error('Email document error:', err);
            toast.error(err?.message || 'Failed to send document', { id: toastId });
        } finally {
            setIsEmailing(false);
        }
    }, [emailFile, emailTo, emailSubject, emailMessage, currentTenant?.id, recordActivity]);

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

    useEffect(() => {
        setSelectedIds(new Set());
        setPage(1);
    }, [viewTrash, files]);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, documentFilter, sortMode, pageSize]);

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

    const handleCreateQuote = () => {
        setEditorContent(`
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px;">
                <h1 style="text-align: center; color: #333; margin-bottom: 30px;">Price Quote</h1>
                <div style="margin-bottom: 30px;">
                    <p><strong>Quote #:</strong> ${format(new Date(), 'yyyy-MM-dd')}-001</p>
                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                    <p><strong>Valid Until:</strong> ${format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')}</p>
                </div>
                <h2 style="color: #333; margin-bottom: 20px;">Items & Services</h2>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                    <tr style="border-bottom: 2px solid #333;">
                        <th style="padding: 10px; text-align: left;">Description</th>
                        <th style="padding: 10px; text-align: right;">Quantity</th>
                        <th style="padding: 10px; text-align: right;">Unit Price</th>
                        <th style="padding: 10px; text-align: right;">Total</th>
                    </tr>
                    <tr style="border-bottom: 1px solid #ccc;">
                        <td style="padding: 10px;">Service Description</td>
                        <td style="padding: 10px; text-align: right;">1</td>
                        <td style="padding: 10px; text-align: right;">$0.00</td>
                        <td style="padding: 10px; text-align: right;">$0.00</td>
                    </tr>
                </table>
                <div style="text-align: right;">
                    <p><strong>Subtotal:</strong> $0.00</p>
                    <p><strong>Tax:</strong> $0.00</p>
                    <p><strong>Total:</strong> $0.00</p>
                </div>
            </div>
        `);
        setSelectedFile({
            id: 'new-quote',
            original_filename: `Quote-${format(new Date(), 'yyyy-MM-dd-HHmm')}.docx`,
            file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            file_size: 0,
            storage_path: '',
            created_at: new Date().toISOString(),
            deleted_at: null
        });
        setViewMode('editor');
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
                recordActivity({
                    title: 'Uploaded',
                    description: `Uploaded "${file.name}".`,
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
            recordActivity({
                title: 'Saved to Drive',
                description: `Saved "${file.original_filename}" to Google Drive.`,
                fileId: file.id,
            });
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
            recordActivity({
                title: 'Moved to trash',
                description: 'File moved to trash.',
                fileId,
            });
            loadFiles();
        } else {
            toast.error(result.error || 'Failed to delete');
        }
    };

    const handleRestore = async (fileId: string) => {
        const result = await fileUploadService.restoreFile(fileId);
        if (result.success) {
            toast.success('File restored');
            recordActivity({
                title: 'Restored',
                description: 'File restored from trash.',
                fileId,
            });
            loadFiles();
        } else {
            toast.error(result.error || 'Failed to restore');
        }
    };

    const handlePermanentDelete = async (fileId: string, opts?: { skipConfirm?: boolean }) => {
        if (!opts?.skipConfirm) {
            const ok = await confirm({
                title: 'Permanently delete file?',
                description: 'This cannot be undone.',
                confirmLabel: 'Delete permanently',
                cancelLabel: 'Cancel',
                variant: 'danger',
            });
            if (!ok) return;
        }
        const result = await fileUploadService.permanentDeleteFile(fileId);
        if (result.success) {
            toast.success('File permanently deleted');
            recordActivity({
                title: 'Deleted permanently',
                description: 'File permanently deleted.',
                fileId,
            });
            loadFiles();
            loadStorageUsage();
        } else {
            toast.error(result.error || 'Failed to delete');
        }
    };

    const handleEmptyTrash = async () => {
        if (!currentTenant?.id) return;
        const ok = await confirm({
            title: 'Empty trash?',
            description: 'Permanently delete everything in trash. This cannot be undone.',
            confirmLabel: 'Empty trash',
            cancelLabel: 'Cancel',
            variant: 'danger',
        });
        if (!ok) return;
        await fileUploadService.emptyTrash(currentTenant.id);
        toast.success('Trash emptied');
        loadFiles();
        loadStorageUsage();
    };

    const handleSaveAnnotations = async (annotations: any[]) => {
        if (!selectedFile) return;
        setIsSaving(true);
        try {
            const response = await fetch(`/api/tenant/${encodeURIComponent(currentTenant?.id || '')}/files`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'annotations', fileId: selectedFile.id, annotations }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Annotations could not be saved');
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
            const ok = await confirm({
                title: 'Download with annotations?',
                description: 'This document has signatures or notes. Download with these saved annotations included?',
                confirmLabel: 'Download annotated',
                cancelLabel: 'Download original',
                variant: 'primary',
            });
            if (ok) {
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
            recordActivity({
                title: 'Downloaded',
                description: `Downloaded "${file.original_filename}".`,
                fileId: file.id,
            });
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

    const handleAIDesign = async () => {
        if (!aiPrompt.trim()) {
            toast.error('Please describe the document you want to create');
            return;
        }

        setIsGeneratingAI(true);
        const toastId = toast.loading('AI is designing your professional document...');
        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: aiPrompt,
                    systemPrompt: `You are a professional document designer for AlphaClone. Create a high-quality, colorful, and professional HTML/CSS document based on the user's description. 
                            Use modern typography (Inter, system fonts), vibrant colors, and clear sections. 
                            Format your response as valid HTML content that can be placed inside a <div>.
                            IMPORTANT: Use inline styles for all elements to ensure they render correctly in PDF.
                            Include a sophisticated header, organized content, and a professional footer.
                            Use colors like Teal (#14b8a6), Slate (#0f172a), and Violet (#7c3aed) for a premium look.
                            Make sure the background is colorful and professional, not just white.`
                })
            });

            if (!response.ok) throw new Error('AI generation failed');
            const data = await response.json();
            
            const generatedHtml = data.content || data.text;
            
            setEditorContent(generatedHtml);
            setSelectedFile({
                id: 'ai-design',
                original_filename: `AI-Design-${format(new Date(), 'yyyy-MM-dd-HHmm')}.docx`,
                file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                file_size: 0,
                storage_path: '',
                created_at: new Date().toISOString(),
                deleted_at: null
            });
            setViewMode('editor');
            setAiPrompt('');
            toast.success('Professional design ready for review!', { id: toastId });
        } catch (error) {
            console.error('AI Design error:', error);
            toast.error('Failed to generate design', { id: toastId });
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleDownloadAsPDF = async (flattenViewer = false) => {
        if (!selectedFile) return;
        setIsSaving(true);
        const toastId = toast.loading('Generating premium PDF...');
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            let element: HTMLElement | null = null;
            element = flattenViewer
                ? (document.querySelector('.document-viewer-container') as HTMLElement)
                : document.getElementById('editor-pdf-content');

            if (!element) {
                element = document.querySelector('.document-viewer-container') as HTMLElement;
            }

            if (!element) {
                toast.error('Could not find content to print', { id: toastId });
                return;
            }

            // Create a clone for PDF generation to inject better styles
            const printElement = element.cloneNode(true) as HTMLElement;
            printElement.style.padding = '40px';
            printElement.style.color = '#ffffff';
            printElement.style.fontFamily = 'Inter, system-ui, sans-serif';

            const opt: any = {
                margin: 0,
                filename: selectedFile.original_filename.replace(/\.(doc|docx|txt)$/i, '.pdf'),
                image: { type: 'jpeg', quality: 1 },
                html2canvas: {
                    scale: 3,
                    useCORS: true,
                    logging: false,
                    letterRendering: true,
                    backgroundColor: currentTenant?.brand_color_primary || '#0f172a'
                },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };

            await html2pdf().from(printElement).set(opt).save();
            toast.success('Professional PDF generated!', { id: toastId });
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

    const sortedFiles = useMemo(() => {
        const next = [...filteredFiles];
        switch (sortMode) {
            case 'oldest':
                next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                break;
            case 'name_asc':
                next.sort((a, b) => a.original_filename.localeCompare(b.original_filename));
                break;
            case 'name_desc':
                next.sort((a, b) => b.original_filename.localeCompare(a.original_filename));
                break;
            case 'size_asc':
                next.sort((a, b) => (a.file_size || 0) - (b.file_size || 0));
                break;
            case 'size_desc':
                next.sort((a, b) => (b.file_size || 0) - (a.file_size || 0));
                break;
            case 'newest':
            default:
                next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                break;
        }
        return next;
    }, [filteredFiles, sortMode]);

    const toggleSelectedId = useCallback((id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const pagination = useMemo(() => {
        const totalItems = sortedFiles.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const pageStart = (safePage - 1) * pageSize;
        const pagedFiles = sortedFiles.slice(pageStart, pageStart + pageSize);
        return { totalItems, totalPages, safePage, pageStart, pagedFiles };
    }, [page, pageSize, sortedFiles]);

    useEffect(() => {
        if (!activityOpen) return;
        if (!currentTenant?.id) return;
        if (!selectedFile?.id) return;
        if (selectedFile.id.startsWith('new-')) {
            setSystemActivityItems([]);
            return;
        }

        let cancelled = false;
        setActivityLoading(true);

        notificationService
            .getNotifications(user.id, currentTenant.id, 200)
            .then(({ notifications }) => {
                if (cancelled) return;
                const fileName = selectedFile.original_filename;
                const items: DocumentActivityItem[] = notifications
                    .filter((n) => n.link === '/dashboard/documents' || n.title.toLowerCase().includes('document'))
                    .filter((n) => (n.message ? n.message.includes(fileName) : true))
                    .slice(0, 50)
                    .map((n) => ({
                        id: n.id,
                        createdAt: n.created_at,
                        title: n.title,
                        description: n.message,
                        fileId: selectedFile.id,
                        source: 'system',
                    }));
                setSystemActivityItems(items);
            })
            .finally(() => {
                if (cancelled) return;
                setActivityLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [activityOpen, currentTenant?.id, selectedFile?.id, selectedFile?.original_filename, user.id]);

    const storagePercent = Math.min((storageUsed / (100 * BYTES_TO_MB)) * 100, 100);

    const renderEmailModal = () => {
        if (!emailFile) return null;
        return (
            <Modal
                isOpen
                onClose={() => setEmailFile(null)}
                title="Email document"
                maxWidth="max-w-lg"
            >
                <form onSubmit={handleEmailDocument} className="flex flex-col gap-4">
                    <p className="text-xs text-[var(--text-muted)]">
                        {emailFile.original_filename} will be attached
                    </p>
                    <Input
                        label="To"
                        type="email"
                        required
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        placeholder="client@example.com"
                        validate={(value) => validateEmailField(value) || undefined}
                    />
                    <Input
                        label="Subject"
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                    />
                    <Input
                        label="Message"
                        textarea
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                    />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3 pt-1">
                        <Button type="button" variant="outline" onClick={() => setEmailFile(null)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isEmailing}
                            icon={<Send className="w-4 h-4" aria-hidden="true" />}
                        >
                            Send
                        </Button>
                    </div>
                </form>
            </Modal>
        );
    };

    const renderActivityModal = () => {
        if (!activityOpen || !selectedFile) return null;
        const merged = [...activityItems, ...systemActivityItems]
            .filter((item) => !item.fileId || item.fileId === selectedFile.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return (
            <Modal
                isOpen
                onClose={() => setActivityOpen(false)}
                title="Document activity"
                maxWidth="max-w-xl"
            >
                {activityLoading ? (
                    <div className="space-y-3">
                        <div className="h-5 w-1/3 rounded bg-[color-mix(in_srgb,var(--ws-border)_35%,transparent)] ac-skeleton-pulse" />
                        <div className="h-5 w-2/3 rounded bg-[color-mix(in_srgb,var(--ws-border)_35%,transparent)] ac-skeleton-pulse" />
                        <div className="h-5 w-1/2 rounded bg-[color-mix(in_srgb,var(--ws-border)_35%,transparent)] ac-skeleton-pulse" />
                    </div>
                ) : merged.length === 0 ? (
                    <div className="text-sm text-[var(--text-secondary)]">
                        No activity is available for this file yet.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {merged.map((item) => (
                            <div key={item.id} className="ac-workspace-panel p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-[var(--ws-text-primary)]">
                                            {item.title}
                                        </p>
                                        {item.description ? (
                                            <p className="mt-1 text-xs text-[var(--ws-text-secondary)]">
                                                {item.description}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="text-[11px] text-[var(--ws-text-muted)] whitespace-nowrap">
                                        {format(new Date(item.createdAt), 'MMM d, HH:mm')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Modal>
        );
    };

    // ── VIEWER / EDITOR MODE ──────────────────────────────────────────────────
    if (viewMode !== 'list' && selectedFile) {
        const isPdf = selectedFile.file_type === 'application/pdf';
        const printTarget = fileUrl || (selectedFile.storage_path ? fileUploadService.getProxiedUrl('uploads', selectedFile.storage_path) : '');
        const viewerDescription = `${getFileLabel(selectedFile.file_type)} · ${formatBytes(selectedFile.file_size)} · ${format(new Date(selectedFile.created_at), 'MMM d, yyyy')}`;
        return (
            <div className="fixed inset-0 z-[1100] flex flex-col bg-[var(--ws-canvas)] animate-in fade-in duration-200">
                <PageHeader
                    moduleLabel="Deliver"
                    title={selectedFile.original_filename}
                    description={viewerDescription}
                    onBack={() => { setViewMode('list'); setSelectedFile(null); setFileUrl(null); setActivityOpen(false); }}
                    primaryAction={
                        viewMode === 'editor'
                            ? {
                                label: 'Save changes',
                                onClick: handleSaveEdits,
                                variant: 'primary',
                                disabled: isSaving,
                                loading: isSaving,
                            }
                            : undefined
                    }
                    secondaryActions={[
                        ...(viewMode === 'editor'
                            ? [{
                                label: 'Save as PDF',
                                onClick: () => handleDownloadAsPDF(false),
                                variant: 'secondary' as const,
                                disabled: isSaving,
                            }]
                            : []),
                        {
                            label: 'Download',
                            onClick: () => handleDownload(selectedFile),
                            variant: 'secondary' as const,
                        },
                        ...(selectedFile.storage_path
                            ? [{
                                label: 'Email',
                                onClick: () => openEmailModal(selectedFile),
                                variant: 'secondary' as const,
                            }]
                            : []),
                        ...(selectedFile.storage_path
                            ? [{
                                label: 'Save to Drive',
                                onClick: () => handleSaveToDrive(selectedFile),
                                variant: 'secondary' as const,
                                disabled: !authUser,
                                loading: isSavingToDrive === selectedFile.id,
                            }]
                            : []),
                        ...(printTarget
                            ? [{
                                label: 'Print',
                                onClick: () => handlePrint(printTarget),
                                variant: 'secondary' as const,
                            }]
                            : []),
                        {
                            label: 'Activity',
                            onClick: () => setActivityOpen(true),
                            variant: 'secondary' as const,
                        },
                    ]}
                />
                {selectedFile ? (
                    <div className="px-4 py-2 border-b border-white/5 bg-slate-950/80">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Related versions
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {files
                                .filter((f) => {
                                    const base = (name: string) =>
                                        name.replace(/\.(docx?|pdf|txt)$/i, '').replace(/ \(\d+\)$/, '');
                                    return (
                                        base(f.original_filename) ===
                                            base(selectedFile.original_filename) &&
                                        f.id !== selectedFile.id
                                    );
                                })
                                .slice(0, 8)
                                .map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setSelectedFile(f)}
                                        className="text-[10px] px-2 py-1 rounded-lg border border-white/10 text-slate-300 hover:border-teal-500/40 hover:text-teal-300"
                                    >
                                        {f.original_filename} ·{' '}
                                        {new Date(f.created_at).toLocaleDateString()}
                                    </button>
                                ))}
                            {files.filter((f) => {
                                const base = (name: string) =>
                                    name.replace(/\.(docx?|pdf|txt)$/i, '').replace(/ \(\d+\)$/, '');
                                return (
                                    base(f.original_filename) === base(selectedFile.original_filename) &&
                                    f.id !== selectedFile.id
                                );
                            }).length === 0 ? (
                                <span className="text-[11px] text-slate-500">
                                    Save edits to create another version of this file.
                                </span>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                {renderEmailModal()}
                {renderActivityModal()}

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
                                <Image
                                    src={fileUrl}
                                    alt={selectedFile.original_filename}
                                    fill
                                    unoptimized
                                    className="object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
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
                                {/* Render off-screen (required for rendering clean HTML to PDF without editor toolbars) instead of display: hidden so canvas can capture it */}
                                <div className="fixed -left-[9999px] top-0 opacity-0 pointer-events-none">
                                    {/* Removed 'prose prose-slate' because Tailwind uses oklch/lab which html2canvas cannot parse. Using exact hex codes and standard CSS mimics to prevent the color crash. */}
                                    <div
                                        id="editor-pdf-content"
                                        className="p-10 max-w-none min-h-[1056px] [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-6 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-4 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4 [&_strong]:font-bold [&_em]:italic"
                                        style={{ color: '#000000', backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }}
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
        <>
            <EnterpriseModuleChrome
                moduleKey="documents"
                meta={{
                    title: viewTrash ? 'Document trash' : 'Documents',
                    description: viewTrash
                        ? 'Restore or permanently delete files in the trash.'
                        : 'Upload, sign, and organize files across your workspace.',
                }}
                toolbar={
                    <div
                        className={cn(
                            'sticky top-0 z-20 border-b border-[var(--ws-border)] bg-[var(--ws-toolbar)]',
                            'px-4 md:px-6 py-3',
                        )}
                    >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={viewTrash ? 'Search trash…' : 'Search documents…'}
                                    icon={<Search className="w-4 h-4" aria-hidden="true" />}
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                {!viewTrash ? (
                                    <div className="relative">
                                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
                                        <select
                                            value={documentFilter}
                                            onChange={(e) => setDocumentFilter(e.target.value)}
                                            className="min-h-11 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] pl-10 pr-9 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                        >
                                            <option value="all">All files</option>
                                            <option value="pdf">PDFs</option>
                                            <option value="word">Word docs</option>
                                            <option value="image">Images</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" aria-hidden="true">
                                            <ChevronLeft className="w-4 h-4 -rotate-90" />
                                        </div>
                                    </div>
                                ) : null}

                                <div className="relative">
                                    <select
                                        value={sortMode}
                                        onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                                        className="min-h-11 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] px-3 pr-9 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                        aria-label="Sort documents"
                                    >
                                        <option value="newest">Newest</option>
                                        <option value="oldest">Oldest</option>
                                        <option value="name_asc">Name A–Z</option>
                                        <option value="name_desc">Name Z–A</option>
                                        <option value="size_desc">Largest</option>
                                        <option value="size_asc">Smallest</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" aria-hidden="true">
                                        <ChevronLeft className="w-4 h-4 -rotate-90" />
                                    </div>
                                </div>

                                <div className="relative">
                                    <select
                                        value={String(pageSize)}
                                        onChange={(e) => setPageSize(Number(e.target.value))}
                                        className="min-h-11 rounded-[10px] bg-[var(--surface-primary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] px-3 pr-9 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                        aria-label="Items per page"
                                    >
                                        <option value="10">10 / page</option>
                                        <option value="25">25 / page</option>
                                        <option value="50">50 / page</option>
                                        <option value="100">100 / page</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" aria-hidden="true">
                                        <ChevronLeft className="w-4 h-4 -rotate-90" />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setViewTrash((v) => !v)}
                                    className={cn(
                                        WORKSPACE.action.secondary,
                                        ENTERPRISE.touchTarget,
                                        'inline-flex items-center gap-2 px-3',
                                        viewTrash && 'border-red-500/40 text-red-300 hover:bg-red-500/10',
                                    )}
                                >
                                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                                    {viewTrash ? 'Exit trash' : 'Trash'}
                                </button>

                                {viewTrash ? (
                                    <button
                                        type="button"
                                        onClick={handleEmptyTrash}
                                        className={cn(
                                            'ac-workspace-action-btn border border-red-500/40 text-red-300 hover:bg-red-500/10',
                                            ENTERPRISE.touchTarget,
                                            'inline-flex items-center gap-2 px-3',
                                        )}
                                    >
                                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                                        Empty trash
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('designer')}
                                            className={cn(
                                                WORKSPACE.action.bonnie,
                                                ENTERPRISE.touchTarget,
                                                'inline-flex items-center gap-2 px-3',
                                            )}
                                        >
                                            <ScanLine className="w-4 h-4" aria-hidden="true" />
                                            AI designer
                                        </button>

                                        <label className={cn(WORKSPACE.action.secondary, ENTERPRISE.touchTarget, 'inline-flex items-center gap-2 px-3 cursor-pointer')}>
                                            {isUploading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                            ) : (
                                                <Upload className="w-4 h-4" aria-hidden="true" />
                                            )}
                                            Upload
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
                                            type="button"
                                            onClick={handleCreateDocument}
                                            className={cn(WORKSPACE.action.secondary, ENTERPRISE.touchTarget, 'inline-flex items-center gap-2 px-3')}
                                        >
                                            <Type className="w-4 h-4" aria-hidden="true" />
                                            Write doc
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleCreateQuote}
                                            className={cn(WORKSPACE.action.secondary, ENTERPRISE.touchTarget, 'inline-flex items-center gap-2 px-3')}
                                        >
                                            <Quote className="w-4 h-4" aria-hidden="true" />
                                            Quote
                                        </button>

                                        <label className={cn(WORKSPACE.action.secondary, ENTERPRISE.touchTarget, 'inline-flex items-center gap-2 px-3 cursor-pointer')}>
                                            <ScanLine className="w-4 h-4" aria-hidden="true" />
                                            Scan
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
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                }
                stats={
                    !viewTrash ? (
                        <div className="px-4 md:px-6">
                            <div className="ac-workspace-panel p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-[var(--ws-text-muted)] font-medium">Storage used</span>
                                    <span className="text-xs text-[var(--ws-text-secondary)] font-semibold">
                                        {formatBytes(storageUsed)} / 100 MB
                                    </span>
                                </div>
                                <div className="h-1.5 bg-[color-mix(in_srgb,var(--ws-border)_40%,transparent)] rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-all',
                                            storagePercent > 80
                                                ? 'bg-[var(--danger)]'
                                                : storagePercent > 60
                                                    ? 'bg-[var(--warning)]'
                                                    : 'bg-[var(--success)]',
                                        )}
                                        style={{ width: `${storagePercent}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null
                }
            >
                <div className="px-4 md:px-6 pb-6 space-y-4" style={{ touchAction: 'pan-y' }}>
                    <TemplateLibrary />

                    <BulkActions
                        items={sortedFiles}
                        selectedIds={selectedIds}
                        onSelectionChange={setSelectedIds}
                        actions={
                            viewTrash
                                ? [
                                    {
                                        label: 'Restore',
                                        icon: <RotateCcw className="w-4 h-4" aria-hidden="true" />,
                                        onClick: async (selected) => {
                                            for (const item of selected) {
                                                await handleRestore(item.id);
                                            }
                                        },
                                    },
                                    {
                                        label: 'Delete',
                                        icon: <Trash2 className="w-4 h-4" aria-hidden="true" />,
                                        variant: 'danger',
                                        onClick: async (selected) => {
                                            const ok = await confirm({
                                                title: 'Permanently delete selected files?',
                                                description: `Delete ${selected.length} file(s)? This cannot be undone.`,
                                                confirmLabel: 'Delete permanently',
                                                cancelLabel: 'Cancel',
                                                variant: 'danger',
                                            });
                                            if (!ok) return;
                                            for (const item of selected) {
                                                await handlePermanentDelete(item.id);
                                            }
                                        },
                                    },
                                ]
                                : [
                                    {
                                        label: 'Download',
                                        icon: <Download className="w-4 h-4" aria-hidden="true" />,
                                        onClick: async (selected) => {
                                            const toastId = toast.loading(`Downloading ${selected.length} file(s)...`);
                                            try {
                                                for (const item of selected) await handleDownload(item);
                                                toast.success('Downloads started', { id: toastId });
                                            } catch {
                                                toast.error('Download failed', { id: toastId });
                                            }
                                        },
                                    },
                                    {
                                        label: 'Move to trash',
                                        icon: <Trash2 className="w-4 h-4" aria-hidden="true" />,
                                        variant: 'danger',
                                        onClick: async (selected) => {
                                            const toastId = toast.loading(`Moving ${selected.length} file(s) to trash...`);
                                            try {
                                                for (const item of selected) await handleSoftDelete(item.id);
                                                toast.success('Moved to trash', { id: toastId });
                                            } catch {
                                                toast.error('Move to trash failed', { id: toastId });
                                            }
                                        },
                                    },
                                ]
                        }
                    />

                    {isLoading ? (
                        <ListItemSkeleton count={6} />
                    ) : sortedFiles.length === 0 ? (
                        <div className="ac-workspace-panel p-10 text-center">
                            <FolderOpen className="w-14 h-14 text-[var(--ws-text-muted)] mx-auto mb-4" aria-hidden="true" />
                            <p className="text-sm font-medium text-[var(--ws-text-secondary)]">
                                {viewTrash
                                    ? 'Trash is empty.'
                                    : searchQuery
                                        ? 'No documents match your search.'
                                        : 'No documents yet.'}
                            </p>
                            {!viewTrash && !searchQuery ? (
                                <p className="text-xs text-[var(--ws-text-muted)] mt-1">
                                    Upload a PDF, Word doc, or image to get started.
                                </p>
                            ) : null}
                            {!viewTrash && !searchQuery ? (
                                <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                                    <Button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        icon={<Upload className="w-4 h-4" aria-hidden="true" />}
                                    >
                                        Upload
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => scanInputRef.current?.click()}
                                        icon={<ScanLine className="w-4 h-4" aria-hidden="true" />}
                                    >
                                        Scan
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCreateDocument}
                                        icon={<Type className="w-4 h-4" aria-hidden="true" />}
                                    >
                                        Write doc
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {pagination.pagedFiles.map((file) => {
                                const isSelected = selectedIds.has(file.id);
                                const contextItems = viewTrash
                                    ? [
                                        { label: 'Restore', icon: <RotateCcw className="w-4 h-4" aria-hidden="true" />, onClick: () => handleRestore(file.id) },
                                        { label: 'Delete permanently', icon: <Trash2 className="w-4 h-4" aria-hidden="true" />, onClick: () => handlePermanentDelete(file.id), destructive: true },
                                    ]
                                    : [
                                        { label: 'Open', icon: <Edit3 className="w-4 h-4" aria-hidden="true" />, onClick: () => handleOpenFile(file) },
                                        { label: 'Download', icon: <Download className="w-4 h-4" aria-hidden="true" />, onClick: () => handleDownload(file) },
                                        { label: 'Print', icon: <Printer className="w-4 h-4" aria-hidden="true" />, onClick: () => handlePrint(fileUploadService.getProxiedUrl('uploads', file.storage_path)) },
                                        { label: 'Email', icon: <Mail className="w-4 h-4" aria-hidden="true" />, onClick: () => openEmailModal(file) },
                                        { label: 'Save to Drive', icon: <Share2 className="w-4 h-4" aria-hidden="true" />, onClick: () => handleSaveToDrive(file) },
                                        { label: 'Move to trash', icon: <Trash2 className="w-4 h-4" aria-hidden="true" />, onClick: () => handleSoftDelete(file.id), destructive: true },
                                    ];

                                return (
                                    <SelectableItem
                                        key={file.id}
                                        id={file.id}
                                        isSelected={isSelected}
                                        onToggle={toggleSelectedId}
                                        className="group"
                                    >
                                        <CustomContextMenu items={contextItems}>
                                            <div
                                                className={cn(
                                                    'ac-workspace-panel p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
                                                    isSelected && 'ring-2 ring-[var(--focus-ring)]',
                                                )}
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="p-2.5 rounded-lg shrink-0 bg-[color-mix(in_srgb,var(--ws-border)_35%,transparent)]">
                                                        {getFileIcon(file.file_type)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-[var(--ws-text-primary)] truncate">
                                                            {file.original_filename}
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[var(--ws-border)] text-[var(--ws-text-muted)]">
                                                                {getFileLabel(file.file_type)}
                                                            </span>
                                                            <span className="text-xs text-[var(--ws-text-muted)]">
                                                                {formatBytes(file.file_size)}
                                                            </span>
                                                            <span className="text-xs text-[var(--ws-text-muted)]">
                                                                {format(new Date(file.created_at), 'MMM d, yyyy')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t border-[color-mix(in_srgb,var(--ws-border)_60%,transparent)] sm:border-t-0">
                                                    {viewTrash ? (
                                                        <>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleRestore(file.id)}
                                                                icon={<RotateCcw className="w-4 h-4" aria-hidden="true" />}
                                                            >
                                                                Restore
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="danger"
                                                                size="sm"
                                                                onClick={() => handlePermanentDelete(file.id)}
                                                                icon={<Trash2 className="w-4 h-4" aria-hidden="true" />}
                                                            >
                                                                Delete
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                onClick={() => handleOpenFile(file)}
                                                                icon={
                                                                    file.file_type.includes('image') ? (
                                                                        <Eye className="w-4 h-4" aria-hidden="true" />
                                                                    ) : (
                                                                        <Edit3 className="w-4 h-4" aria-hidden="true" />
                                                                    )
                                                                }
                                                            >
                                                                Open
                                                            </Button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDownload(file)}
                                                                className={cn(
                                                                    WORKSPACE.action.secondary,
                                                                    ENTERPRISE.touchTarget,
                                                                    'inline-flex items-center justify-center px-3',
                                                                )}
                                                                aria-label="Download"
                                                            >
                                                                <Download className="w-4 h-4" aria-hidden="true" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePrint(fileUploadService.getProxiedUrl('uploads', file.storage_path))}
                                                                className={cn(
                                                                    WORKSPACE.action.secondary,
                                                                    ENTERPRISE.touchTarget,
                                                                    'inline-flex items-center justify-center px-3',
                                                                )}
                                                                aria-label="Print"
                                                            >
                                                                <Printer className="w-4 h-4" aria-hidden="true" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openEmailModal(file)}
                                                                className={cn(
                                                                    WORKSPACE.action.secondary,
                                                                    ENTERPRISE.touchTarget,
                                                                    'inline-flex items-center justify-center px-3',
                                                                )}
                                                                aria-label="Email document"
                                                            >
                                                                <Mail className="w-4 h-4" aria-hidden="true" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSaveToDrive(file)}
                                                                disabled={isSavingToDrive === file.id}
                                                                className={cn(
                                                                    WORKSPACE.action.secondary,
                                                                    ENTERPRISE.touchTarget,
                                                                    'inline-flex items-center justify-center px-3 disabled:opacity-50',
                                                                )}
                                                                aria-label="Save to Google Drive"
                                                            >
                                                                {isSavingToDrive === file.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                                                ) : (
                                                                    <Share2 className="w-4 h-4" aria-hidden="true" />
                                                                )}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSoftDelete(file.id)}
                                                                className={cn(
                                                                    'ac-workspace-action-btn border border-red-500/40 text-red-300 hover:bg-red-500/10',
                                                                    ENTERPRISE.touchTarget,
                                                                    'inline-flex items-center justify-center px-3',
                                                                )}
                                                                aria-label="Move to trash"
                                                            >
                                                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </CustomContextMenu>
                                    </SelectableItem>
                                );
                            })}
                        </div>
                    )}

                    {!isLoading && sortedFiles.length > 0 ? (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                            <p className="text-xs text-[var(--ws-text-muted)]">
                                Showing {Math.min(pagination.pageStart + 1, pagination.totalItems)}–
                                {Math.min(pagination.pageStart + pageSize, pagination.totalItems)} of {pagination.totalItems}
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={pagination.safePage <= 1}
                                    className={cn(
                                        WORKSPACE.action.secondary,
                                        ENTERPRISE.touchTarget,
                                        'inline-flex items-center justify-center px-3 disabled:opacity-50 disabled:cursor-not-allowed',
                                    )}
                                >
                                    Previous
                                </button>
                                <span className="text-xs font-semibold text-[var(--ws-text-secondary)]">
                                    Page {pagination.safePage} / {pagination.totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                    disabled={pagination.safePage >= pagination.totalPages}
                                    className={cn(
                                        WORKSPACE.action.secondary,
                                        ENTERPRISE.touchTarget,
                                        'inline-flex items-center justify-center px-3 disabled:opacity-50 disabled:cursor-not-allowed',
                                    )}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>
            </EnterpriseModuleChrome>
        
        {/* AI Designer Interface */}
        {viewMode === 'designer' && (
            <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 animate-in fade-in duration-300">
                <div className="w-full max-w-3xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                    <div className="p-8 border-b border-white/5 bg-gradient-to-br from-violet-600/20 to-transparent">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center">
                                    <ScanLine className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">AI Document Designer</h3>
                                    <p className="text-slate-400 text-sm font-medium">Transform descriptions into professional documents</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewMode('list')}
                                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Creation Intent</label>
                                <textarea
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    placeholder="Describe the document you want... e.g., 'A professional project proposal for a tech company with a clear timeline and budget section, using a teal and slate color palette.'"
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-h-[160px] resize-none transition-all text-sm leading-relaxed"
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={handleAIDesign}
                                    disabled={isGeneratingAI || !aiPrompt.trim()}
                                    className="flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black uppercase tracking-tighter transition-all disabled:opacity-50 shadow-xl shadow-violet-500/20 group"
                                >
                                    {isGeneratingAI ? (
                                        <>
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                            Architecting Design...
                                        </>
                                    ) : (
                                        <>
                                            <ScanLine className="w-6 h-6 group-hover:scale-110 transition-transform" />
                                            Initialize PDF Generation
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className="px-8 py-4 rounded-2xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6 bg-slate-950/50 border-t border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="flex -space-x-2">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 overflow-hidden">
                                        <div className={`w-full h-full bg-gradient-to-br ${i === 1 ? 'from-teal-500 to-blue-500' : i === 2 ? 'from-violet-500 to-purple-500' : 'from-orange-500 to-red-500'}`} />
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                                Utilizing advanced AI for professional document generation
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}
        {renderEmailModal()}
        </>
    );
};

export default DocumentHub;
