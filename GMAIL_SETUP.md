# Gmail Integration Setup Guide

To enable Gmail syncing and sending in your AlphaClone Business OS, you need to configure Google OAuth 2.0.

## 1. Create Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named "AlphaClone Business OS".
3. Search for and **Enable** the following APIs:
    - **Gmail API**
    - **Generative Language API** (if you want to use the Gemini fallback)

## 2. Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External** (unless you are only using Workspace users).
3. Add your app name, support email, and developer contact info.
4. **Scopes:** Add `https://www.googleapis.com/auth/gmail.modify` and `https://www.googleapis.com/auth/gmail.send`.
5. Add your own email as a **Test User** while the app is in "Testing" mode.

## 3. Create Credentials
1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Application type: **Web application**.
4. **Authorized Redirect URIs:**
    - Local: `http://localhost:3000/api/auth/google/gmail/callback`
    - Production: `https://your-domain.vercel.app/api/auth/google/gmail/callback`
5. Copy the **Client ID** and **Client Secret**.

## 4. Add to Vercel
In your Vercel Dashboard (**Settings > Environment Variables**), add:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_GEMINI_API_KEY` (The `AIza...` key you provided)

## 5. Verify
Once deployed, go to **Settings > Booking & Integrations** in your dashboard and click **Connect Gmail**.
