# Import secrets to a new Google Cloud project from local files
# Usage: .\import-secrets.ps1 -NewProjectId "your-new-project-id" [-SecretsDir ".\secrets-backup"]

param(
    [Parameter(Mandatory=$true)]
    [string]$NewProjectId,

    [string]$SecretsDir = ".\secrets-backup"
)

$ErrorActionPreference = "Continue"

if (!(Test-Path $SecretsDir)) {
    Write-Host "❌ Error: Directory $SecretsDir does not exist" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Importing secrets to project: $NewProjectId" -ForegroundColor Cyan
Write-Host "📁 Reading from directory: $SecretsDir" -ForegroundColor Cyan
Write-Host ""

# Switch to new project
gcloud config set project $NewProjectId

# Get all secret files
$SecretFiles = Get-ChildItem -Path $SecretsDir -Filter "*.txt"

# Counter
$count = 0
$total = ($SecretFiles | Measure-Object).Count

# Import each secret
foreach ($secretFile in $SecretFiles) {
    $count++

    # Extract secret name from filename
    $secretName = $secretFile.BaseName

    Write-Host "[$count/$total] Importing: $secretName" -ForegroundColor Yellow

    try {
        # Check if secret already exists
        $exists = gcloud secrets describe $secretName 2>$null

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ℹ️  Secret already exists, adding new version" -ForegroundColor Blue
            Get-Content $secretFile.FullName -Raw | gcloud secrets versions add $secretName --data-file=- 2>$null
        } else {
            Write-Host "  ✨ Creating new secret" -ForegroundColor Magenta
            Get-Content $secretFile.FullName -Raw | gcloud secrets create $secretName --data-file=- --replication-policy="automatic" 2>$null
        }

        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Imported successfully" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Failed to import" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "🎉 Import completed!" -ForegroundColor Green
Write-Host "📊 Total secrets imported: $count" -ForegroundColor Cyan
Write-Host "🔐 Project: $NewProjectId" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Next steps:" -ForegroundColor Green
Write-Host "   1. Verify secrets: gcloud secrets list" -ForegroundColor Yellow
Write-Host "   2. Update service account permissions" -ForegroundColor Yellow
Write-Host "   3. Deploy your application" -ForegroundColor Yellow
