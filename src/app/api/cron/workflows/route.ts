import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        console.log('Workflow sweep cron triggered');

        // Call the Supabase Edge Function to process the queue
        // Using the service role key or a specific secret to bypass JWT in production if needed,
        // but here we utilize the Edge Function's internal capability.

        const edgeFunctionUrl = `${ENV.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/workflow-engine`;

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({}) // Empty body triggers 'Sweeper' mode
        });

        const result = await response.json();

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            result
        });

    } catch (error) {
        console.error('Error in workflow cron:', error);
        return NextResponse.json({
            success: false,
            error: String(error)
        }, { status: 500 });
    }
}
