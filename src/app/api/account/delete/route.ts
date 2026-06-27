import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';
import { accountDeletionService } from '@/services/accountDeletionService';

export const dynamic = 'force-dynamic';

/** POST — user requests account deletion (30-day grace period). */
export async function POST() {
    try {
        const { user } = await requireAuthenticatedUser();
        const result = await accountDeletionService.scheduleAccountDeletion(user.id);

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to schedule deletion' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Account deletion scheduled. You will be signed out.',
        });
    } catch (err) {
        return routeErrorResponse(err);
    }
}

/** DELETE — user cancels a pending account deletion. */
export async function DELETE() {
    try {
        const { user } = await requireAuthenticatedUser();
        const result = await accountDeletionService.cancelAccountDeletion(user.id);

        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Failed to cancel deletion' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return routeErrorResponse(err);
    }
}

/** PUT — super-admin immediate purge (same as admin users DELETE). */
export async function PUT(req: NextRequest) {
    try {
        const { requirePlatformSuperAdmin } = await import('@/lib/apiAuth');
        const { user: actor } = await requirePlatformSuperAdmin();
        const userId = req.nextUrl.searchParams.get('userId')?.trim();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }
        if (userId === actor.id) {
            return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
        }

        const result = await accountDeletionService.purgeUserAccount(userId, 'admin_immediate_delete');
        if (!result.success) {
            return NextResponse.json({ error: result.error || 'Deletion failed' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        return routeErrorResponse(err);
    }
}
