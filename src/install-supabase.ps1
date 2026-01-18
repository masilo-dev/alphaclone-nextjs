# Supabase CLI Installation Script for Windows
# Run this in PowerShell (as Administrator recommended)

Write-Host "🚀 Installing Supabase CLI..." -ForegroundColor Cyan

# Step 1: Create directory
$installPath = "$env:USERPROFILE\Supabase"
Write-Host "Creating directory: $installPath" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $installPath -Force | Out-Null

# Step 2: Download latest release
Write-Host "Downloading Supabase CLI..." -ForegroundColor Yellow
$zipPath = "$env:TEMP\supabase.zip"
$downloadUrl = "https://github.com/supabase/cli/releases/download/v1.200.3/supabase_1.200.3_windows_amd64.zip"

try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
    Write-Host "✓ Download complete" -ForegroundColor Green
} catch {
    Write-Host "✗ Download failed: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Extract
Write-Host "Extracting files..." -ForegroundColor Yellow
try {
    Expand-Archive -Path $zipPath -DestinationPath $installPath -Force
    Write-Host "✓ Extraction complete" -ForegroundColor Green
} catch {
    Write-Host "✗ Extraction failed: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Add to PATH
Write-Host "Adding to PATH..." -ForegroundColor Yellow
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$installPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$installPath", "User")
    $env:Path += ";$installPath"
    Write-Host "✓ Added to PATH" -ForegroundColor Green
} else {
    Write-Host "✓ Already in PATH" -ForegroundColor Green
}

# Step 5: Verify installation
Write-Host "`nVerifying installation..." -ForegroundColor Yellow
$supabasePath = Join-Path $installPath "supabase.exe"
if (Test-Path $supabasePath) {
    Write-Host "✓ Supabase CLI installed successfully!" -ForegroundColor Green
    Write-Host "`nInstalled at: $supabasePath" -ForegroundColor Cyan
    
    # Try to run version command
    try {
        & $supabasePath --version
    } catch {
        Write-Host "Note: Close and reopen PowerShell to use 'supabase' command" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ Installation verification failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Installation complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Close and reopen PowerShell" -ForegroundColor White
Write-Host "2. Run: supabase login" -ForegroundColor White
Write-Host "3. Run: supabase link --project-ref YOUR_PROJECT_REF" -ForegroundColor White
Write-Host "4. Run: supabase db push" -ForegroundColor White
