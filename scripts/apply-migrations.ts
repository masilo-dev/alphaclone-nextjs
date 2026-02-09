#!/usr/bin/env tsx

/**
 * Database Migration Application Script
 * Applies all pending migrations to Supabase database
 *
 * Usage:
 *   npm run migrate
 *
 * Or with custom environment:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx npm run migrate
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(projectRoot, 'src', 'supabase', 'migrations');

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing required environment variables');
    console.error('');
    console.error('Required:');
    console.error('  - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    console.error('');
    console.error('Get these from: https://supabase.com/dashboard → Settings → API');
    process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

// Migration files in order
const migrations = [
    '20260209_user_security_2fa.sql',
    '20260209_stripe_webhook_idempotency.sql',
    '20260209_esign_compliance.sql',
    '20260209_quota_enforcement.sql',
    '20260209_gdpr_compliance.sql',
];

interface MigrationResult {
    filename: string;
    success: boolean;
    error?: string;
    duration: number;
}

/**
 * Execute a SQL migration file
 */
async function executeMigration(filename: string): Promise<MigrationResult> {
    const startTime = Date.now();
    const filepath = path.join(migrationsDir, filename);

    console.log(`\n📄 Applying migration: ${filename}`);
    console.log(`   Path: ${filepath}`);

    try {
        // Read migration file
        if (!fs.existsSync(filepath)) {
            throw new Error(`Migration file not found: ${filepath}`);
        }

        const sql = fs.readFileSync(filepath, 'utf-8');

        if (!sql.trim()) {
            throw new Error('Migration file is empty');
        }

        console.log(`   Size: ${(sql.length / 1024).toFixed(2)} KB`);
        console.log(`   Executing...`);

        // Execute migration using raw SQL
        // Note: Supabase client doesn't have a direct SQL execution method,
        // so we use the rpc method to execute via a function, or we split
        // the SQL into individual statements

        // Split SQL into individual statements
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        let executedCount = 0;
        let skippedCount = 0;

        for (const statement of statements) {
            // Skip comments and empty statements
            if (!statement || statement.startsWith('--')) {
                continue;
            }

            try {
                // Execute each statement
                const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

                // If exec_sql function doesn't exist, we need to use a different approach
                // Try using the postgres REST API directly
                if (error && error.message.includes('function "exec_sql" does not exist')) {
                    // Fall back to using fetch API with proper auth
                    if (!SUPABASE_SERVICE_ROLE_KEY) {
                        throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for direct API access');
                    }
                    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'apikey': SUPABASE_SERVICE_ROLE_KEY,
                            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                        },
                        body: JSON.stringify({ query: statement }),
                    });

                    if (!response.ok) {
                        // If this also fails, it means we need to use a different method
                        // For now, we'll log a warning and provide instructions
                        throw new Error(`Cannot execute SQL programmatically. Please use Supabase Dashboard or psql.`);
                    }
                } else if (error) {
                    // Check if error is because object already exists
                    if (
                        error.message.includes('already exists') ||
                        error.message.includes('duplicate key')
                    ) {
                        console.log(`   ⚠️  Skipped (already exists)`);
                        skippedCount++;
                        continue;
                    }
                    throw error;
                }

                executedCount++;
            } catch (err: any) {
                // Check if it's a "already exists" error
                if (
                    err.message.includes('already exists') ||
                    err.message.includes('duplicate key')
                ) {
                    skippedCount++;
                    continue;
                }
                throw err;
            }
        }

        const duration = Date.now() - startTime;
        console.log(`   ✅ Success! (${executedCount} statements executed, ${skippedCount} skipped)`);
        console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

        return {
            filename,
            success: true,
            duration,
        };
    } catch (error: any) {
        const duration = Date.now() - startTime;
        console.error(`   ❌ Failed: ${error.message}`);

        return {
            filename,
            success: false,
            error: error.message,
            duration,
        };
    }
}

/**
 * Verify migration was applied successfully
 */
async function verifyMigrations(): Promise<void> {
    console.log('\n🔍 Verifying migrations...\n');

    // Check for tables
    const tables = [
        'user_security',
        'stripe_webhook_events',
        'stripe_payments',
        'webhook_failures',
        'contract_audit_trail',
        'esignature_consents',
        'signature_events',
        'signature_certificates',
        'contract_versions',
        'subscription_tier_limits',
        'tenant_usage_tracking',
        'usage_events',
        'quota_alerts',
        'user_consents',
        'data_export_requests',
        'data_deletion_requests',
        'data_processing_log',
        'privacy_policy_versions',
        'terms_of_service_versions',
    ];

    console.log('Checking tables...');
    let foundCount = 0;

    for (const table of tables) {
        try {
            const { error } = await supabase.from(table).select('id').limit(1);
            if (!error) {
                console.log(`  ✅ ${table}`);
                foundCount++;
            } else {
                console.log(`  ❌ ${table} - ${error.message}`);
            }
        } catch (error: any) {
            console.log(`  ❌ ${table} - ${error.message}`);
        }
    }

    console.log(`\nFound ${foundCount}/${tables.length} tables`);

    // Check subscription tiers
    console.log('\nChecking subscription tiers...');
    const { data: tiers, error: tiersError } = await supabase
        .from('subscription_tier_limits')
        .select('tier_name, users_limit, projects_limit')
        .order('users_limit');

    if (tiersError) {
        console.log('  ❌ Could not fetch subscription tiers:', tiersError.message);
    } else if (tiers && tiers.length > 0) {
        console.log('  ✅ Subscription tiers:');
        tiers.forEach(tier => {
            console.log(`     - ${tier.tier_name}: ${tier.users_limit} users, ${tier.projects_limit} projects`);
        });
    } else {
        console.log('  ⚠️  No subscription tiers found');
    }
}

/**
 * Main execution
 */
async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║         AlphaClone Database Migration Application              ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📍 Project: ${projectRoot}`);
    console.log(`📁 Migrations: ${migrationsDir}`);
    console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
    console.log(`📝 Migrations to apply: ${migrations.length}`);
    console.log('');

    // Warning about service role key
    console.log('⚠️  Using SERVICE ROLE KEY - bypasses Row Level Security');
    console.log('   Make sure this key is kept secure and never committed to git');
    console.log('');

    // Apply migrations
    const results: MigrationResult[] = [];

    for (const migration of migrations) {
        const result = await executeMigration(migration);
        results.push(result);

        // Stop if migration failed
        if (!result.success) {
            console.error('\n❌ Migration failed. Stopping here.');
            console.error('   Fix the error and run the script again.');
            console.error('   Successfully applied migrations will be skipped automatically.');
            break;
        }
    }

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                      Migration Summary                         ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`✅ Successful: ${successful}/${migrations.length}`);
    console.log(`❌ Failed: ${failed}/${migrations.length}`);
    console.log(`⏱️  Total time: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log('');

    // Show failed migrations
    if (failed > 0) {
        console.log('Failed migrations:');
        results.filter(r => !r.success).forEach(r => {
            console.log(`  - ${r.filename}: ${r.error}`);
        });
        console.log('');
    }

    // Verify migrations
    if (successful === migrations.length) {
        await verifyMigrations();

        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                    🎉 All Done!                                ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Review the verification results above');
        console.log('  2. Test your application with the new migrations');
        console.log('  3. Configure environment variables for new features');
        console.log('  4. Deploy to production when ready');
        console.log('');
    } else {
        console.log('⚠️  Some migrations failed. Please fix errors and try again.');
        process.exit(1);
    }
}

// Run migrations
main().catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
});
