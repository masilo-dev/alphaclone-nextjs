# Apply Migration to Supabase Database
# This script applies the get_user_tenants fix to your Supabase database

Write-Host "Applying migration to fix get_user_tenants function..." -ForegroundColor Cyan

# Read environment variables
$envContent = Get-Content .env.local
$supabaseUrl = ($envContent | Select-String 'NEXT_PUBLIC_SUPABASE_URL' | ForEach-Object { $_ -replace 'NEXT_PUBLIC_SUPABASE_URL=', '' }).Trim()
$serviceRoleKey = ($envContent | Select-String 'SUPABASE_SERVICE_ROLE_KEY' | ForEach-Object { $_ -replace 'SUPABASE_SERVICE_ROLE_KEY=', '' }).Trim()

# Extract project reference from URL
$projectRef = $supabaseUrl -replace 'https://', '' -replace '.supabase.co', ''

Write-Host "Project: $projectRef" -ForegroundColor Yellow
Write-Host "URL: $supabaseUrl" -ForegroundColor Yellow

# Read migration SQL
$migrationSql = Get-Content "src\supabase\migrations\20260119_fix_get_user_tenants.sql" -Raw

# Apply migration via Supabase REST API
$headers = @{
    "apikey" = $serviceRoleKey
    "Authorization" = "Bearer $serviceRoleKey"
    "Content-Type" = "application/json"
}

$body = @{
    query = $migrationSql
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/exec_sql" -Method Post -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✓ Migration applied successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The get_user_tenants function has been updated." -ForegroundColor Green
    Write-Host "Please refresh your browser to see the changes." -ForegroundColor Cyan
} catch {
    Write-Host "✗ Failed to apply migration via REST API" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please apply the migration manually:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://supabase.com/dashboard/project/$projectRef/sql" -ForegroundColor Cyan
    Write-Host "2. Copy the contents of: src\supabase\migrations\20260119_fix_get_user_tenants.sql" -ForegroundColor Cyan
    Write-Host "3. Paste and run it in the SQL Editor" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
}
