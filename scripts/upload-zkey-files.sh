#!/bin/bash

# Script to upload large zkey files to GitHub Releases
# This allows us to host the large files externally while keeping the main repo lightweight

set -e

REPO="tokamak-network/Tokamak-zkp-channel-manager"
TAG="zkey-files"
RELEASE_NAME="ZK Circuit Files"
ZKEY_DIR="./proof-generation/zkey"

echo "🚀 Uploading large zkey files to GitHub Releases..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is required. Install it from: https://cli.github.com/"
    exit 1
fi

# Check if logged in to GitHub
if ! gh auth status &> /dev/null; then
    echo "❌ Please authenticate with GitHub CLI: gh auth login"
    exit 1
fi

# Check if zkey files exist
if [ ! -d "$ZKEY_DIR" ]; then
    echo "❌ Directory $ZKEY_DIR not found"
    exit 1
fi

echo "📁 Checking for zkey files in $ZKEY_DIR..."
ZKEY_FILES=(
    "circuit_final_32.zkey"
    "circuit_final_64.zkey" 
    "circuit_final_128.zkey"
)

for file in "${ZKEY_FILES[@]}"; do
    if [ ! -f "$ZKEY_DIR/$file" ]; then
        echo "❌ File $ZKEY_DIR/$file not found"
        exit 1
    fi
    echo "✓ Found $file ($(du -h "$ZKEY_DIR/$file" | cut -f1))"
done

# Create or update release
echo "🏷️  Creating release $TAG..."
if gh release view "$TAG" &> /dev/null; then
    echo "ℹ️  Release $TAG already exists, deleting old assets..."
    for file in "${ZKEY_FILES[@]}"; do
        gh release delete-asset "$TAG" "$file" --yes 2>/dev/null || true
    done
else
    echo "📝 Creating new release..."
    gh release create "$TAG" \
        --title "$RELEASE_NAME" \
        --notes "Large zkey files for zero-knowledge proof circuits. These files are hosted externally due to GitHub repository size limits." \
        --latest=false
fi

# Upload files
echo "📤 Uploading zkey files..."
for file in "${ZKEY_FILES[@]}"; do
    echo "   Uploading $file..."
    gh release upload "$TAG" "$ZKEY_DIR/$file" --clobber
    echo "   ✅ $file uploaded successfully"
done

echo ""
echo "🎉 Upload complete! Files are now available at:"
for file in "${ZKEY_FILES[@]}"; do
    echo "   https://github.com/$REPO/releases/download/$TAG/$file"
done

echo ""
echo "💡 These URLs are already configured in lib/clientProofGeneration.ts"
echo "🚀 Your app can now use larger circuits from external storage!"