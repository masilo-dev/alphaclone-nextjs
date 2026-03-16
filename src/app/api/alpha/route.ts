import { NextResponse } from 'next/server';
import { alphaAgent } from '@/services/alpha/alphaAgent';

/**
 * POST /api/alpha
 * Start a new autonomous mission
 */
export async function POST(req: Request) {
    try {
        const { description } = await req.json();

        if (!description) {
            return NextResponse.json({ error: 'Mission description is required' }, { status: 400 });
        }

        const missionId = await alphaAgent.startMission(description);
        return NextResponse.json({ missionId, status: 'started' });
    } catch (error: any) {
        console.error('[Alpha API] Error starting mission:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * GET /api/alpha
 * Get all missions or a specific mission status
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    try {
        if (id) {
            const status = alphaAgent.getMissionStatus(id);
            if (!status) {
                return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
            }
            return NextResponse.json(status);
        }

        const missions = alphaAgent.getAllMissions();
        return NextResponse.json(missions);
    } catch (error: any) {
        console.error('[Alpha API] Error fetching mission status:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
