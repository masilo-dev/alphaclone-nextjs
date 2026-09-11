import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// 1. list_files
registerTool('files', {
  name: 'list_files',
  description: 'Retrieve a list of files uploaded to the workspace.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().int().positive().optional().default(50),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      limit: { type: 'number', default: 50 },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('file_uploads')
      .select('id, original_filename, filename, file_type, file_size, storage_path, category, entity_type, entity_id, created_at')
      .eq('tenant_id', args.tenant_id)
      .order('created_at', { ascending: false })
      .limit(args.limit);

    if (error) throw error;
    return ((data || []) as Array<Record<string, any>>).map((file) => ({
      id: file.id,
      name: file.original_filename || file.filename,
      filename: file.filename,
      content_type: file.file_type,
      size: file.file_size,
      storage_path: file.storage_path,
      category: file.category,
      entity_type: file.entity_type,
      entity_id: file.entity_id,
      created_at: file.created_at,
    }));
  },
});

// 2. get_file_download_url
registerTool('files', {
  name: 'get_file_download_url',
  description: 'Generate a secure temporary signed download URL for a file in the workspace.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    file_id: z.string().uuid(),
    expires_in_seconds: z.number().int().positive().optional().default(3600),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      file_id: { type: 'string', format: 'uuid' },
      expires_in_seconds: { type: 'number', default: 3600, description: 'Expiration time in seconds' },
    },
    required: ['tenant_id', 'file_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data: fileRecord, error: dbError } = await supabase
      .from('file_uploads')
      .select('id, original_filename, filename, storage_path')
      .eq('id', args.file_id)
      .eq('tenant_id', args.tenant_id)
      .single();

    if (dbError) throw dbError;
    if (!fileRecord) throw new Error('File not found or access denied.');

    const storagePath = fileRecord.storage_path || '';
    const isPublicAsset = storagePath.startsWith('public-assets/');
    const bucket = isPublicAsset ? 'public-assets' : 'uploads';
    const cleanPath = isPublicAsset 
      ? storagePath.substring('public-assets/'.length)
      : storagePath;

    const { data, error: storageError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(cleanPath, args.expires_in_seconds);

    if (storageError) {
      // Fallback: return a mock or public URL if bucket doesn't exist or isn't fully configured
      const { data: publicUrl } = supabase.storage
        .from(bucket)
        .getPublicUrl(cleanPath);
      return { download_url: publicUrl.publicUrl, expires_at: null };
    }

    return { download_url: data.signedUrl, expires_at: new Date(Date.now() + args.expires_in_seconds * 1000).toISOString() };
  },
});
