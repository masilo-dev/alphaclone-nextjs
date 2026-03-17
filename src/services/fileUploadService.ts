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
    'application/x-zip-compressed'
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
            const randomString = Math.random().toString(36).substring(7);
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
            // Soft delete in database
            const { error: dbError } = await supabase
                .from('file_uploads')
                .update({ deleted_at: new Date().toISOString() })
                .eq('id', fileId);

            if (dbError) {
                return { success: false, error: 'Failed to move file to trash' };
            }

            // Audit log
            auditLoggingService.logAction(
                'file_soft_deleted',
                'file_upload',
                fileId,
                undefined,
                undefined
            ).catch(err => console.error('Failed to log audit:', err));

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
            const { error: dbError } = await supabase
                .from('file_uploads')
                .update({ deleted_at: null })
                .eq('id', fileId);

            if (dbError) {
                return { success: false, error: 'Failed to restore file' };
            }

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
            // Get file record
            const { data: fileRecord, error: fetchError } = await supabase
                .from('file_uploads')
                .select('*')
                .eq('id', fileId)
                .single();

            if (fetchError || !fileRecord) {
                return { success: false, error: 'File not found' };
            }

            // Delete from storage
            const { error: storageError } = await supabase.storage
                .from('uploads')
                .remove([fileRecord.storage_path]);

            if (storageError) {
                console.error('Storage delete error:', storageError);
            }

            // Delete from database
            const { error: dbError } = await supabase
                .from('file_uploads')
                .delete()
                .eq('id', fileId);

            if (dbError) {
                return { success: false, error: 'Failed to delete file record' };
            }

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
        // First get all trashed files to remove from storage
        const { data: trashedFiles } = await supabase
            .from('file_uploads')
            .select('storage_path')
            .eq('tenant_id', tenantId)
            .not('deleted_at', 'is', null);

        // Remove from storage
        if (trashedFiles && trashedFiles.length > 0) {
            const paths = trashedFiles.map((f: { storage_path: string }) => f.storage_path).filter(Boolean);
            if (paths.length > 0) {
                await supabase.storage.from('uploads').remove(paths);
            }
        }

        // Delete records from database
        const { error } = await supabase
            .from('file_uploads')
            .delete()
            .eq('tenant_id', tenantId)
            .not('deleted_at', 'is', null);

        return { error };
    }
}

export const fileUploadService = new FileUploadService();
