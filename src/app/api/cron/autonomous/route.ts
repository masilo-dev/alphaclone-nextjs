import { NextRequest, NextResponse } from 'next/server';
import { autonomousRunnerService } from '@/services/autonomousRunnerService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/autonomous
 * Triggered by Vercel Cron or manual execution.
 * Runs autonomous business processes across all tenants.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const isCron = req.headers.get('x-vercel-cron') === 'true';
    const isInternal = authHeader === `Bearer ${process.env.CRON_SECRET || process.env.INTERNAL_API_KEY}`;

    if (!isCron && !isInternal && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting autonomous runner...');
    
    try {
        const result = await autonomousRunnerService.runOnce();
        
        if (result.success) {
            console.log(`[Cron] Autonomous runner completed successfully. Runs: ${result.runs.length}`);
            return NextResponse.json({ 
                success: true, 
                processedTenants: result.runs.length,
                timestamp: new Date().toISOString()
            });
        } else {
            console.error('[Cron] Autonomous runner failed:', result.error);
            return NextResponse.json({ 
                success: false, 
                error: result.error 
            }, { status: 500 });
        }
    } catch (err) {
        console.error('[Cron] Critical error in autonomous runner:', err);
        return NextResponse.json({ 
            success: false, 
            error: 'Internal server error' 
        }, { status: 500 });
    }
}
