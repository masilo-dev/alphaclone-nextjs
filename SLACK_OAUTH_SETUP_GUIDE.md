# Slack OAuth Integration Setup Guide

## 🚀 Quick Setup Steps

### 1. Create Slack App
1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Enter app name: "AlphaClone Business OS"
4. Select workspace: Choose your Slack workspace
5. Click "Create App"

### 2. Configure OAuth & Permissions
1. Go to "OAuth & Permissions" in left sidebar
2. Scroll to "Redirect URLs" and add:
   ```
   https://alphaclone.tech/api/slack/oauth/callback
   https://localhost:3000/api/slack/oauth/callback (for development)
   ```

3. Add these OAuth Scopes:
   **Bot Token Scopes:**
   - `channels:read` - Read channel information
   - `chat:write` - Send messages as bot
   - `chat:write.public` - Send messages to channels bot is in
   - `files:write` - Upload files
   - `users:read` - Read user information
   - `team:read` - Read team information
   - `channels:join` - Join channels
   - `im:write` - Send direct messages
   - `commands` - Use slash commands

   **User Token Scopes:**
   - `channels:read`
   - `users:read`
   - `team:read`

### 3. Configure App Features

#### A. Slash Commands
1. Go to "Slash Commands"
2. Click "Create New Command"
3. Create these commands:

**Command 1: /alphaclone**
```
Command: /alphaclone
Request URL: https://alphaclone.tech/api/slack/commands
Short Description: Access AlphaClone Business OS features
Usage Hint: <action> <parameters>
```

**Command 2: /lead**
```
Command: /lead
Request URL: https://alphaclone.tech/api/slack/commands
Short Description: Manage leads from Slack
Usage Hint: <create|list|update> <lead_id>
```

**Command 3: /meeting**
```
Command: /meeting
Request URL: https://alphaclone.tech/api/slack/commands
Short Description: Schedule and manage meetings
Usage Hint: <schedule|list|cancel> <details>
```

#### B. Interactive Components
1. Go to "Interactive Components"
2. Set "Request URL": `https://alphaclone.tech/api/slack/interactive`
3. Enable "Interactivity"

#### C. Event Subscriptions
1. Go to "Event Subscriptions"
2. Set "Request URL": `https://alphaclone.tech/api/slack/events`
3. Subscribe to these Bot Events:
   - `message.channels` - Messages in channels
   - `app_mention` - When bot is mentioned
   - `team_join` - New user joins team

### 4. Install App to Workspace
1. Go to "Install App" in left sidebar
2. Click "Install to Workspace"
3. Authorize the permissions
4. Save the **Bot User OAuth Token** (starts with `xoxb-`)
5. Save the **Signing Secret** (found in "Basic Information")

### 5. Get App Credentials
From "Basic Information" page:
- **App ID**: Copy this
- **Client ID**: Copy this
- **Client Secret**: Copy this (click "Show")
- **Signing Secret**: Copy this
- **Bot User OAuth Token**: Copy this (from "Install App")

## 🔧 Environment Variables

Add these to your `.env.local` file:

```env
# Slack OAuth Configuration
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_BOT_TOKEN=xoxb-your_bot_token

# Slack Redirect URLs
SLACK_REDIRECT_URI=https://alphaclone.tech/api/slack/oauth/callback
SLACK_BASE_URL=https://slack.com
```

## 📱 AlphaClone Implementation

The following API endpoints are already implemented:

### OAuth Endpoints:
- `POST /api/slack/oauth/callback` - Handle OAuth callback
- `GET /api/slack/oauth/authorize` - Initiate OAuth flow

### Command Endpoints:
- `POST /api/slack/commands` - Handle slash commands
- `POST /api/slack/interactive` - Handle interactive components
- `POST /api/slack/events` - Handle event subscriptions

### Integration Management:
- `GET /api/integrations/status` - Check integration status
- `POST /api/integrations/actions` - Perform integration actions

## 🎯 Next Steps

1. **Create the Slack app** using the steps above
2. **Add credentials** to your environment variables
3. **Test the integration** by using `/alphaclone` command in Slack
4. **Connect workspace** in AlphaClone Integrations page

## 🚨 Important Notes

- **Redirect URLs must match exactly** (no trailing slashes)
- **Bot token must start with `xoxb-`**
- **Keep signing secret secure** - never expose in frontend
- **Test in development first** using localhost URLs
- **Enable all required scopes** before installing

## 📞 Support

If you need help:
1. Check Slack API documentation: https://api.slack.com/docs
2. Review AlphaClone integration logs in dashboard
3. Contact support if OAuth flow fails

---

**Ready to integrate! 🎉** Once you complete these steps, you'll be able to:
- Manage leads directly from Slack
- Get notifications for important events
- Use slash commands for quick actions
- Automate workflows between Slack and AlphaClone
