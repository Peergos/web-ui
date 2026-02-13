#!/bin/bash
set -e

# Usage: ./update-manifest-commit.sh <manifest-file> <new-commit-hash>

MANIFEST_FILE="$1"
NEW_COMMIT="$2"

if [ -z "$MANIFEST_FILE" ] || [ -z "$NEW_COMMIT" ]; then
    echo "Usage: $0 <manifest-file> <new-commit-hash>"
    echo "Example: $0 org.peergos.Peergos.yaml abc123def456"
    exit 1
fi

if [ ! -f "$MANIFEST_FILE" ]; then
    echo "Error: Manifest file '$MANIFEST_FILE' not found"
    exit 1
fi

echo "Updating commit hash in $MANIFEST_FILE to $NEW_COMMIT"

# Use sed to replace the commit line
# This finds lines with "commit:" and replaces the hash
sed -i "s/^\(\s*commit:\s*\).*/\1$NEW_COMMIT/" "$MANIFEST_FILE"

echo "Updated successfully"
echo "New commit hash: $NEW_COMMIT"

# Show the updated section for verification
echo ""
echo "Updated sources section:"
grep -A 2 "type: git" "$MANIFEST_FILE" || true
git diff $1
