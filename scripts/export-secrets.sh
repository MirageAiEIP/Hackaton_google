#!/bin/bash

# Export all secrets from Google Cloud Secret Manager to local files
# Usage: ./export-secrets.sh [output-directory]

set -e

OUTPUT_DIR="${1:-./secrets-backup}"
PROJECT_ID=$(gcloud config get-value project)

echo "📦 Exporting secrets from project: $PROJECT_ID"
echo "📁 Output directory: $OUTPUT_DIR"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Get list of all secrets
SECRETS=$(gcloud secrets list --format="value(name)")

# Counter
count=0
total=$(echo "$SECRETS" | wc -l)

# Export each secret
while IFS= read -r secret_name; do
  count=$((count + 1))
  echo "[$count/$total] Exporting: $secret_name"

  # Get the latest version of the secret
  gcloud secrets versions access latest --secret="$secret_name" --project="$PROJECT_ID" > "$OUTPUT_DIR/$secret_name.txt" 2>/dev/null

  if [ $? -eq 0 ]; then
    echo "  ✅ Exported to: $OUTPUT_DIR/$secret_name.txt"
  else
    echo "  ❌ Failed to export: $secret_name"
  fi
done <<< "$SECRETS"

echo ""
echo "🎉 Export completed!"
echo "📊 Total secrets exported: $count"
echo "📁 Location: $OUTPUT_DIR"
echo ""
echo "⚠️  IMPORTANT: These files contain sensitive data!"
echo "   - Do NOT commit them to git"
echo "   - Keep them secure"
echo "   - Delete after migration"
