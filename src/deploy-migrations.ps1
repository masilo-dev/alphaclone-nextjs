# Deploy All Migrations to Supabase

# This script automatically deploys all migrations to your Supabase database
# Run this after making any database schema changes

Write-Host "Deploying migrations to database..." -ForegroundColor Cyan

# Check if Supabase CLI is installed
$supabaseVersion = npx supabase --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Supabase CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g supabase
}

Write-Host "Supabase CLI ready" -ForegroundColor Green

# Link to your Supabase project (if not already linked)
Write-Host "🔗 Checking Supabase project link..." -ForegroundColor Cyan
$linkStatus = npx supabase status 2>&1
if ($linkStatus -match "not linked") {
    Write-Host "Project not linked. Linking now..." -ForegroundColor Yellow
    if (-not $env:SUPABASE_PROJECT_REF) {
        Write-Host "Set SUPABASE_PROJECT_REF and rerun this script." -ForegroundColor Red
        exit 1
    }
    npx supabase link --project-ref $env:SUPABASE_PROJECT_REF
}

# Push all migrations to remote database
Write-Host "Pushing migrations to remote database..." -ForegroundColor Cyan
npx supabase db push --linked

if ($LASTEXITCODE -eq 0) {
    Write-Host "All migrations deployed successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "Your database is now up to date with:" -ForegroundColor Cyan
    Write-Host "   - User profiles & authentication" -ForegroundColor White
    Write-Host "   - Projects management" -ForegroundColor White
    Write-Host "   - Real-time messaging" -ForegroundColor White
    Write-Host "   - Contact form submissions" -ForegroundColor White
    Write-Host "   - Gallery & media storage" -ForegroundColor White
    Write-Host "   - Activity tracking & logs" -ForegroundColor White
    Write-Host "   - Login sessions" -ForegroundColor White
    Write-Host "   - Geo-blocking (Nigeria & India)" -ForegroundColor White
    Write-Host "   - Security alerts" -ForegroundColor White
    Write-Host ""
    Write-Host "Test your app in your current deployment environment." -ForegroundColor Green
}
else {
    Write-Host "Migration failed. Check the error above." -ForegroundColor Red
    Write-Host "Tip: You can also run migrations manually via your database dashboard SQL editor." -ForegroundColor Yellow
}
