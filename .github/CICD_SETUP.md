# CI/CD Pipeline Setup Guide

## Overview

This project uses GitHub Actions for continuous integration and continuous deployment (CI/CD). The pipeline automatically:

- ✅ Runs code quality checks (linting, type-checking)
- ✅ Scans for security vulnerabilities
- ✅ Builds and verifies the application
- ✅ Validates database migrations
- ✅ Runs automated tests
- ✅ Deploys to Vercel (preview and production)
- ✅ Performs health checks after deployment

---

## Setup Instructions

### 1. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets:

#### Vercel Configuration
```
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id
```

**How to get these:**
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel login`
3. Run `vercel link` in your project directory
4. Get token from: https://vercel.com/account/tokens
5. Get ORG_ID and PROJECT_ID from `.vercel/project.json`

#### Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Security Scanning (Optional)
```
SNYK_TOKEN=your_snyk_token
```
Get from: https://snyk.io/ (free for open source)

---

### 2. Update Deployment Configuration

Edit `.github/workflows/deploy.yml`:

**Line 74:** Replace `https://your-production-domain.com` with your actual production URL

**Line 9:** Update `dependabot.yml` with your GitHub username

---

### 3. Enable GitHub Actions

1. Go to your repository → Actions
2. Click "I understand my workflows, go ahead and enable them"
3. Your CI/CD pipeline is now active!

---

## Workflows

### 🔍 CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main`, `master`, or `develop` branches
- Pull requests to these branches

**Jobs:**
1. **Quality Checks**
   - ESLint
   - TypeScript type checking
   - Prettier formatting check

2. **Security Scanning**
   - npm audit for known vulnerabilities
   - Snyk security scan (if configured)

3. **Build Verification**
   - Tests build on Node 18.x and 20.x
   - Verifies build artifacts are created

4. **Migration Validation**
   - Checks SQL syntax
   - Detects duplicate migrations
   - Validates migration structure

5. **Test Suite**
   - Unit tests (when available)
   - E2E tests (when available)

---

### 🚀 Deploy Workflow (`.github/workflows/deploy.yml`)

**Triggers:**
- Push to `main` or `master` → Production deployment
- Pull requests → Preview deployment

**Preview Deployments:**
- Creates a unique preview URL for each PR
- Comments the preview URL on the PR
- Automatically deleted when PR is closed

**Production Deployments:**
- Deploys to production on merge to main/master
- Creates GitHub deployment record
- Runs health checks after deployment
- Sends notifications on success/failure

**Health Checks:**
- Main page response (200 OK)
- API health endpoint (if exists)
- Response time monitoring (alerts if > 3s)

---

## Dependabot Configuration

Automated dependency updates (`.github/dependabot.yml`):

- **NPM packages:** Weekly updates on Mondays
- **GitHub Actions:** Weekly updates
- **Grouped updates:** Related packages updated together
- **Auto-labeling:** PRs tagged with `dependencies`
- **Version constraints:** Major version updates require manual review

---

## Usage

### Automatic Triggers

**On Every Push to Main/Master:**
```bash
git add .
git commit -m "feat: add new feature"
git push origin main
```
→ Triggers CI checks + Production deployment

**On Pull Request:**
```bash
git checkout -b feature/new-feature
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature
# Create PR on GitHub
```
→ Triggers CI checks + Preview deployment

---

### Manual Deployment

You can manually trigger workflows from GitHub Actions UI:

1. Go to Actions → Select workflow
2. Click "Run workflow"
3. Choose branch and click "Run workflow"

---

## Pipeline Status Badges

Add to your README.md:

```markdown
![CI Status](https://github.com/your-username/your-repo/workflows/Continuous%20Integration/badge.svg)
![Deploy Status](https://github.com/your-username/your-repo/workflows/Deploy%20to%20Vercel/badge.svg)
```

---

## Troubleshooting

### Build Fails with "Missing environment variables"

**Solution:** Add required secrets to GitHub repository settings

### Deployment Fails with "Vercel token invalid"

**Solution:**
1. Regenerate token at https://vercel.com/account/tokens
2. Update `VERCEL_TOKEN` secret in GitHub

### Migration validation fails

**Solution:**
1. Check SQL syntax in migration files
2. Ensure no duplicate migration timestamps
3. Run migrations locally first: `supabase db push`

### Preview deployment not commenting on PR

**Solution:**
1. Ensure GitHub Actions has write permissions
2. Go to Settings → Actions → General
3. Set "Workflow permissions" to "Read and write permissions"

---

## Best Practices

### ✅ DO:
- Always create feature branches
- Wait for CI checks before merging
- Test preview deployments before merging to main
- Keep dependencies up-to-date via Dependabot
- Review security alerts promptly

### ❌ DON'T:
- Don't push directly to main (use PRs)
- Don't merge failing CI checks
- Don't ignore security vulnerabilities
- Don't commit secrets or API keys
- Don't skip code reviews

---

## Monitoring

### View Pipeline Runs

1. Go to GitHub repository → Actions
2. See all workflow runs and their status
3. Click on any run to see detailed logs

### Vercel Deployments

1. Go to https://vercel.com/dashboard
2. See all deployments and their status
3. View deployment logs and performance metrics

### Deployment Notifications

**Slack Integration (Optional):**
Add to your workflow:
```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "🚀 Production deployment successful!"
      }
```

---

## Security Considerations

### Protected Branches

Recommended branch protection rules:

1. Go to Settings → Branches → Add rule
2. Branch name pattern: `main` or `master`
3. Enable:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators
   - ✅ Restrict who can push to matching branches

### Secret Rotation

**Best Practice:** Rotate secrets every 90 days
1. Generate new tokens
2. Update GitHub secrets
3. Verify deployments still work

---

## Cost Optimization

### Vercel
- **Free Tier:** 100 GB bandwidth/month
- **Pro Tier:** $20/month for production apps
- Monitor usage at: https://vercel.com/dashboard/usage

### GitHub Actions
- **Free Tier:** 2,000 minutes/month for private repos
- **Public Repos:** Unlimited minutes
- Monitor usage at: Settings → Billing → Actions minutes

---

## Next Steps

1. ✅ Configure GitHub secrets
2. ✅ Update deployment URLs
3. ✅ Enable GitHub Actions
4. ✅ Create your first PR to test preview deployments
5. ✅ Set up branch protection rules
6. ✅ Configure Slack notifications (optional)
7. ✅ Set up monitoring dashboards

---

## Support

- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **Vercel Docs:** https://vercel.com/docs
- **Supabase CI/CD:** https://supabase.com/docs/guides/cli/github-action

---

**🎉 Your CI/CD pipeline is now configured! Push code and watch the magic happen! 🚀**
