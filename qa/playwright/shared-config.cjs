/**
 * Shared QA configuration for all AlphaClone E2E audit scripts.
 */
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(process.cwd(), '.env.production.local') });

module.exports = {
  BASE_URL: 'https://alphaclonesystems.com',
  TENANT_EMAIL: 'bonnie@alphaclonesystems.com',
  SALES_EMAIL: 'sales@alphaclonesystems.com',
  TENANT_ID: '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4',
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // All viewports to test
  VIEWPORTS: [
    { name: 'desktop-1920', width: 1920, height: 1080 },
    { name: 'desktop-1440', width: 1440, height: 900 },
    { name: 'desktop-1366', width: 1366, height: 768 },
    { name: 'laptop-1280', width: 1280, height: 800 },
    { name: 'laptop-1024', width: 1024, height: 768 },
    { name: 'tablet-768',  width: 768,  height: 1024 },
    { name: 'mobile-430',  width: 430,  height: 932 },
    { name: 'mobile-412',  width: 412,  height: 915 },
    { name: 'mobile-390',  width: 390,  height: 844 },
    { name: 'mobile-375',  width: 375,  height: 812 },
    { name: 'mobile-360',  width: 360,  height: 800 },
    { name: 'mobile-320',  width: 320,  height: 568 },
  ],

  // Navigation must show hamburger ONLY below this width
  MOBILE_BREAKPOINT: 768,
  // Laptop users (>=1024) must NEVER see hamburger menu
  LAPTOP_MIN_WIDTH: 1024,

  // Launch options
  CHROMIUM_ARGS: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],

  // Severity helpers
  P0: 'P0_RELEASE_BLOCKER',
  P1: 'P1_HIGH',
  P2: 'P2_MEDIUM',
  P3: 'P3_LOW',
};
