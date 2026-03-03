import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/**
 * Storage Proxy API
 * Prevents direct exposure of Supabase backend URLs by proxying storage requests.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ bucket: string; path: string[] }> }
) {
    const { bucket, path } = await params;
    const filePath = path.join('/');

    try {
        if (!bucket || !filePath) {
            console.error('Storage Proxy: Missing bucket or path', { bucket, filePath });
            return new NextResponse('Missing bucket or path', { status: 400 });
        }

        // Initialize Supabase server client (handles auth via cookies)
        const supabase = await createSupabaseServerClient();

        // Download the file from Supabase storage
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(filePath);

        if (error) {
            console.error(`Storage Proxy: Error fetching ${bucket}/${filePath}:`, error);
            // Return 404 for missing files, 500 for other errors
            const status = error.name === 'StorageApiError' && error.message.includes('not found') ? 404 : 500;
            return new NextResponse(error.message || 'Error fetching file', { status });
        }

        if (!data) {
            console.error(`Storage Proxy: No data returned for ${bucket}/${filePath}`);
            return new NextResponse('File data is empty', { status: 404 });
        }

        // Get file name for content disposition
        const filename = filePath.split('/').pop() || 'file';

        // Infer content type from data or fallback to common types based on extension
        let contentType = data.type || 'application/octet-stream';

        // Fix common content type issues
        if (contentType === 'application/octet-stream') {
            const ext = filename.split('.').pop()?.toLowerCase();
            const mimeTypes: Record<string, string> = {
                'pdf': 'application/pdf',
                'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'doc': 'application/msword',
                'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'xls': 'application/vnd.ms-excel',
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'webp': 'image/webp',
                'csv': 'text/csv'
            };
            if (ext && mimeTypes[ext]) {
                contentType = mimeTypes[ext];
            }
        }

        // Return the file content with the correct headers
        return new NextResponse(data, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                'Content-Disposition': `inline; filename="${filename}"`,
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (err: any) {
        console.error('Storage Proxy: Exception during request processing:', err);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
