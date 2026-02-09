#!/usr/bin/env node

/**
 * Database Migration Application Script
 * Applies all pending migrations to Supabase PostgreSQL database
 *
 * Usage:
 *   npm run migrate
 *
 * Or with custom connection string:
 *   DATABASE_URL="postgresql://..." node scripts/apply-migrations.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Get directory paths
const projectRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(projectRoot, 'src', 'supabase', 'migrations');

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(projectRoot, '.env.local') });

// Get database connection string
const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

// Validate environment
if (!DATABASE_URL) {
    console.error('❌ Error: Missing DATABASE_URL environment variable');
    console.error('');
    console.error('Options:');
    console.error('  1. Set DATABASE_URL in .env.local');
    console.error('  2. Pass as environment variable: DATABASE_URL="postgresql://..." npm run migrate');
    console.error('');
    console.error('Get connection string from: https://supabase.com/dashboard → Settings → Database');
    console.error('Use the "Connection string" under "Direct connection"');
    console.error('');
    process.exit(1);
}

// Migration files in order
const migrations = [
    '20260209_user_security_2fa.sql',
    '20260209_stripe_webhook_idempotency.sql',
    '20260209_esign_compliance.sql',
    '20260209_quota_enforcement.sql',
    '20260209_gdpr_compliance.sql',
];

/**
 * Execute a SQL migration file
 */
async function executeMigration(client, filename) {
    const startTime = Date.now();
    const filepath = path.join(migrationsDir, filename);

    console.log(`\n📄 Applying migration: ${filename}`);

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

        // Execute the entire migration file
        // PostgreSQL can handle multiple statements in one query
        await client.query(sql);

        const duration = Date.now() - startTime;
        console.log(`   ✅ Success!`);
        console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);

        return {
            filename,
            success: true,
            duration,
        };
    } catch (error) {
        const duration = Date.now() - startTime;

        // Check if error is because objects already exist
        if (
            error.message.includes('already exists') ||
            error.message.includes('duplicate key')
        ) {
            console.log(`   ⚠️  Already applied (objects exist)`);
            return {
                filename,
                success: true,
                duration,
                skipped: true,
            };
        }

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
 * Verify migrations were applied successfully
 */
async function verifyMigrations(client) {
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

    const { rows } = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `, [tables]);

    const foundTables = rows.map(r => r.table_name);

    tables.forEach(table => {
        if (foundTables.includes(table)) {
            console.log(`  ✅ ${table}`);
            foundCount++;
        } else {
            console.log(`  ❌ ${table} - not found`);
        }
    });

    console.log(`\nFound ${foundCount}/${tables.length} tables`);

    // Check subscription tiers
    if (foundTables.includes('subscription_tier_limits')) {
        console.log('\nChecking subscription tiers...');
        const { rows: tiers } = await client.query(`
            SELECT tier_name, users_limit, projects_limit, storage_mb_limit
            FROM subscription_tier_limits
            ORDER BY users_limit
        `);

        if (tiers.length > 0) {
            console.log('  ✅ Subscription tiers:');
            tiers.forEach(tier => {
                const storage = tier.storage_mb_limit === 999999 ? '∞' : `${tier.storage_mb_limit}MB`;
                console.log(`     - ${tier.tier_name}: ${tier.users_limit} users, ${tier.projects_limit} projects, ${storage}`);
            });
        } else {
            console.log('  ⚠️  No subscription tiers found');
        }
    }

    // Check functions
    console.log('\nChecking functions...');
    const { rows: functions } = await client.query(`
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
        AND routine_name IN (
            'track_usage',
            'can_perform_action',
            'record_consent',
            'request_data_export',
            'request_data_deletion',
            'anonymize_user_data'
        )
        ORDER BY routine_name
    `);

    console.log(`  ✅ Found ${functions.length} functions:`);
    functions.forEach(fn => {
        console.log(`     - ${fn.routine_name}()`);
    });
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
    console.log(`📝 Migrations to apply: ${migrations.length}`);
    console.log('');

    // Create PostgreSQL client
    console.log('🔌 Connecting to database...');
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: {
            rejectUnauthorized: false, // Required for Supabase
        },
    });

    try {
        await client.connect();
        console.log('✅ Connected successfully\n');

        // Apply migrations
        const results = [];

        for (const migration of migrations) {
            const result = await executeMigration(client, migration);
            results.push(result);

            // Continue even if migration was already applied
            if (!result.success && !result.skipped) {
                console.error('\n⚠️  Migration had errors. Continuing with remaining migrations...');
            }
        }

        // Summary
        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                      Migration Summary                         ║');
        console.log('╚════════════════════════════════════════════════════════════════╝\n');

        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const skipped = results.filter(r => r.skipped).length;
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

        console.log(`✅ Successful: ${successful}/${migrations.length}`);
        console.log(`⚠️  Skipped: ${skipped}/${migrations.length}`);
        console.log(`❌ Failed: ${failed}/${migrations.length}`);
        console.log(`⏱️  Total time: ${(totalDuration / 1000).toFixed(2)}s`);
        console.log('');

        // Show failed migrations
        if (failed > 0) {
            console.log('Failed migrations:');
            results.filter(r => !r.success && !r.skipped).forEach(r => {
                console.log(`  - ${r.filename}: ${r.error}`);
            });
            console.log('');
        }

        // Verify migrations
        await verifyMigrations(client);

        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                    🎉 All Done!                                ║');
        console.log('╚════════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('Next steps:');
        console.log('  1. Review the verification results above');
        console.log('  2. Test your application with the new migrations');
        console.log('  3. Configure environment variables for new features:');
        console.log('     - UPSTASH_REDIS_REST_URL');
        console.log('     - UPSTASH_REDIS_REST_TOKEN');
        console.log('     - SENTRY_DSN');
        console.log('     - SENTRY_AUTH_TOKEN');
        console.log('  4. Deploy to production when ready');
        console.log('');

        if (failed === 0) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    } catch (error) {
        console.error('\n💥 Fatal error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

// Run migrations
main();
