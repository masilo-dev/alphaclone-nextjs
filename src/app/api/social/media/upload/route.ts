import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * POST /api/social/media/upload
 * Upload image/video to Supabase Storage and record in media_assets table
 */
export async function POST(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tenantId = formData.get('tenantId') as string;
    const altText  = formData.get('altText') as string || '';
    const tags     = (formData.get('tags') as string || '').split(',').filter(Boolean);

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024;  // 10 MB
    const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

    if (file.size > maxSize) {
        return NextResponse.json({ error: `File too large. Max: ${maxSize / 1024 / 1024}MB` }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'bin';
    const storagePath = `media/${tenantId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const assetType = isVideo ? 'video' : file.type.includes('gif') ? 'gif' : 'image';

    const adminClient = createSupabaseAdminClient();

    const { error: uploadError } = await adminClient.storage
        .from('public-assets')
        .upload(storagePath, await file.arrayBuffer(), {
            contentType: file.type,
            upsert: false,
        });

    if (uploadError) {
        return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
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

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    return NextResponse.json({ success: true, asset });
}

export async function GET(req: NextRequest) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tenantId  = searchParams.get('tenantId');
    const assetType = searchParams.get('type');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    let query = supabase
        .from('media_assets')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

    if (assetType) query = query.eq('asset_type', assetType);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ assets: data });
}
