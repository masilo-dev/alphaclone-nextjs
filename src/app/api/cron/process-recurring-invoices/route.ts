import { NextRequest, NextResponse } from 'next/server';
import { cronService } from '@/services/cronService';

/**
 * API Endpoint for Processing Recurring Invoices
 * 
 * This endpoint should be called by a cron job scheduler (e.g., Vercel Cron, GitHub Actions)
 * on a daily basis to automatically generate recurring invoices.
 * 
 * Example Vercel Cron configuration in vercel.json:
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/process-recurring-invoices",
 *       "schedule": "0 0 * * *"
 *     }
 *   ]
 * }
 */

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    console.log('Starting recurring invoice processing...');
    
    const result = await cronService.processRecurringInvoices();
    
    console.log(`Recurring invoice processing complete: ${result.processed} invoices generated`);
    
    if (result.errors.length > 0) {
      console.error('Errors encountered:', result.errors);
    }

    return NextResponse.json({
      success: result.success,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cron job execution failed:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
