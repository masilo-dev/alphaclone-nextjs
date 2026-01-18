# Deploy All Migrations to Supabase

# This script automatically deploys all migrations to your Supabase database
# Run this after making any database schema changes

Write-Host "🚀 Deploying migrations to Supabase..." -ForegroundColor Cyan

# Check if Supabase CLI is installed
$supabaseVersion = npx supabase --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Supabase CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g supabase
}

Write-Host "✅ Supabase CLI ready" -ForegroundColor Green

# Link to your Supabase project (if not already linked)
Write-Host "🔗 Checking Supabase project link..." -ForegroundColor Cyan
$linkStatus = npx supabase status 2>&1
if ($linkStatus -match "not linked") {
    Write-Host "⚠️  Project not linked. Linking now..." -ForegroundColor Yellow
    Write-Host "Please enter your Supabase project ref: ehekzoiogvtweugeinktn" -ForegroundColor Yellow
    npx supabase link --project-ref ehekzoiogvtweugeinktn
}

# Push all migrations to remote database
Write-Host "📤 Pushing migrations to remote database..." -ForegroundColor Cyan
npx supabase db push --db-url "postgresql://postgres.ehekzoiogvtweugeinktn:Amgseries@gmail.com@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ All migrations deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 Your database is now up to date with:" -ForegroundColor Cyan
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
    Write-Host "🌐 Test your app at: https://alphaclone-systems-ogecwgzll-borns-projects-bfe09b9f.vercel.app" -ForegroundColor Green
}
else {
    Write-Host "❌ Migration failed. Check the error above." -ForegroundColor Red
    Write-Host "💡 Tip: You can also run migrations manually via Supabase Dashboard" -ForegroundColor Yellow
    Write-Host "   Go to: https://supabase.com/dashboard/project/ehekzoiogvtweugeinktn/sql/new" -ForegroundColor Yellow
}
