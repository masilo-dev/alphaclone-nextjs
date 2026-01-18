# Supabase Migration Deployment Guide
# Since Supabase CLI requires special installation, here are your options:

Write-Host "🚀 SUPABASE MIGRATION DEPLOYMENT OPTIONS" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 You have 3 options to deploy your database:" -ForegroundColor Yellow
Write-Host ""

Write-Host "OPTION 1: Supabase Dashboard (EASIEST - RECOMMENDED)" -ForegroundColor Green
Write-Host "1. Go to: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "2. Select your project" -ForegroundColor White
Write-Host "3. Click 'SQL Editor' in the left sidebar" -ForegroundColor White
Write-Host "4. Click 'New Query'" -ForegroundColor White
Write-Host "5. Open: supabase\COMPLETE_MIGRATION.sql" -ForegroundColor White
Write-Host "6. Copy ALL the content and paste it" -ForegroundColor White
Write-Host "7. Click 'Run' or press Ctrl+Enter" -ForegroundColor White
Write-Host "8. Wait for success message" -ForegroundColor White
Write-Host ""

Write-Host "OPTION 2: Install Supabase CLI (Windows)" -ForegroundColor Green
Write-Host "Using Scoop package manager:" -ForegroundColor White
Write-Host "1. Install Scoop: https://scoop.sh" -ForegroundColor White
Write-Host "2. Run: scoop bucket add supabase https://github.com/supabase/scoop-bucket.git" -ForegroundColor White
Write-Host "3. Run: scoop install supabase" -ForegroundColor White
Write-Host "4. Run: supabase login" -ForegroundColor White
Write-Host "5. Run: supabase link --project-ref YOUR_PROJECT_REF" -ForegroundColor White
Write-Host "6. Run: supabase db push" -ForegroundColor White
Write-Host ""

Write-Host "OPTION 3: Direct SQL Connection (Advanced)" -ForegroundColor Green
Write-Host "Use psql or any PostgreSQL client to connect directly" -ForegroundColor White
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "📁 Migration file location:" -ForegroundColor Yellow
Write-Host "   $PSScriptRoot\supabase\COMPLETE_MIGRATION.sql" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Would you like to open the migration file now? (y/n)"
if ($choice -eq 'y') {
    $filePath = Join-Path $PSScriptRoot "supabase\COMPLETE_MIGRATION.sql"
    if (Test-Path $filePath) {
        Start-Process notepad $filePath
        Write-Host "✅ File opened in Notepad!" -ForegroundColor Green
        Write-Host "Copy the content and paste it in Supabase SQL Editor" -ForegroundColor Yellow
    } else {
        Write-Host "❌ File not found at: $filePath" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🌐 Quick Links:" -ForegroundColor Cyan
Write-Host "Supabase Dashboard: https://supabase.com/dashboard" -ForegroundColor White
Write-Host "Supabase CLI Docs: https://supabase.com/docs/guides/cli" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
