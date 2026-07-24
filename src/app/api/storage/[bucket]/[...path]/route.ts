import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/**
 * Storage Proxy API
 * Prevents direct exposure of Supabase backend URLs by proxying storage requests.
 * Private uploads must be tenant-prefixed: tenant/{tenantId}/...
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

        const supabase = await createSupabaseServerClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        // Private buckets require an authenticated tenant member and a tenant path.
        const privateBuckets = new Set(['uploads', 'documents', 'media', 'private']);
        if (privateBuckets.has(bucket) || filePath.startsWith('tenant/')) {
            if (!user) {
                return new NextResponse('Unauthorized', { status: 401 });
            }

            const hinted =
                request.headers.get('x-tenant-id') ||
                new URL(request.url).searchParams.get('tenantId') ||
                '';
            try {
                const { resolveActiveTenantForUser, assertTenantStoragePath } = await import(
                    '@/lib/tenant/platformTenant'
                );
                const resolved = await resolveActiveTenantForUser({
                    userId: user.id,
                    hintedTenantId: hinted || null,
                });
                assertTenantStoragePath({
                    filePath,
                    tenantId: resolved.tenantId,
                    allowLegacyUserPaths: true,
                    userId: user.id,
                });
            } catch (err: any) {
                const status = err?.code === 'TENANT_REQUIRED' ? 400 : 404;
                return new NextResponse('Not found', { status });
            }
        }

        const { data, error } = await supabase.storage.from(bucket).download(filePath);

        if (error) {
            console.error(`Storage Proxy: Error fetching ${bucket}/${filePath}:`, error);
            const msg = String(error.message || '').toLowerCase();
            const notFound =
                msg.includes('not found') ||
                msg.includes('does not exist') ||
                msg.includes('object not found') ||
                (error as { statusCode?: string | number }).statusCode === '404' ||
                (error as { statusCode?: string | number }).statusCode === 404;
            const status = notFound ? 404 : 500;
            return new NextResponse(status === 404 ? 'File not found' : 'Error fetching file', {
                status,
            });
        }

        if (!data) {
            console.error(`Storage Proxy: No data returned for ${bucket}/${filePath}`);
            return new NextResponse('File data is empty', { status: 404 });
        }

        const filename = filePath.split('/').pop() || 'file';

        let contentType = data.type || 'application/octet-stream';

        if (contentType === 'application/octet-stream') {
            const ext = filename.split('.').pop()?.toLowerCase();
            const mimeTypes: Record<string, string> = {
                pdf: 'application/pdf',
                docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                doc: 'application/msword',
                xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                xls: 'application/vnd.ms-excel',
                png: 'image/png',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                webp: 'image/webp',
                csv: 'text/csv',
            };
            if (ext && mimeTypes[ext]) {
                contentType = mimeTypes[ext];
            }
        }

        return new NextResponse(data, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'private, max-age=3600',
                'Content-Disposition': `inline; filename="${filename}"`,
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (err: any) {
        console.error('Storage Proxy: Exception during request processing:', err);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
