# Supabase Deployment Helper Script
# This script helps you deploy migrations and create admin accounts

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  AlphaClone Systems - Supabase Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$projectRef = "ehekzoiogvtweugeinktn"
$projectUrl = "https://supabase.com/dashboard/project/$projectRef"

Write-Host "Project URL: $projectUrl" -ForegroundColor Yellow
Write-Host ""

Write-Host "STEP 1: Deploy Database Schema" -ForegroundColor Green
Write-Host "-------------------------------" -ForegroundColor Green
Write-Host "1. Open SQL Editor: $projectUrl/sql/new" -ForegroundColor White
Write-Host "2. Copy the contents of: supabase/migrations/combined_migration.sql" -ForegroundColor White
Write-Host "3. Paste into SQL Editor and click 'Run'" -ForegroundColor White
Write-Host ""
Write-Host "Press any key when schema is deployed..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "STEP 2: Create Admin Accounts" -ForegroundColor Green
Write-Host "------------------------------" -ForegroundColor Green
Write-Host "1. Open Authentication: $projectUrl/auth/users" -ForegroundColor White
Write-Host "2. Click 'Add user' > 'Create new user'" -ForegroundColor White
Write-Host ""
Write-Host "Create Admin 1:" -ForegroundColor Cyan
Write-Host "  Email: info@alphaclone.tech" -ForegroundColor White
Write-Host "  Password: Amgseries@gmail.com" -ForegroundColor White
Write-Host "  Auto Confirm User: YES" -ForegroundColor White
Write-Host ""
Write-Host "Create Admin 2:" -ForegroundColor Cyan
Write-Host "  Email: alphaclonesystems@hotmail.com" -ForegroundColor White
Write-Host "  Password: Amgseries@gmail.com" -ForegroundColor White
Write-Host "  Auto Confirm User: YES" -ForegroundColor White
Write-Host ""
Write-Host "Press any key when both admin accounts are created..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "STEP 3: Set Admin Roles" -ForegroundColor Green
Write-Host "-----------------------" -ForegroundColor Green
Write-Host "1. Go back to SQL Editor: $projectUrl/sql/new" -ForegroundColor White
Write-Host "2. Run this SQL:" -ForegroundColor White
Write-Host ""
Write-Host "UPDATE public.profiles " -ForegroundColor Magenta
Write-Host "SET role = 'admin' " -ForegroundColor Magenta
Write-Host "WHERE email IN ('info@alphaclone.tech', 'alphaclonesystems@hotmail.com');" -ForegroundColor Magenta
Write-Host ""
Write-Host "Press any key when admin roles are set..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "STEP 4: Verify Deployment" -ForegroundColor Green
Write-Host "-------------------------" -ForegroundColor Green
Write-Host "Run this SQL to verify:" -ForegroundColor White
Write-Host ""
Write-Host "SELECT id, email, name, role FROM public.profiles WHERE role = 'admin';" -ForegroundColor Magenta
Write-Host ""
Write-Host "You should see both admin accounts listed." -ForegroundColor White
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. The dev server should already be running" -ForegroundColor White
Write-Host "2. Open http://localhost:5173" -ForegroundColor White
Write-Host "3. Click 'Login' and use admin credentials:" -ForegroundColor White
Write-Host "   Email: info@alphaclone.tech" -ForegroundColor Yellow
Write-Host "   Password: Amgseries@gmail.com" -ForegroundColor Yellow
Write-Host ""
Write-Host "Enjoy your AlphaClone Systems dashboard! 🚀" -ForegroundColor Green
Write-Host ""
