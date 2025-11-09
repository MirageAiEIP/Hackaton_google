# Export all secrets from Google Cloud Secret Manager to local files
# Usage: .\export-secrets.ps1 [output-directory]

param(
    [string]$OutputDir = ".\secrets-backup"
)

$ErrorActionPreference = "Continue"
$ProjectId = (gcloud config get-value project 2>$null)

Write-Host "📦 Exporting secrets from project: $ProjectId" -ForegroundColor Cyan
Write-Host "📁 Output directory: $OutputDir" -ForegroundColor Cyan
Write-Host ""

# Create output directory
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Get list of all secrets
$Secrets = gcloud secrets list --format="value(name)" 2>$null

# Counter
$count = 0
$total = ($Secrets | Measure-Object).Count

# Export each secret
foreach ($secretName in $Secrets) {
    $count++
    Write-Host "[$count/$total] Exporting: $secretName" -ForegroundColor Yellow

    try {
        # Get the latest version of the secret
        $secretValue = gcloud secrets versions access latest --secret="$secretName" 2>$null

        if ($LASTEXITCODE -eq 0) {
            $outputFile = Join-Path $OutputDir "$secretName.txt"
            $secretValue | Out-File -FilePath $outputFile -Encoding utf8 -NoNewline
            Write-Host "  ✅ Exported to: $outputFile" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Failed to export: $secretName" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎉 Export completed!" -ForegroundColor Green
Write-Host "📊 Total secrets exported: $count" -ForegroundColor Cyan
Write-Host "📁 Location: $OutputDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANT: These files contain sensitive data!" -ForegroundColor Red
Write-Host "   - Do NOT commit them to git" -ForegroundColor Yellow
Write-Host "   - Keep them secure" -ForegroundColor Yellow
Write-Host "   - Delete after migration" -ForegroundColor Yellow
