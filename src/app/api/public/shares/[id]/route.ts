import { NextRequest, NextResponse } from 'next/server';
import { publicShareService } from '@/services/publicShareService';

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

        return NextResponse.json({
            id: share.id,
            originalName: share.original_name,
            expiresAt: share.expires_at,
            createdAt: share.created_at,
        });
    } catch (error) {
        console.error('Error fetching share metadata:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
