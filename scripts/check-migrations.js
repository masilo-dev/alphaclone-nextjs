#!/usr/bin/env node

/**
 * Check if database migrations have been applied
 * Used for CI/CD verification
 *
 * Usage:
 *   npm run migrate:check
 *
 * Exit codes:
 *   0 - All migrations applied successfully
 *   1 - Some migrations are missing
 *   2 - Cannot connect to database
 */

const { Client } = require('pg');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(2);
}

// Expected tables from migrations
const EXPECTED_TABLES = [
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

// Expected functions from migrations
const EXPECTED_FUNCTIONS = [
    'track_usage',
    'can_perform_action',
    'get_tenant_usage_summary',
    'record_consent',
    'request_data_export',
    'request_data_deletion',
    'anonymize_user_data',
];

async function checkMigrations() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log('🔍 Checking migration status...\n');

        // Check tables
        const { rows: tables } = await client.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = ANY($1::text[])
        `, [EXPECTED_TABLES]);

        const foundTables = tables.map(r => r.table_name);
        const missingTables = EXPECTED_TABLES.filter(t => !foundTables.includes(t));

        console.log(`Tables: ${foundTables.length}/${EXPECTED_TABLES.length}`);
        if (missingTables.length > 0) {
            console.log('❌ Missing tables:');
            missingTables.forEach(t => console.log(`   - ${t}`));
        } else {
            console.log('✅ All tables present');
        }

        // Check functions
        const { rows: functions } = await client.query(`
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_schema = 'public'
            AND routine_name = ANY($1::text[])
        `, [EXPECTED_FUNCTIONS]);

        const foundFunctions = functions.map(r => r.routine_name);
        const missingFunctions = EXPECTED_FUNCTIONS.filter(f => !foundFunctions.includes(f));

        console.log(`\nFunctions: ${foundFunctions.length}/${EXPECTED_FUNCTIONS.length}`);
        if (missingFunctions.length > 0) {
            console.log('❌ Missing functions:');
            missingFunctions.forEach(f => console.log(`   - ${f}()`));
        } else {
            console.log('✅ All functions present');
        }

        // Check subscription tiers
        const { rows: tiers } = await client.query(`
            SELECT COUNT(*) as count FROM subscription_tier_limits
        `);

        const tierCount = parseInt(tiers[0].count);
        console.log(`\nSubscription Tiers: ${tierCount}/4`);
        if (tierCount < 4) {
            console.log('⚠️  Expected 4 tiers (free, starter, pro, enterprise)');
        } else {
            console.log('✅ All tiers present');
        }

        // Final status
        console.log('\n' + '='.repeat(50));
        if (missingTables.length === 0 && missingFunctions.length === 0 && tierCount >= 4) {
            console.log('✅ All migrations applied successfully');
            process.exit(0);
        } else {
            console.log('❌ Some migrations are missing');
            console.log('\nRun: npm run migrate');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(2);
    } finally {
        await client.end();
    }
}

checkMigrations();
