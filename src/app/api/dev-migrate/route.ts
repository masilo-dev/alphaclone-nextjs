import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('secret') !== 'run_migration_now') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createSupabaseAdminClient();
        
        // 1. Dry run query to verify if 'provider' column exists in 'lead_outreach_log'
        // We select column names from information_schema
        const { data: columnCheck, error: columnCheckError } = await supabase.rpc('exec_sql', {
            sql_query: "SELECT column_name FROM information_schema.columns WHERE table_name = 'lead_outreach_log' AND column_name = 'provider';"
        });

        if (columnCheckError) {
            console.log('exec_sql RPC check failed (which is normal if it is not exposed yet):', columnCheckError.message);
        }

        const columnExists = Array.isArray(columnCheck) && columnCheck.length > 0;
        
        if (columnExists) {
            return NextResponse.json({
                success: true,
                message: "Column 'provider' already exists in 'lead_outreach_log'. No migration needed.",
                checkResult: columnCheck
            });
        }

        // 2. Execute migration SQL
        const migrationSql = "ALTER TABLE lead_outreach_log ADD COLUMN IF NOT EXISTS provider TEXT; NOTIFY pgrst, 'reload schema';";
        
        // Try executing using exec_sql RPC
        const { error: execError } = await supabase.rpc('exec_sql', { sql_query: migrationSql });
        
        if (execError) {
            // Try via fallback REST query endpoint
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
            const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            
            if (!supabaseUrl || !serviceRoleKey) {
                throw new Error(`Migration SQL run failed: ${execError.message}. Also missing service role credentials in process.env.`);
            }
            
            const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': serviceRoleKey,
                    'Authorization': `Bearer ${serviceRoleKey}`,
                },
                body: JSON.stringify({ sql_query: migrationSql }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Failed to apply migration via RPC fallback: ${response.status} ${text}`);
            }
        }

        return NextResponse.json({
            success: true,
            message: "Successfully applied migration: added 'provider' column to 'lead_outreach_log'."
        });

    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message || String(err)
        }, { status: 500 });
    }
}
