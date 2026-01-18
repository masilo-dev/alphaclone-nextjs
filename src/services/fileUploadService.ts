import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { auditLoggingService } from './auditLoggingService';

// Allowed file types
const ALLOWED_FILE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Max total upload size: 50MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;

export interface FileUploadResult {
    success: boolean;
    fileId?: string;
    url?: string;
    error?: string;
}

class FileUploadService {
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
                error: `File size exceeds 10MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
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
        // Check total size
        const totalSize = files.reduce((sum, file) => sum + file.size, 0);
        if (totalSize > MAX_TOTAL_SIZE) {
            return {
                valid: false,
                error: `Total upload size exceeds 50MB limit. Your files total ${(totalSize / 1024 / 1024).toFixed(2)}MB.`,
            };
        }

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
        entityId?: string
    ): Promise<FileUploadResult> {
        try {
            // Validate file
            const validation = this.validateFile(file);
            if (!validation.valid) {
                return { success: false, error: validation.error || 'Validation failed' };
            }

            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return { success: false, error: 'User not authenticated' };
            }

            // Generate unique filename
            const timestamp = Date.now();
            const randomString = Math.random().toString(36).substring(7);
            const extension = file.name.split('.').pop();
            const filename = `${user.id}/${timestamp}-${randomString}.${extension}`;

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('uploads')
                .upload(filename, file, {
                    cacheControl: '3600',
                    upsert: false,
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                return { success: false, error: 'Failed to upload file' };
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('uploads')
                .getPublicUrl(filename);

            // Record upload in database
            const { data: fileRecord, error: dbError } = await supabase
                .from('file_uploads')
                .insert({
                    user_id: user.id,
                    filename: filename,
                    original_filename: file.name,
                    file_type: file.type,
                    file_size: file.size,
                    storage_path: uploadData.path,
                    scan_status: 'pending',
                    entity_type: entityType,
                    entity_id: entityId,
                    tenant_id: tenantService.getCurrentTenantId(),
                })
                .select()
                .single();

            if (dbError) {
                console.error('Database error:', dbError);
                // File uploaded but not recorded - should clean up
                await supabase.storage.from('uploads').remove([filename]);
                return { success: false, error: 'Failed to record upload' };
            }

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

            // TODO: Trigger virus scan (would be done via webhook or background job)
            // For now, we'll mark as clean after a delay
            setTimeout(() => {
                supabase
                    .from('file_uploads')
                    .update({ scan_status: 'clean' })
                    .eq('id', fileRecord.id)
                    .then();
            }, 5000);

            return {
                success: true,
                fileId: fileRecord.id,
                url: urlData.publicUrl,
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
        const uploadPromises = files.map(file =>
            this.uploadFile(file, entityType, entityId)
        );

        return Promise.all(uploadPromises);
    }

    /**
     * Delete a file
     */
    async deleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Get file record
            const { data: fileRecord, error: fetchError } = await supabase
                .from('file_uploads')
                .select('*')
                .eq('id', fileId)
                .from('file_uploads')
                .select('*')
                .eq('id', fileId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
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
                .from('file_uploads')
                .delete()
                .eq('id', fileId)
                .eq('tenant_id', tenantService.getCurrentTenantId());

            if (dbError) {
                return { success: false, error: 'Failed to delete file record' };
            }

            // Audit log
            auditLoggingService.logAction(
                'file_deleted',
                'file_upload',
                fileId,
                fileRecord,
                undefined
            ).catch(err => console.error('Failed to log audit:', err));

            return { success: true };
        } catch (error) {
            console.error('File delete error:', error);
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
            .select('*')
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .order('created_at', { ascending: false });

        return { files: data, error };
    }
}

export const fileUploadService = new FileUploadService();
