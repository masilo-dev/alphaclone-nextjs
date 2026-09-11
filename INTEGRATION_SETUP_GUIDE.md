
# AlphaClone — Integration Setup Guide

> Complete step-by-step guide for setting up **Twilio (SMS)**, **Facebook**, and **Zoho** integrations on the AlphaClone Business OS platform.

---

## Table of Contents

1. [Twilio (SMS Campaigns)](#1-twilio-sms-campaigns)
2. [Facebook Integration](#2-facebook-integration)
3. [Zoho Integration](#3-zoho-integration)
4. [Environment Variables Summary](#4-environment-variables-summary)
5. [Per-Client / Multi-Tenant Architecture](#5-per-client--multi-tenant-architecture)

---

## 1. Twilio (SMS Campaigns)

### How It Works
Twilio is used as the SMS backend. Your platform calls the Twilio REST API directly (no SDK needed). Each SMS is sent via `https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`.

### Step 1: Create a Twilio Account
1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up and verify your email + phone number
3. Complete the onboarding wizard

### Step 2: Get Your API Credentials
1. Go to [Twilio Console](https://console.twilio.com)
2. Copy your **Account SID** (starts with `AC...`)
3. Copy your **Auth Token**
4. Go to **Phone Numbers → Manage → Buy a Number** and purchase a number
5. Copy the phone number (format: `+1XXXXXXXXXX`)

### Step 3: Add to Environment Variables
Add these to your `.env` file (and Vercel Environment Variables):

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
NEXT_PUBLIC_TWILIO_CONFIGURED=true
```

### Step 4: Business Dashboard — How Users Send SMS
1. Log into the Business Dashboard
2. Click **"SMS Campaigns"** in the sidebar (under Marketing & Outreach)
3. Click **"New Campaign"**
4. Fill in:
   - **Campaign Name** — e.g., "March Promo Blast"
   - **Message Body** — The SMS text to send
   - **Recipient Source** — Choose `leads`, `clients`, or `manual`
   - **From Number** — Leave blank to use default, or enter a specific Twilio number
5. Click **"Launch Campaign"**
6. The platform will:
   - Fetch all matching recipients from Supabase
   - Deduplicate phone numbers
   - Send each SMS via the Twilio REST API with a 50ms delay between messages
   - Log every message (success/fail) to the `sms_messages` table
   - Update campaign stats in `sms_campaigns` table

### Per-Client Twilio (Future Enhancement)
Currently, Twilio uses a single platform-wide set of credentials. To enable per-client Twilio accounts:

1. **Database**: Add columns to the `tenants` table:
   ```sql
   ALTER TABLE tenants ADD COLUMN twilio_account_sid TEXT;
   ALTER TABLE tenants ADD COLUMN twilio_auth_token TEXT;
   ALTER TABLE tenants ADD COLUMN twilio_phone_number TEXT;
   ```

2. **Settings UI**: Add Twilio fields to the Settings page so each tenant can enter their own credentials.

3. **API Route**: Modify `/api/sms/send/route.ts` to check tenant-level credentials first, falling back to platform defaults:
   ```typescript
   const accountSid = tenant.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
   const authToken = tenant.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
   const fromNumber = tenant.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;
   ```

> **Note**: Twilio does NOT use OAuth. It uses API Key + Auth Token authentication. Each client would need their own Twilio account and would paste their credentials into Settings.

---

## 2. Facebook Integration

### How It Works
Facebook uses **OAuth 2.0** for authentication. Users connect their Facebook account, which gives the platform access to their Facebook Pages for posting content and receiving Lead Ads.

### Step 1: Create a Facebook App
1. Go to [https://developers.facebook.com](https://developers.facebook.com)
2. Click **"My Apps"** → **"Create App"**
3. Choose **"Business"** as your app type
4. Fill in:
   - **App Name**: "AlphaClone" (or your brand)
   - **App Contact Email**: your business email
5. Click **"Create App"**

### Step 2: Configure Facebook Login
1. In your app dashboard, click **"Add Product"** → **"Facebook Login"** → **"Set Up"**
2. Go to **Facebook Login → Settings**
3. Set **Valid OAuth Redirect URIs**:
   ```
   https://yourdomain.com/api/auth/facebook/callback
   http://localhost:3000/api/auth/facebook/callback
   ```
4. Enable **"Client OAuth Login"** and **"Web OAuth Login"**

### Step 3: Configure Required Permissions
In **App Review → Permissions and Features**, request these permissions:
- `pages_show_list` — List user's Facebook Pages
- `pages_manage_posts` — Post to Pages
- `pages_read_engagement` — Read Page engagement
- `leads_retrieval` — Retrieve leads from Lead Ads
- `pages_manage_metadata` — Subscribe to webhooks

### Step 4: Set Up Webhooks for Lead Ads
1. Go to **Webhooks** in your app dashboard
2. Add the **Page** subscription
3. Set the **Callback URL**: `https://yourdomain.com/api/webhooks/facebook/leads`
4. Set a **Verify Token** (any secret string you choose)
5. Subscribe to the **leadgen** field

### Step 5: Add to Environment Variables
```env
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_chosen_secret_string
NEXT_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id
```

### Step 6: Create the OAuth Callback API Route
You need an API route at `/api/auth/facebook/connect` and `/api/auth/facebook/callback`.

**File: `src/app/api/auth/facebook/connect/route.ts`**
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
    const appId = process.env.FACEBOOK_APP_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`;
    const scope = 'pages_show_list,pages_manage_posts,pages_read_engagement,leads_retrieval,pages_manage_metadata';

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;

    return NextResponse.redirect(authUrl);
}
```

**File: `src/app/api/auth/facebook/callback/route.ts`**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) return NextResponse.redirect('/dashboard/business/facebook?error=no_code');

    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`;

    // Exchange code for access token
    const tokenRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
        return NextResponse.redirect('/dashboard/business/facebook?error=token_failed');
    }

    // Get long-lived token
    const longLivedRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longLivedData = await longLivedRes.json();

    // Get user's Facebook Pages
    const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedData.access_token}`
    );
    const pagesData = await pagesRes.json();

    // Save to database
    const supabase = createSupabaseAdminClient();
    for (const page of pagesData.data || []) {
        await supabase.from('facebook_integrations').upsert({
            tenant_id: 'CURRENT_TENANT_ID', // derive from session
            page_id: page.id,
            page_name: page.name,
            page_access_token: page.access_token,
            user_access_token: longLivedData.access_token,
            connected_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id,page_id' });
    }

    return NextResponse.redirect('/dashboard/business/facebook?success=true');
}
```

### Step 7: Create Required Database Tables
```sql
CREATE TABLE IF NOT EXISTS facebook_integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    page_id TEXT NOT NULL,
    page_name TEXT,
    page_access_token TEXT,
    user_access_token TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, page_id)
);

CREATE TABLE IF NOT EXISTS facebook_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    page_id TEXT,
    lead_id TEXT UNIQUE,
    form_id TEXT,
    lead_data JSONB,
    synced_to_crm BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Step 8: Business Dashboard — How Users Connect Facebook
1. Log into the Business Dashboard
2. Click **"Facebook"** in the sidebar (under Integrations)
3. Click **"Connect Facebook"** button
4. Facebook OAuth popup opens → User logs in and grants permissions
5. User is redirected back → their Facebook Pages appear in the dashboard
6. They can now:
   - **Post to Pages** directly from the dashboard
   - **View incoming Lead Ads** automatically synced from Facebook
   - **Sync leads to CRM** with one click

### Step 9: Submit for Facebook App Review
Before going live, Facebook requires [App Review](https://developers.facebook.com/docs/app-review):
1. Record a screencast showing how your app uses each permission
2. Submit for review via the Facebook Developer Console
3. Approval typically takes 1–5 business days
4. During development, your app works for users listed as App Testers

---

## 3. Zoho Integration

### How It Works
Zoho uses **OAuth 2.0** for both Zoho Mail and Zoho CRM. The platform already has working integration components.

### Step 1: Create a Zoho API Client
1. Go to [https://api-console.zoho.com](https://api-console.zoho.com)
2. Click **"Add Client"** → **"Server-based Applications"**
3. Fill in:
   - **Client Name**: "AlphaClone"
   - **Homepage URL**: `https://yourdomain.com`
  - **Authorized Redirect URIs**: `https://yourdomain.com/api/auth/zoho/callback`
4. Copy your **Client ID** and **Client Secret**

### Step 2: Add to Environment Variables
```env
ZOHO_CLIENT_ID=your_zoho_client_id
ZOHO_CLIENT_SECRET=your_zoho_client_secret
ZOHO_REDIRECT_URI=https://yourdomain.com/api/auth/zoho/callback
```

### Step 3: Business Dashboard — How Users Connect Zoho
1. Log into the Business Dashboard
2. Go to **Settings** → Zoho Integration section
3. Click **"Connect Zoho"**
4. Zoho OAuth consent screen opens → User authorizes
5. Redirected back → tokens saved to database
6. Now available:
   - **Zoho Mail** — Read/send emails from Zoho mailbox
   - **Zoho CRM** — Sync contacts, leads, deals between AlphaClone and Zoho

---

## 4. Environment Variables Summary

Add all of these to `.env` and to **Vercel → Project → Settings → Environment Variables**:

| Variable | Service | Description |
|----------|---------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio | Account SID from Twilio Console |
| `TWILIO_AUTH_TOKEN` | Twilio | Auth Token from Twilio Console |
| `TWILIO_PHONE_NUMBER` | Twilio | Your Twilio phone number (+1...) |
| `NEXT_PUBLIC_TWILIO_CONFIGURED` | Twilio | Set to `true` when Twilio is ready |
| `FACEBOOK_APP_ID` | Facebook | App ID from Facebook Developer Console |
| `FACEBOOK_APP_SECRET` | Facebook | App Secret from Facebook Developer Console |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | Facebook | Your chosen webhook verification string |
| `NEXT_PUBLIC_FACEBOOK_APP_ID` | Facebook | Same as FACEBOOK_APP_ID (public) |
| `ZOHO_CLIENT_ID` | Zoho | Client ID from Zoho API Console |
| `ZOHO_CLIENT_SECRET` | Zoho | Client Secret from Zoho API Console |
| `ZOHO_REDIRECT_URI` | Zoho | OAuth redirect URI |

---

## 5. Per-Client / Multi-Tenant Architecture

AlphaClone is multi-tenant. Each business (tenant) gets their own isolated data. Here's how integrations work per-client:

### Facebook (OAuth — Automatic Per-Client)
- ✅ **Already per-client**. Each tenant connects their own Facebook account via OAuth. Their Page tokens are stored with their `tenant_id`. No shared credentials.

### Zoho (OAuth — Automatic Per-Client)
- ✅ **Already per-client**. Each tenant authorizes their own Zoho account. Tokens are stored per `tenant_id`.

### Twilio (API Keys — Platform-Level by Default)
- ⚠️ **Currently platform-wide**. All tenants share one Twilio account.
- To make it per-client, follow the steps in Section 1 under "Per-Client Twilio".
- Alternative: Use [Twilio SubAccounts](https://www.twilio.com/docs/iam/api/subaccounts) to create isolated accounts for each tenant programmatically.

---

## Quick Reference — Dashboard Navigation

| Section | Items |
|---------|-------|
| **Overview** | Dashboard |
| **Sales & Acquisition** | AI Growth, Leads, Contacts |
| **Communication** | Mail, Calendar, Booking, Meetings |
| **Deals & Agreements** | Quotes, Contracts |
| **Project Execution** | Projects, Tasks, Task Scheduler |
| **Finance & Records** | Invoices, Finance, Documents |
| **Marketing & Outreach** | SMS Campaigns, Social Media, Email Campaigns |
| **Integrations** | Facebook, Zoho Mail, Zoho CRM |
| **Analytics & Operations** | Daily Summary, Quota Manager |
| **Administration** | Settings |
