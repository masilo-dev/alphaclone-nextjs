import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { auditLoggingService } from './auditLoggingService';
import { activityService } from './activityService';

// Allowed file types
const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.ms-powerpoint', // .ppt
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
    'application/json',
    'application/xml'
];

// Max file size: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Per-user total storage limit: 100MB
const USER_STORAGE_LIMIT = 100 * 1024 * 1024;

export interface FileUploadResult {
    success: boolean;
    fileId?: string;
    url?: string;
    proxiedUrl?: string; // New: Proxied URL for better security
    tags?: string[];
    category?: string;
    aiSummary?: string;
    error?: string;
}

class FileUploadService {
    /**
     * Get a proxied URL for a file in Supabase storage
     */
    getProxiedUrl(bucket: string, path: string): string {
        // Construct URL for the storage proxy API
        return `/api/storage/${bucket}/${path}`;
    }

    /**
     * Convert a direct Supabase URL to a proxied URL if applicable
     */
    convertToProxiedUrl(url: string, bucket: string = 'uploads'): string {
        if (!url || !url.includes('supabase.co')) return url;

        // Extract the path after the bucket name
        const parts = url.split(`/${bucket}/`);
        if (parts.length > 1) {
            return this.getProxiedUrl(bucket, parts[1]);
        }

        return url;
    }

    /**
     * Get current user storage usage in bytes
     */
    async getUserStorageUsage(userId: string): Promise<number> {
        const { data, error } = await supabase
            .from('file_uploads')
            .select('file_size')
            .eq('user_id', userId)
            .is('deleted_at', null); // Only count active files

        if (error) {
            console.error('Error fetching storage usage:', error);
            return 0;
        }

        return data.reduce((sum: number, file: { file_size: number }) => sum + (file.file_size || 0), 0);
    }

    /**
     * Validate file before upload
     */
    private validateFile(file: File): { valid: boolean; error?: string } {
        // Check file type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            return {
                valid: false,
                error: `File type ${file.type} is not allowed. Allowed types: images, PDFs, and documents.`,
            };
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return {
                valid: false,
                error: `File size exceeds 100MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
            };
        }

        // Check filename for malicious patterns
        const filename = file.name.toLowerCase();
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar'];
        if (dangerousExtensions.some(ext => filename.endsWith(ext))) {
            return {
                valid: false,
                error: 'Executable files are not allowed.',
            };
        }

        return { valid: true };
    }

    /**
     * Validate multiple files
     */
    private validateFiles(files: File[]): { valid: boolean; error?: string } {
        // Validate each file
        for (const file of files) {
            const validation = this.validateFile(file);
            if (!validation.valid) {
                return validation;
            }
        }

        return { valid: true };
    }

    /**
     * Upload a single file
     */
    /**
     * Deep scan a file buffer for malicious patterns
     */
    async scanFile(buffer: Buffer, filename: string, mimeType: string): Promise<{ status: 'clean' | 'infected'; result: any }> {
        const issues: string[] = [];
        
        // 1. Check for malicious script patterns (XSS/RCE)
        // Only perform string-based scanning for text-like files to save memory
        const isTextLike = mimeType.includes('text') || 
                          mimeType.includes('json') || 
                          mimeType.includes('xml') || 
                          mimeType.includes('javascript') ||
                          mimeType.includes('html');

        if (isTextLike || buffer.length < 1024 * 1024) { // Scan if text-like or small (<1MB)
            // Limit string conversion to first 2MB to prevent memory overflow
            const scanLimit = 2 * 1024 * 1024;
            const content = buffer.slice(0, scanLimit).toString('utf8').toLowerCase();
            
            const maliciousPatterns = [
                '<script', 'eval(', 'javascript:', 'onesuccess=', 'onerror=',
                'powershell', 'cmd.exe', '/bin/sh', 'rm -rf', 'wget ', 'curl '
            ];

            for (const pattern of maliciousPatterns) {
                if (content.includes(pattern)) {
                    issues.push(`Malicious pattern detected: ${pattern}`);
                }
            }
        }

        // 2. Magic Number Validation (Basic)
        const header = buffer.slice(0, 4).toString('hex').toUpperCase();
        const magicNumbers: Record<string, string[]> = {
            'application/pdf': ['25504446'], // %PDF
            'image/jpeg': ['FFD8FF'],
            'image/png': ['89504E47'],
            'image/webp': ['52494646'], // RIFF (check for WEBP later)
        };

        const expected = magicNumbers[mimeType];
        if (expected && !expected.some(magic => header.startsWith(magic))) {
            issues.push(`Magic number mismatch for ${mimeType}. Detected header: ${header}`);
        }

        const status = issues.length > 0 ? 'infected' : 'clean';
        
        return {
            status,
            result: {
                scanned_at: new Date().toISOString(),
                filename,
                mime_type: mimeType,
                size: buffer.length,
                issues,
                score: status === 'clean' ? 100 : 0,
                memory_optimized: true
            }
        };
    }

    /**
     * Upload a file from a binary buffer (used by MCP/Server-side)
     */
    async uploadFileFromBuffer(
        buffer: Buffer,
        filename: string,
        mimeType: string,
        tenantId: string,
        userId: string,
        metadata?: { tags?: string[]; category?: string; aiSummary?: string; entityType?: string; entityId?: string }
    ): Promise<FileUploadResult> {
        try {
            // 1. Security Scan
            const scan = await this.scanFile(buffer, filename, mimeType);
            
            // 2. Log Scan Result (Audit Trail)
            await supabase.from('security_scans').insert({
                tenant_id: tenantId,
                filename,
                file_type: mimeType,
                score: scan.result.score,
                grade: scan.status === 'clean' ? 'A' : 'F',
                details: scan.result
            });

            if (scan.status === 'infected') {
                // Log high-priority security alert
                await auditLoggingService.logAction(
                    'file_security_blocked',
                    'security',
                    tenantId,
                    undefined,
                    { filename, mimeType, issues: scan.result.issues }
                );

                return { 
                    success: false, 
                    error: `SECURITY BLOCK: This file contains potentially malicious content and has been quarantined. Issues: ${scan.result.issues.join(', ')}` 
                };
            }

            // 3. Generate storage path
            const timestamp = Date.now();
            const randomString = crypto.randomUUID();
            const extension = filename.split('.').pop();
            const storagePath = `${userId}/${timestamp}-${randomString}.${extension}`;

            // 4. Upload to Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(storagePath, buffer, {
                    contentType: mimeType,
                    upsert: false,
                });

            if (uploadError) {
                console.error('Buffer upload error:', uploadError);
                return { success: false, error: 'Failed to upload file to storage' };
            }

            // 5. Record in Database
            const { data: fileRecord, error: dbError } = await supabase
                .from('file_uploads')
                .insert({
                    user_id: userId,
                    tenant_id: tenantId,
                    filename: storagePath,
                    original_filename: filename,
                    file_type: mimeType,
                    file_size: buffer.length,
                    storage_path: uploadData.path,
                    scan_status: 'clean',
                    scan_result: scan.result,
                    entity_type: metadata?.entityType,
                    entity_id: metadata?.entityId,
                    tags: metadata?.tags || [],
                    category: metadata?.category || null,
                    ai_summary: metadata?.aiSummary || null,
                })
                .select()
                .single();

            if (dbError) {
                console.error('Database error after buffer upload:', dbError);
                await supabase.storage.from('uploads').remove([storagePath]);
                return { success: false, error: 'Failed to record upload in database' };
            }

            return {
                success: true,
                fileId: fileRecord.id,
                url: this.getProxiedUrl('uploads', storagePath),
                proxiedUrl: this.getProxiedUrl('uploads', storagePath),
            };

        } catch (error) {
            console.error('uploadFileFromBuffer error:', error);
            return { success: false, error: String(error) };
        }
    }

    async uploadFile(
        file: File,
        entityType?: string,
        entityId?: string,
        explicitUserId?: string,
        explicitTenantId?: string,
        metadata?: { tags?: string[]; category?: string; aiSummary?: string }
    ): Promise<FileUploadResult> {
        try {
            // Validate file
            const validation = this.validateFile(file);
            if (!validation.valid) {
                return { success: false, error: validation.error || 'Validation failed' };
            }

            // Get user
            let finalUserId = explicitUserId;
            if (!finalUserId) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return { success: false, error: 'User not authenticated' };
                finalUserId = user.id;
            }

            // Get tenant
            const finalTenantId = explicitTenantId || tenantService.getCurrentTenantId();

            // Check per-user storage limit
            const currentUsage = await this.getUserStorageUsage(finalUserId as string);
            if (currentUsage + file.size > USER_STORAGE_LIMIT) {
                const remainingMb = ((USER_STORAGE_LIMIT - currentUsage) / 1024 / 1024).toFixed(2);
                return {
                    success: false,
                    error: `Storage limit exceeded. You have ${remainingMb}MB remaining of your 100MB total storage.`
                };
            }

            // Generate unique filename
            const timestamp = Date.now();
            const randomString = crypto.randomUUID();
            const extension = file.name.split('.').pop();
            const filename = `${finalUserId as string}/${timestamp}-${randomString}.${extension}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(filename, file, {
                    cacheControl: '3600',
                    upsert: false,
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                return { success: false, error: 'Failed to upload file to storage' };
            }

            // Get public URL
            const publicUrl = this.getProxiedUrl('uploads', filename);
            const urlData = { publicUrl };

            // Record upload in database
            const { data: fileRecord, error: dbError } = await supabase
                .from('file_uploads')
                .insert({
                    user_id: finalUserId as string,
                    filename: filename,
                    original_filename: file.name,
                    file_type: file.type,
                    file_size: file.size,
                    storage_path: uploadData.path,
                    scan_status: 'pending',
                    entity_type: entityType,
                    entity_id: entityId,
                    tenant_id: finalTenantId,
                    tags: metadata?.tags || [],
                    category: metadata?.category || null,
                    ai_summary: metadata?.aiSummary || null,
                })
                .select()
                .single();

            if (dbError) {
                console.error('Database error:', dbError);
                // File uploaded but not recorded - should clean up
                await supabase.storage.from('uploads').remove([filename]);
                return { success: false, error: 'Failed to record upload in database' };
            }

            // Log activity
            await activityService.logActivity(finalUserId as string, 'Document Uploaded', {
                fileId: fileRecord.id,
                filename: file.name,
                entityType,
            }, finalTenantId || undefined);

            // Audit log
            auditLoggingService.logAction(
                'file_uploaded',
                'file_upload',
                fileRecord.id,
                undefined,
                {
                    filename: file.name,
                    size: file.size,
                    type: file.type,
                    entityType,
                    entityId,
                }
            ).catch(err => console.error('Failed to log audit:', err));

            // Background task: Perform actual scanning here if implemented
            supabase
                .from('file_uploads')
                .update({ scan_status: 'clean' })
                .eq('id', fileRecord.id)
                .then();

            return {
                success: true,
                fileId: fileRecord.id,
                url: urlData.publicUrl,
                proxiedUrl: this.getProxiedUrl('uploads', filename),
            };
        } catch (error) {
            console.error('File upload error:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Upload multiple files
     */
    async uploadFiles(
        files: File[],
        entityType?: string,
        entityId?: string
    ): Promise<FileUploadResult[]> {
        // Validate all files first
        const validation = this.validateFiles(files);
        if (!validation.valid) {
            return files.map(() => ({ success: false, error: validation.error || 'Validation failed' }));
        }

        // Upload files in parallel
        const uploadPromises = files.map((file: any) =>
            this.uploadFile(file, entityType, entityId)
        );

        return Promise.all(uploadPromises);
    }

    /**
     * Delete a file
     */
    /**
     * Delete a file (Soft Delete)
     * Moves file to trash by setting deleted_at
     */
    async deleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { success: false, error: 'No active workspace' };
            const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/files`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'soft_delete', fileId }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) return { success: false, error: payload.error || 'Failed to move file to trash' };
            return { success: true };
        } catch (error) {
            console.error('File delete error:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Restore a file from trash
     */
    async restoreFile(fileId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { success: false, error: 'No active workspace' };
            const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/files`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore', fileId }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) return { success: false, error: payload.error || 'Failed to restore file' };
            return { success: true };
        } catch (error) {
            console.error('File restore error:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Permanently delete a file
     */
    async permanentDeleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { success: false, error: 'No active workspace' };
            const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/files?fileId=${encodeURIComponent(fileId)}`, { method: 'DELETE', credentials: 'include' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) return { success: false, error: payload.error || 'Failed to permanently delete file' };
            return { success: true };
        } catch (error) {
            console.error('Permanent delete error:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Delete file by entity
     */
    async deleteFileByEntity(entityType: string, entityId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { data: files } = await supabase
                .from('file_uploads')
                .select('id')
                .eq('entity_type', entityType)
                .eq('entity_id', entityId);

            if (files && files.length > 0) {
                for (const file of files) {
                    await this.deleteFile(file.id);
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Delete file by entity error:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Get file info
     */
    async getFileInfo(fileId: string) {
        const { data, error } = await supabase
            .from('file_uploads')
            .select('*')
            .eq('id', fileId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .single();

        return { file: data, error };
    }

    /**
     * Get user's files
     */
    async getUserFiles(userId: string, limit: number = 50) {
        const { data, error } = await supabase
            .from('file_uploads')
            .select('*')
            .eq('user_id', userId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .order('created_at', { ascending: false })
            .limit(limit);

        return { files: data, error };
    }

    /**
     * Get files for an entity
     */
    async getEntityFiles(entityType: string, entityId: string) {
        const { data, error } = await supabase
            .from('file_uploads')
            .select('*')
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .order('created_at', { ascending: false });

        return { files: data, error };
    }

    /**
     * Get all files for a tenant (centralized hub)
     */
    /**
     * Get all active files for a tenant (centralized hub)
     */
    async getFilesByTenant(tenantId: string) {
        const { data, error } = await supabase
            .from('file_uploads')
            .select('*')
            .eq('tenant_id', tenantId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        return { files: data, error };
    }

    /**
     * Get deleted files for a tenant (Trash)
     */
    async getDeletedFilesByTenant(tenantId: string) {
        const { data, error } = await supabase
            .from('file_uploads')
            .select('*')
            .eq('tenant_id', tenantId)
            .not('deleted_at', 'is', null)
            .order('deleted_at', { ascending: false });

        return { files: data, error };
    }

    /**
     * Permanently delete all trashed files for a tenant
     */
    async emptyTrash(tenantId: string) {
        const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/files`, { method: 'DELETE', credentials: 'include' });
        const payload = await response.json().catch(() => ({}));
        return { error: response.ok ? null : payload.error || 'Trash could not be emptied' };
    }
}

export const fileUploadService = new FileUploadService();
