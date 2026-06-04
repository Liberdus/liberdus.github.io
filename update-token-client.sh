#!/bin/bash

# =============================================================================
# UPDATE TOKEN CLIENT SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the token UI by copying files from
#          liberdus-token-ui to liberdus.github.io/token
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. The liberdus-token-ui repository must be in the same parent directory
#    example structure:
#    /path/to/parent/
#    ├── liberdus.github.io/     (this repo, contains this script)
#    └── liberdus-token-ui/      (source repo)
# 3. The script must have execute permissions: chmod +x update-token-client.sh
#
# USAGE:
#   ./update-token-client.sh
#
# Optional environment variables:
#   SOURCE_BRANCH=main          Branch to checkout in source (default: main)
#   SKIP_SOURCE_GIT_SYNC=1      Skip fetch/checkout/pull/submodule (use current tree)
#
# WHAT IT DOES:
# - Ensures liberdus-token-ui is on SOURCE_BRANCH with latest origin (ff-only pull)
# - Initializes vendor/liberdus-wallet-module in the source repo before rsync
# - Copies static runtime files from liberdus-token-ui/* to liberdus.github.io/token/
# - Excludes build artifacts, tests, docs, package files, local scripts, git files
# - Excludes vendor wallet-module test/demo from the published copy
# - Increments VERSION patch in token/js/config.js
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
SOURCE_DIR="$(dirname "$REPO_DIR")/liberdus-token-ui"
TARGET_DIR="$REPO_DIR/token"
SOURCE_BRANCH="${SOURCE_BRANCH:-main}"
WALLET_VENDOR_REL="vendor/liberdus-wallet-module"

cd "$REPO_DIR"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please ensure liberdus-token-ui exists in the same parent directory as liberdus.github.io"
    exit 1
fi

if [ -z "$(ls -A "$SOURCE_DIR")" ]; then
    echo "Error: Source directory is empty: $SOURCE_DIR"
    exit 1
fi

mkdir -p "$TARGET_DIR"

sync_source_repo() {
    if [ "${SKIP_SOURCE_GIT_SYNC:-}" = "1" ]; then
        echo "Skipping source git sync (SKIP_SOURCE_GIT_SYNC=1)"
        return 0
    fi

    if [ ! -d "$SOURCE_DIR/.git" ]; then
        echo "Error: $SOURCE_DIR is not a git repository"
        exit 1
    fi

    echo "Syncing source repo: $SOURCE_DIR"
    echo "Target branch: $SOURCE_BRANCH"

    if ! git -C "$SOURCE_DIR" diff-index --quiet HEAD -- 2>/dev/null; then
        echo "Error: liberdus-token-ui has uncommitted changes."
        echo "Commit, stash, or set SKIP_SOURCE_GIT_SYNC=1 to use the current tree."
        exit 1
    fi

    git -C "$SOURCE_DIR" fetch origin

    if ! git -C "$SOURCE_DIR" checkout "$SOURCE_BRANCH"; then
        echo "Error: Could not checkout branch $SOURCE_BRANCH in $SOURCE_DIR"
        exit 1
    fi

    if ! git -C "$SOURCE_DIR" pull --ff-only origin "$SOURCE_BRANCH"; then
        echo "Error: fast-forward pull failed for origin/$SOURCE_BRANCH"
        echo "Resolve the source repo manually, then re-run this script."
        exit 1
    fi

    echo "Source at: $(git -C "$SOURCE_DIR" rev-parse --short HEAD) ($(git -C "$SOURCE_DIR" log -1 --format='%s'))"
}

init_source_submodules() {
    echo "Initializing source submodules..."
    if ! git -C "$SOURCE_DIR" submodule update --init --recursive "$WALLET_VENDOR_REL"; then
        echo "Error: Failed to initialize $WALLET_VENDOR_REL in $SOURCE_DIR"
        exit 1
    fi

    if [ ! -f "$SOURCE_DIR/$WALLET_VENDOR_REL/index.js" ]; then
        echo "Error: Missing $SOURCE_DIR/$WALLET_VENDOR_REL/index.js after submodule init"
        exit 1
    fi

    echo "Wallet module pin: $(git -C "$SOURCE_DIR/$WALLET_VENDOR_REL" rev-parse --short HEAD)"
    git -C "$SOURCE_DIR/$WALLET_VENDOR_REL" log -1 --oneline
}

CONFIG_TGT="$TARGET_DIR/js/config.js"
current_version="0.0.0"

if [ -f "$CONFIG_TGT" ]; then
    current_version=$(grep -oP "VERSION: '\K[0-9.]+" "$CONFIG_TGT" 2>/dev/null || echo "0.0.0")
fi

sync_source_repo
init_source_submodules

echo "Updating token frontend..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Current version: $current_version"

if ! command -v rsync &> /dev/null; then
    echo "Error: rsync is required for update-token-client.sh"
    exit 1
fi

IFS=. read -r maj min patch _ <<< "${current_version}.0"
patch=$((patch + 1))
new_version="$maj.$min.$patch"

rsync -av --delete --delete-excluded \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.gitignore' \
  --exclude='.github' \
  --exclude='.github/' \
  --exclude='.idea' \
  --exclude='.DS_Store' \
  --exclude='.vscode' \
  --exclude='.cursor' \
  --exclude='.cursor/' \
  --exclude='.cursorrles' \
  --exclude='*.log' \
  --exclude='docs' \
  --exclude='docs/' \
  --exclude='scripts' \
  --exclude='scripts/' \
  --exclude='*.md' \
  --exclude='*.MD' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='.gitmodules' \
  --exclude='vendor/liberdus-wallet-module/test' \
  --exclude='vendor/liberdus-wallet-module/demo.html' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

echo "Updating version in token/js/config.js..."
if [ -f "$TARGET_DIR/js/config.js" ]; then
    sed -i "s/VERSION: '[0-9.]*'/VERSION: '$new_version'/" "$TARGET_DIR/js/config.js"
    echo "Set VERSION to $new_version (was $current_version)"
else
    echo "Error: token/js/config.js not found after sync"
    exit 1
fi

if [ ! -f "$TARGET_DIR/index.html" ]; then
    echo "Error: index.html not found in token folder"
    exit 1
fi

if [ ! -f "$TARGET_DIR/$WALLET_VENDOR_REL/index.js" ]; then
    echo "Error: Missing $TARGET_DIR/$WALLET_VENDOR_REL/index.js after sync"
    exit 1
fi

if ! grep -q 'isEvmProvider' "$TARGET_DIR/$WALLET_VENDOR_REL/core/discovery.js" 2>/dev/null; then
    echo "Warning: token vendor discovery.js may be missing EVM filter (isEvmProvider)"
fi

file_count=$(find "$TARGET_DIR" -type f | wc -l)
echo "Token update completed successfully!"
echo "Files copied from: $SOURCE_DIR"
echo "Files copied to: $TARGET_DIR"
echo "Version updated from $current_version to $new_version"
echo "Published wallet module files from source pin: $(git -C "$SOURCE_DIR/$WALLET_VENDOR_REL" rev-parse --short HEAD)"
echo "Total files in token folder: $file_count"
