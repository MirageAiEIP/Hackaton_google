# Script pour préparer les GitHub Secrets
# Usage: .\setup-github-secrets.ps1

param(
    [string]$ServiceAccountKeyPath = "..\config\gaia-service-account-key.json"
)

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  GitHub Secrets Setup" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que le fichier existe
if (!(Test-Path $ServiceAccountKeyPath)) {
    Write-Host "[ERROR] Service account key not found at: $ServiceAccountKeyPath" -ForegroundColor Red
    exit 1
}

Write-Host "[1/3] Reading service account key..." -ForegroundColor Yellow
$content = Get-Content $ServiceAccountKeyPath -Raw

Write-Host "[2/3] Encoding to base64..." -ForegroundColor Yellow
$bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
$base64 = [Convert]::ToBase64String($bytes)

Write-Host "[3/3] Copying to clipboard..." -ForegroundColor Yellow
$base64 | Set-Clipboard

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  SUCCESS!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "The service account key has been encoded and COPIED TO CLIPBOARD!" -ForegroundColor Green
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Go to GitHub Secrets page:" -ForegroundColor White
Write-Host "   https://github.com/BitBricoleurs/GaIA/settings/secrets/actions" -ForegroundColor Blue
Write-Host ""
Write-Host "2. Click 'New repository secret'" -ForegroundColor White
Write-Host ""
Write-Host "3. Create these secrets:" -ForegroundColor White
Write-Host ""
Write-Host "   Secret Name: GCP_SERVICE_ACCOUNT_KEY" -ForegroundColor Yellow
Write-Host "   Value: [PASTE from clipboard - Ctrl+V]" -ForegroundColor Yellow
Write-Host ""
Write-Host "   Secret Name: GCP_PROJECT_ID" -ForegroundColor Yellow
Write-Host "   Value: gaia-477710" -ForegroundColor Yellow
Write-Host ""

Write-Host "4. Save both secrets" -ForegroundColor White
Write-Host ""

Write-Host "5. Test deployment:" -ForegroundColor White
Write-Host "   git push gaia staging" -ForegroundColor Magenta
Write-Host ""

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Afficher aussi la première partie du base64 pour vérification
$preview = $base64.Substring(0, [Math]::Min(50, $base64.Length))
Write-Host "Preview (first 50 chars): $preview..." -ForegroundColor Gray
Write-Host "Total length: $($base64.Length) characters" -ForegroundColor Gray
