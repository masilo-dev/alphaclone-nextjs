# Apply Momentum Dashboard Fix to Supabase Database
# This script applies the enhanced RPC for dashboard metrics

Write-Host "Applying Momentum Dashboard Metrics migration..." -ForegroundColor Cyan

# Read environment variables from .env.production.local
$envPath = ".env.production.local"
if (-Not (Test-Path $envPath)) {
    Write-Host "Error: $envPath not found" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envPath
$supabaseUrl = ($envContent | Select-String '^SUPABASE_URL=' | ForEach-Object { $_ -replace '^SUPABASE_URL=', '' }).Trim().Trim('"')
$serviceRoleKey = ($envContent | Select-String '^SUPABASE_SERVICE_ROLE_KEY=' | ForEach-Object { $_ -replace '^SUPABASE_SERVICE_ROLE_KEY=', '' }).Trim().Trim('"')

if (-Not $supabaseUrl -or -Not $serviceRoleKey) {
    Write-Host "Error: Could not find SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in $envPath" -ForegroundColor Red
    exit 1
}

# Extract project reference from URL
$projectRef = $supabaseUrl -replace 'https://', '' -replace '.supabase.co', ''

Write-Host "Project: $projectRef" -ForegroundColor Yellow
Write-Host "URL: $supabaseUrl" -ForegroundColor Yellow

# Read migration SQL
$migrationPath = "supabase\migrations\20260508_fix_realtime_and_rpc.sql"
if (-Not (Test-Path $migrationPath)) {
    Write-Host "Error: $migrationPath not found" -ForegroundColor Red
    exit 1
}
$migrationSql = Get-Content $migrationPath -Raw

# Apply migration via Supabase REST API (rpc/exec_sql)
$headers = @{
    "apikey" = $serviceRoleKey
    "Authorization" = "Bearer $serviceRoleKey"
    "Content-Type" = "application/json"
}

$body = @{
    query = $migrationSql
} | ConvertTo-Json

try {
    Write-Host "Sending migration to Supabase..." -ForegroundColor Cyan
    $response = Invoke-RestMethod -Uri "$supabaseUrl/rest/v1/rpc/exec_sql" -Method Post -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "Migration applied successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The dashboard stats RPC has been updated with momentum metrics." -ForegroundColor Green
} catch {
    Write-Host "Failed to apply migration via REST API" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        try {
            $errorBody = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorBody)
            $respText = $reader.ReadToEnd()
            Write-Host "Response Body: $respText" -ForegroundColor Yellow
        } catch {}
    }
    
    Write-Host ""
    Write-Host "Please apply the migration manually if the RPC endpoint does not exist:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://supabase.com/dashboard/project/$projectRef/sql" -ForegroundColor Cyan
    Write-Host "2. Copy the contents of: $migrationPath" -ForegroundColor Cyan
    Write-Host "3. Paste and run it in the SQL Editor" -ForegroundColor Cyan
}
