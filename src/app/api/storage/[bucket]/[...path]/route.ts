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
    try {
        const { bucket, path } = await params;
        const filePath = path.join('/');

        if (!bucket || !filePath) {
            return new NextResponse('Missing bucket or path', { status: 400 });
        }

        // Initialize Supabase server client (handles auth via cookies)
        const supabase = await createSupabaseServerClient();

        // Download the file from Supabase storage
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(filePath);

        if (error) {
            console.error(`Storage proxy error for ${bucket}/${filePath}:`, error);
            return new NextResponse(error.message, { status: 404 });
        }

        if (!data) {
            return new NextResponse('File not found', { status: 404 });
        }

        // Get file metadata to set appropriate headers
        // We can't easily get metadata in one go with download, 
        // but we can infer content type from the blob
        const contentType = data.type || 'application/octet-stream';

        // Return the file content with the correct content type
        return new NextResponse(data, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
                'Content-Disposition': `inline; filename="${filePath.split('/').pop()}"`,
            },
        });
    } catch (err: any) {
        console.error('Storage proxy exception:', err);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
