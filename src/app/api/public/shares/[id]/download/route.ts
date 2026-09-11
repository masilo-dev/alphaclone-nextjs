import { NextRequest, NextResponse } from 'next/server';
import { publicShareService } from '@/services/publicShareService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const share = await publicShareService.getShare(id);
        if (!share) {
            return NextResponse.json(
                { error: 'Share link has expired or does not exist' },
                { status: 404 }
            );
        }

        const supabase = createSupabaseAdminClient();
        const { data: fileData, error: downloadError } = await supabase.storage
            .from(share.bucket)
            .download(share.file_path);

        if (downloadError || !fileData) {
            console.error('Storage download error:', downloadError);
            return NextResponse.json(
                { error: 'Failed to retrieve file from storage' },
                { status: 404 }
            );
        }

        const buffer = await fileData.arrayBuffer();
        const headers = new Headers();
        
        // Set content type from blob
        headers.set('Content-Type', fileData.type || 'application/pdf');
        
        // Use query param ?download=true to force attachment download
        const url = new URL(req.url);
        const shouldDownload = url.searchParams.get('download') === 'true';
        const disposition = shouldDownload ? 'attachment' : 'inline';
        const filename = share.original_name || 'shared_document.pdf';
        
        headers.set(
            'Content-Disposition',
            `${disposition}; filename="${encodeURIComponent(filename)}"`
        );
        headers.set('Cache-Control', 'public, max-age=3600');

        return new NextResponse(buffer, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error('Error downloading share file:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
