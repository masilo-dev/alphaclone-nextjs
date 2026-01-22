$lines = Get-Content 'c:\Users\Alphacone IO\alphaclone-nextjs-2\src\components\LandingPage.tsx'
$insert = Get-Content 'c:\Users\Alphacone IO\alphaclone-nextjs-2\who-we-serve-section.txt'

$result = @()
$result += $lines[0..250]
$result += $insert
$result += ''
$result += $lines[252..($lines.Count-1)]

$result | Set-Content 'c:\Users\Alphacone IO\alphaclone-nextjs-2\src\components\LandingPage.tsx'
Write-Host "Successfully inserted Who We Serve section"
