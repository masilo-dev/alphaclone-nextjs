import { NextRequest, NextResponse } from 'next/server';
import { autonomousRunnerService } from '@/services/autonomousRunnerService';
<<<<<<< HEAD
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
=======
>>>>>>> origin/main

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/autonomous
<<<<<<< HEAD
 * Triggered by Railway Cron or manual execution.
 * Runs autonomous business processes across all tenants.
 */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  console.log('[Cron] Starting autonomous runner...');

  try {
    const result = await autonomousRunnerService.runOnce();

    if (result.success) {
      console.log(`[Cron] Autonomous runner completed successfully. Runs: ${result.runs.length}`);
      return NextResponse.json({
        success: true,
        processedTenants: result.runs.length,
        timestamp: new Date().toISOString(),
      });
    }

    console.error('[Cron] Autonomous runner failed:', result.error);
    return NextResponse.json(
      {
        success: false,
        error: result.error,
      },
      { status: 500 }
    );
  } catch (err) {
    console.error('[Cron] Critical error in autonomous runner:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
=======
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
>>>>>>> origin/main
}
