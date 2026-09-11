import { after, NextResponse } from 'next/server';
import { alphaAgent } from '@/services/alpha/alphaAgent';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

const missionSchema = z.object({
    description: z.string().trim().min(3).max(4000),
    tenantId: z.string().uuid(),
});

export async function POST(req: Request) {
    try {
        const { description, tenantId } = missionSchema.parse(await req.json());
        const { user, membership } = await requireTenantAccess(tenantId);
        const actor = {
            id: user.id,
            name: user.email?.split('@')[0] || 'User',
            role: membership.role,
            tenantId,
        };

        const missionId = await alphaAgent.startMission(description, actor);
        after(async () => {
            try {
                await alphaAgent.executeMission(missionId, actor);
            } catch (error) {
                console.error(`[Alpha API] Mission ${missionId} failed:`, error);
            }
        });
        return NextResponse.json({ missionId, status: 'started' });
    } catch (error: any) {
        console.error('[Alpha API] Error starting mission:', error);
        return routeErrorResponse(error, 'Failed to start mission', req);
    }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const tenantId = searchParams.get('tenantId') || '';

    try {
        const { user } = await requireTenantAccess(tenantId);

        if (id) {
            const status = await alphaAgent.getMissionStatus(id, user.id, tenantId);
            if (!status) {
                return NextResponse.json({ error: 'Mission not found or unauthorized' }, { status: 404 });
            }
            return NextResponse.json(status);
        }

        const missions = await alphaAgent.getAllMissions(user.id, tenantId);
        return NextResponse.json(missions);
    } catch (error: any) {
        console.error('[Alpha API] Error fetching mission status:', error);
        return routeErrorResponse(error, 'Failed to load missions', req);
    }
}
