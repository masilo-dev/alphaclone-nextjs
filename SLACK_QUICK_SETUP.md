# 🚀 Slack Integration - Quick Setup

## ⚡ 5-Minute Setup

### 1. Create Slack App (2 minutes)
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name: "AlphaClone Business OS"
4. Choose your workspace
5. Click "Create App"

### 2. Configure OAuth (1 minute)
1. Go to "OAuth & Permissions"
2. Add Redirect URL: `https://alphaclone.tech/api/slack/oauth/callback`
3. Add these scopes:
   - `channels:read`
   - `chat:write` 
   - `chat:write.public`
   - `files:write`
   - `users:read`
   - `team:read`
   - `channels:join`
   - `im:write`
   - `commands`

### 3. Add Slash Commands (1 minute)
1. Go to "Slash Commands"
2. Create `/alphaclone` → `https://alphaclone.tech/api/slack/commands`
3. Create `/lead` → `https://alphaclone.tech/api/slack/commands`
4. Create `/meeting` → `https://alphaclone.tech/api/slack/commands`

### 4. Enable Features (30 seconds)
1. Go to "Interactive Components"
2. Set Request URL: `https://alphaclone.tech/api/slack/interactive`
3. Enable interactivity

### 5. Install App (30 seconds)
1. Go to "Install App"
2. Click "Install to Workspace"
3. Copy credentials to `.env.local`:

```env
SLACK_CLIENT_ID=your_client_id_here
SLACK_CLIENT_SECRET=your_client_secret_here
SLACK_SIGNING_SECRET=your_signing_secret_here
SLACK_BOT_TOKEN=xoxb-your_bot_token_here
SLACK_REDIRECT_URI=https://alphaclone.tech/api/slack/oauth/callback
```

## 🎯 Ready to Use!

### Test Commands in Slack:
- `/alphaclone help` - Show help
- `/lead create Test Lead` - Create lead
- `/meeting schedule Team Standup` - Schedule meeting

### Features:
✅ Lead management via slash commands
✅ Meeting scheduling
✅ Real-time notifications
✅ Interactive buttons and modals
✅ New member onboarding

## 🔧 Environment Setup

Add these to your `.env.local` file:

```env
# Slack OAuth
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_BOT_TOKEN=xoxb-your_bot_token
SLACK_REDIRECT_URI=https://alphaclone.tech/api/slack/oauth/callback
```

## 🚀 Deploy

1. Push changes to GitHub
2. Deploy to Vercel
3. Update Slack app redirect URLs to production URL
4. Test integration

---

**🎉 That's it! Your Slack workspace is now connected to AlphaClone!**

Need help? Check the full guide: `SLACK_OAUTH_SETUP_GUIDE.md`
