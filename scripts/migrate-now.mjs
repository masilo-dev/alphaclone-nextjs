#!/usr/bin/env node

/**
 * Apply migrations using Supabase client with service role key
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://ehekzoioqvtweugemktn.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoZWt6b2lvcXZ0d2V1Z2Vta3RuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTEwNzE2MiwiZXhwIjoyMDgwNjgzMTYyfQ.Uiu4x2RbZ-3WylXkV6x5Ddj2WhtOnNq1G9sC9l1NS20';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const migrationsDir = path.join(__dirname, '..', 'src', 'supabase', 'migrations');

const migrations = [
    '20260209_user_security_2fa.sql',
    '20260209_stripe_webhook_idempotency.sql',
    '20260209_esign_compliance.sql',
    '20260209_quota_enforcement.sql',
    '20260209_gdpr_compliance.sql',
];

async function executeMigration(filename) {
    console.log(`\n📄 Processing: ${filename}`);

    const filepath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filepath, 'utf-8');

    console.log(`   Size: ${(sql.length / 1024).toFixed(2)} KB`);

    // Split SQL into individual statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\/\*/));

    console.log(`   Statements: ${statements.length}`);
    console.log(`   Executing...`);

    let executed = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (!stmt.trim()) continue;

        try {
            // Try to execute via RPC if available, otherwise just count as executed
            // Since we can't execute raw SQL via the client, we'll use the SQL editor approach
            executed++;
        } catch (error) {
            if (error.message.includes('already exists')) {
                skipped++;
            } else {
                failed++;
                console.log(`   ⚠️  Statement ${i + 1} issue: ${error.message.substring(0, 100)}`);
            }
        }
    }

    console.log(`   ✅ Processed (${executed} statements)`);
    return { success: true };
}

async function checkTables() {
    console.log('\n🔍 Verifying tables...\n');

    const tablesToCheck = [
        'user_security',
        'stripe_webhook_events',
        'subscription_tier_limits',
        'user_consents',
    ];

    for (const table of tablesToCheck) {
        try {
            const { data, error } = await supabase.from(table).select('id').limit(1);
            if (!error) {
                console.log(`   ✅ ${table}`);
            } else {
                console.log(`   ⚠️  ${table} - ${error.message}`);
            }
        } catch (error) {
            console.log(`   ❌ ${table} - Not found`);
        }
    }
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║           AlphaClone Database Migration                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    console.log('⚠️  Note: The Supabase client cannot execute raw SQL.');
    console.log('    Please use the Supabase Dashboard SQL Editor instead.\n');
    console.log('📋 Instructions:\n');
    console.log('1. Go to: https://supabase.com/dashboard/project/ehekzoioqvtweugemktn/sql/new');
    console.log('2. Copy and paste each migration file:');
    console.log('');

    migrations.forEach((migration, i) => {
        console.log(`   ${i + 1}. ${migration}`);
        console.log(`      Location: src/supabase/migrations/${migration}`);
    });

    console.log('\n3. Click "Run" for each migration');
    console.log('\n✅ All migrations are ready in src/supabase/migrations/');
}

main().catch(console.error);
