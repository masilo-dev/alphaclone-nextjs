#!/usr/bin/env node

/**
 * Setup Verification Script
 * Checks if all required environment variables are configured
 *
 * Usage:
 *   node scripts/verify-setup.js
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           AlphaClone Setup Verification                        ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Configuration checks
const checks = {
    required: [
        {
            name: 'Supabase URL',
            key: 'NEXT_PUBLIC_SUPABASE_URL',
            description: 'Get from: Supabase Dashboard → Settings → API',
            test: (val) => val && val.includes('supabase.co'),
        },
        {
            name: 'Supabase Anon Key',
            key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
            description: 'Get from: Supabase Dashboard → Settings → API',
            test: (val) => val && val.startsWith('eyJ'),
        },
        {
            name: 'Supabase Service Role Key',
            key: 'SUPABASE_SERVICE_ROLE_KEY',
            description: 'Get from: Supabase Dashboard → Settings → API',
            test: (val) => val && val.startsWith('eyJ'),
        },
        {
            name: 'Database URL',
            key: 'DATABASE_URL',
            alt: 'SUPABASE_DB_URL',
            description: 'Get from: Supabase Dashboard → Settings → Database',
            test: (val) => val && val.startsWith('postgresql://'),
        },
    ],
    recommended: [
        {
            name: 'Upstash Redis URL',
            key: 'UPSTASH_REDIS_REST_URL',
            description: 'For rate limiting. Sign up at: https://upstash.com/',
            category: 'Rate Limiting',
        },
        {
            name: 'Upstash Redis Token',
            key: 'UPSTASH_REDIS_REST_TOKEN',
            description: 'For rate limiting. Sign up at: https://upstash.com/',
            category: 'Rate Limiting',
        },
        {
            name: 'Sentry DSN',
            key: 'SENTRY_DSN',
            description: 'For error tracking. Sign up at: https://sentry.io/',
            category: 'Monitoring',
        },
        {
            name: 'Stripe Publishable Key',
            key: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
            description: 'For payments. Get from: https://dashboard.stripe.com/',
            category: 'Payments',
        },
        {
            name: 'Stripe Secret Key',
            key: 'STRIPE_SECRET_KEY',
            description: 'For payments. Get from: https://dashboard.stripe.com/',
            category: 'Payments',
        },
        {
            name: 'Stripe Webhook Secret',
            key: 'STRIPE_WEBHOOK_SECRET',
            description: 'For webhooks. Configure at: https://dashboard.stripe.com/webhooks',
            category: 'Payments',
        },
    ],
    optional: [
        {
            name: 'Google AI API Key',
            key: 'GOOGLE_AI_API_KEY',
            description: 'For AI features. Get from: https://ai.google.dev/',
        },
        {
            name: 'Daily.co API Key',
            key: 'DAILY_API_KEY',
            description: 'For video calls. Sign up at: https://daily.co/',
        },
        {
            name: 'Resend API Key',
            key: 'RESEND_API_KEY',
            description: 'For emails. Sign up at: https://resend.com/',
        },
    ],
};

let allRequiredPassed = true;
let recommendedCount = 0;
let recommendedTotal = checks.recommended.length;
let optionalCount = 0;
let optionalTotal = checks.optional.length;

// Check .env.local exists
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
    console.log('❌ .env.local file not found!\n');
    console.log('Create it by running:');
    console.log('  Windows: copy .env.example .env.local');
    console.log('  Mac/Linux: cp .env.example .env.local\n');
    process.exit(1);
} else {
    console.log('✅ .env.local file exists\n');
}

// Check required
console.log('═══ Required Configuration ═══\n');
checks.required.forEach((check) => {
    const value = process.env[check.key] || (check.alt ? process.env[check.alt] : null);
    const isValid = check.test ? check.test(value) : !!value;

    if (isValid) {
        console.log(`✅ ${check.name}`);
    } else {
        console.log(`❌ ${check.name}`);
        console.log(`   Variable: ${check.key}${check.alt ? ` or ${check.alt}` : ''}`);
        console.log(`   ${check.description}`);
        console.log('');
        allRequiredPassed = false;
    }
});

// Check recommended
console.log('\n═══ Recommended Configuration ═══\n');

const groupedRecommended = {};
checks.recommended.forEach((check) => {
    const category = check.category || 'Other';
    if (!groupedRecommended[category]) {
        groupedRecommended[category] = [];
    }
    groupedRecommended[category].push(check);
});

Object.keys(groupedRecommended).forEach((category) => {
    console.log(`${category}:`);
    groupedRecommended[category].forEach((check) => {
        const value = process.env[check.key];
        if (value && value !== 'your_' + check.key.toLowerCase()) {
            console.log(`  ✅ ${check.name}`);
            recommendedCount++;
        } else {
            console.log(`  ⚠️  ${check.name}`);
            console.log(`     Variable: ${check.key}`);
            console.log(`     ${check.description}`);
        }
    });
    console.log('');
});

// Check optional
console.log('═══ Optional Configuration ═══\n');
checks.optional.forEach((check) => {
    const value = process.env[check.key];
    if (value && value !== 'your_' + check.key.toLowerCase()) {
        console.log(`✅ ${check.name}`);
        optionalCount++;
    } else {
        console.log(`⚠️  ${check.name}`);
        console.log(`   Variable: ${check.key}`);
        console.log(`   ${check.description}`);
        console.log('');
    }
});

// Summary
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║                    Setup Summary                               ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

if (allRequiredPassed) {
    console.log('✅ All required configuration is set!');
} else {
    console.log('❌ Some required configuration is missing');
    console.log('   Fix the issues above before running the application');
}

console.log(`\n📊 Configuration Status:`);
console.log(`   Required: ${allRequiredPassed ? 'Complete' : 'Incomplete'}`);
console.log(`   Recommended: ${recommendedCount}/${recommendedTotal} (${Math.round((recommendedCount / recommendedTotal) * 100)}%)`);
console.log(`   Optional: ${optionalCount}/${optionalTotal} (${Math.round((optionalCount / optionalTotal) * 100)}%)`);

console.log('\n📚 Next Steps:');

if (!allRequiredPassed) {
    console.log('   1. Update .env.local with required variables');
    console.log('   2. Run this script again to verify');
    console.log('   3. Run migrations: npm run migrate');
    console.log('   4. Start development: npm run dev');
} else {
    console.log('   1. Run migrations: npm run migrate');
    console.log('   2. Start development: npm run dev');
    console.log('   3. Configure recommended services for production');
}

console.log('\n💡 Tips:');
console.log('   - Never commit .env.local to git');
console.log('   - Use different values for dev/staging/production');
console.log('   - Keep your service role key secure');
console.log('   - Enable rate limiting before going to production');
console.log('   - Set up monitoring (Sentry) for production');

console.log('\n📖 Documentation:');
console.log('   - Quick Start: QUICK_START.md');
console.log('   - Migration Guide: MIGRATION_GUIDE.md');
console.log('   - Environment Variables: .env.example');

console.log('');

// Exit code
if (allRequiredPassed) {
    process.exit(0);
} else {
    process.exit(1);
}
