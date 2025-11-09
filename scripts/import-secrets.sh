#!/bin/bash

# Import secrets to a new Google Cloud project from local files
# Usage: ./import-secrets.sh [secrets-directory] [new-project-id]

set -e

SECRETS_DIR="${1:-./secrets-backup}"
NEW_PROJECT_ID="${2}"

if [ -z "$NEW_PROJECT_ID" ]; then
  echo "❌ Error: New project ID is required"
  echo "Usage: ./import-secrets.sh [secrets-directory] [new-project-id]"
  exit 1
fi

if [ ! -d "$SECRETS_DIR" ]; then
  echo "❌ Error: Directory $SECRETS_DIR does not exist"
  exit 1
fi

echo "📦 Importing secrets to project: $NEW_PROJECT_ID"
echo "📁 Reading from directory: $SECRETS_DIR"
echo ""

# Switch to new project
gcloud config set project "$NEW_PROJECT_ID"

# Counter
count=0
total=$(find "$SECRETS_DIR" -name "*.txt" | wc -l)

# Import each secret
for secret_file in "$SECRETS_DIR"/*.txt; do
  count=$((count + 1))

  # Extract secret name from filename
  secret_name=$(basename "$secret_file" .txt)

  echo "[$count/$total] Importing: $secret_name"

  # Create secret (if it doesn't exist)
  if gcloud secrets describe "$secret_name" &>/dev/null; then
    echo "  ℹ️  Secret already exists, adding new version"
    cat "$secret_file" | gcloud secrets versions add "$secret_name" --data-file=-
  else
    echo "  ✨ Creating new secret"
    cat "$secret_file" | gcloud secrets create "$secret_name" --data-file=- --replication-policy="automatic"
  fi

  if [ $? -eq 0 ]; then
    echo "  ✅ Imported successfully"
  else
    echo "  ❌ Failed to import"
  fi
done

echo ""
echo "🎉 Import completed!"
echo "📊 Total secrets imported: $count"
echo "🔐 Project: $NEW_PROJECT_ID"
echo ""
echo "✅ Next steps:"
echo "   1. Verify secrets: gcloud secrets list"
echo "   2. Update service account permissions"
echo "   3. Deploy your application"
