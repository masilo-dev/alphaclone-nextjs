# Supabase CLI Installation - Simple Version
# Run in PowerShell (Admin recommended)

Write-Host "Installing Supabase CLI..." -ForegroundColor Cyan

# Download
Write-Host "Downloading..." -ForegroundColor Yellow
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest `
    -Uri "https://github.com/supabase/cli/releases/download/v1.200.3/supabase_1.200.3_windows_amd64.zip" `
    -OutFile "$env:TEMP\supabase.zip" `
    -UseBasicParsing

# Extract
Write-Host "Extracting..." -ForegroundColor Yellow
Expand-Archive -Path "$env:TEMP\supabase.zip" -DestinationPath "$env:USERPROFILE\Supabase" -Force

# Add to PATH
Write-Host "Adding to PATH..." -ForegroundColor Yellow
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$env:USERPROFILE\Supabase*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$env:USERPROFILE\Supabase", "User")
}
$env:Path += ";$env:USERPROFILE\Supabase"

# Test
Write-Host "Testing..." -ForegroundColor Yellow
& "$env:USERPROFILE\Supabase\supabase.exe" --version

Write-Host "`n✅ Installation complete!" -ForegroundColor Green
Write-Host "Close and reopen PowerShell, then run: supabase login" -ForegroundColor Cyan
