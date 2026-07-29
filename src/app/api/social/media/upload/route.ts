import { NextRequest, NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { routeErrorResponse, requireTenantAccess } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
<<<<<<< HEAD
import { z } from 'zod';
=======
>>>>>>> origin/main

/**
 * POST /api/social/media/upload
 * Upload image/video to Supabase Storage and record in media_assets table
 */
export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const tenantId = formData.get('tenantId') as string;
        const altText  = formData.get('altText') as string || '';
        const tags     = (formData.get('tags') as string || '').split(',').filter(Boolean);

        if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
<<<<<<< HEAD
        const { user } = await requireTenantAccess(tenantId, req);

        const allowedTypes = new Map([
            ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/gif', 'gif'],
            ['video/mp4', 'mp4'], ['video/webm', 'webm'], ['video/quicktime', 'mov'],
        ]);
        const safeExtension = allowedTypes.get(file.type);
        if (!safeExtension) return NextResponse.json({ error: 'Unsupported media type' }, { status: 415 });

        const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
        const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB
        const isVideo = file.type.startsWith('video/');
        const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

        if (file.size > maxSize) {
            return NextResponse.json({ error: `File too large. Max: ${maxSize / 1024 / 1024}MB` }, { status: 400 });
        }

        const storagePath = `media/${tenantId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${safeExtension}`;
=======
        const { user } = await requireTenantAccess(tenantId);

        const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
        const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB
        const isVideo = file.type.startsWith('video/');
        const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

        if (file.size > maxSize) {
            return NextResponse.json({ error: `File too large. Max: ${maxSize / 1024 / 1024}MB` }, { status: 400 });
        }

        const ext = file.name.split('.').pop() || 'bin';
        const storagePath = `media/${tenantId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
>>>>>>> origin/main
        const assetType = isVideo ? 'video' : file.type.includes('gif') ? 'gif' : 'image';

        const adminClient = createSupabaseAdminClient();

        const { error: uploadError } = await adminClient.storage
            .from('public-assets')
            .upload(storagePath, await file.arrayBuffer(), {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error('[social/media/upload] storage:', uploadError);
            return NextResponse.json({ error: 'Upload failed', code: 'STORAGE_UPLOAD_FAILED' }, { status: 500 });
        }

        const { data: urlData } = adminClient.storage.from('public-assets').getPublicUrl(storagePath);
        const publicUrl = urlData.publicUrl;

        const { data: asset, error: dbErr } = await adminClient
            .from('media_assets')
            .insert({
                tenant_id: tenantId,
                user_id: user.id,
                file_name: file.name,
                file_type: file.type,
                asset_type: assetType,
                storage_path: storagePath,
                public_url: publicUrl,
                file_size_bytes: file.size,
                alt_text: altText,
                tags,
            })
            .select()
            .single();

        if (dbErr) {
            console.error('[social/media/upload] media_assets insert:', dbErr);
<<<<<<< HEAD
            await adminClient.storage.from('public-assets').remove([storagePath]);
=======
>>>>>>> origin/main
            return NextResponse.json({ error: 'Failed to save media record', code: 'MEDIA_DB_ERROR' }, { status: 500 });
        }

        return NextResponse.json({ success: true, asset });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to upload media', req);
    }
<<<<<<< HEAD
}

export async function DELETE(req: NextRequest) {
    try {
        const tenantId = req.nextUrl.searchParams.get('tenantId') || '';
        const assetId = req.nextUrl.searchParams.get('assetId') || '';
        if (!z.string().uuid().safeParse(tenantId).success || !z.string().uuid().safeParse(assetId).success) {
            return NextResponse.json({ error: 'Valid tenantId and assetId required' }, { status: 400 });
        }
        const { admin } = await requireTenantAccess(tenantId, req);
        const { data: asset, error: readError } = await admin.from('media_assets').select('id, storage_path').eq('tenant_id', tenantId).eq('id', assetId).maybeSingle();
        if (readError) throw readError;
        if (!asset) return NextResponse.json({ error: 'Media asset not found' }, { status: 404 });
        if (asset.storage_path) {
            const { error: storageError } = await admin.storage.from('public-assets').remove([asset.storage_path]);
            if (storageError) throw storageError;
        }
        const { error: deleteError } = await admin.from('media_assets').delete().eq('tenant_id', tenantId).eq('id', assetId);
        if (deleteError) throw deleteError;
        return NextResponse.json({ success: true });
    } catch (error) {
        return routeErrorResponse(error, 'Media asset could not be deleted', req);
    }
=======
>>>>>>> origin/main
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId  = searchParams.get('tenantId');
        const assetType = searchParams.get('type');
        if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

<<<<<<< HEAD
        const { supabase } = await requireTenantAccess(tenantId, req);
=======
        const { supabase } = await requireTenantAccess(tenantId);
>>>>>>> origin/main
        let query = supabase
            .from('media_assets')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (assetType) query = query.eq('asset_type', assetType);

        const { data, error } = await query;
        if (error) return clientErrorResponse(error, { request: req, scope: 'social/media/upload' });
        return NextResponse.json({ assets: data });
    } catch (error) {
        return routeErrorResponse(error, 'Failed to fetch media', req);
    }
}
