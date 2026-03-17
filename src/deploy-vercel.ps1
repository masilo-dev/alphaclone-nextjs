# Vercel Deployment Script
Write-Host "=== Vercel Deployment ===" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if (-not $vercelInstalled) {
    Write-Host "Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
    Write-Host ""
}

Write-Host "Options:" -ForegroundColor Green
Write-Host "1. Deploy to Production (vercel --prod)" -ForegroundColor White
Write-Host "2. Deploy Preview (vercel)" -ForegroundColor White
Write-Host "3. Check Vercel Status" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host "Deploying to production..." -ForegroundColor Yellow
        vercel --prod
    }
    "2" {
        Write-Host "Deploying preview..." -ForegroundColor Yellow
        vercel
    }
    "3" {
        Write-Host "Checking Vercel status..." -ForegroundColor Yellow
        vercel ls
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan

