# Git Push Fix Script for AlphaClone Platform
# Run this script to properly initialize and push to GitHub

Write-Host "=== AlphaClone Git Push Fix ===" -ForegroundColor Cyan
Write-Host ""

# Get the project directory
$projectDir = $PSScriptRoot
if (-not $projectDir) {
    $projectDir = Get-Location
}

Write-Host "Project Directory: $projectDir" -ForegroundColor Yellow
Write-Host ""

# Check if .git exists
if (Test-Path "$projectDir\.git") {
    Write-Host "Git repository already exists." -ForegroundColor Green
    Write-Host "Checking status..." -ForegroundColor Yellow
    Set-Location $projectDir
    git status
    Write-Host ""
    Write-Host "To push your changes:" -ForegroundColor Cyan
    Write-Host "  git add ." -ForegroundColor White
    Write-Host "  git commit -m 'Platform fixes and optimizations'" -ForegroundColor White
    Write-Host "  git push origin main" -ForegroundColor White
} else {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    Set-Location $projectDir
    
    # Initialize git
    git init
    
    # Add all files
    Write-Host "Adding files..." -ForegroundColor Yellow
    git add .
    
    # Create initial commit
    Write-Host "Creating initial commit..." -ForegroundColor Yellow
    git commit -m "Initial commit - Platform fixes and optimizations"
    
    # Check if remote exists
    $remoteExists = git remote -v 2>&1
    if ($remoteExists -match "origin") {
        Write-Host "Remote 'origin' already exists." -ForegroundColor Green
    } else {
        Write-Host "Adding remote 'origin'..." -ForegroundColor Yellow
        git remote add origin https://github.com/masilo-dev/alphaclone-chatbot.git
    }
    
    Write-Host ""
    Write-Host "Ready to push! Run:" -ForegroundColor Green
    Write-Host "  git push -u origin main" -ForegroundColor White
    Write-Host ""
    Write-Host "If you get an error about branch name, try:" -ForegroundColor Yellow
    Write-Host "  git branch -M main" -ForegroundColor White
    Write-Host "  git push -u origin main" -ForegroundColor White
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan

