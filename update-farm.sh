#!/bin/bash

# =============================================================================
# UPDATE FARM SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the farm folder by copying files from
#          lib-lp-staking-frontend to liberdus.github.io/farm
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. The lib-lp-staking-frontend repository must be in the same parent directory
#    example structure:
#    /path/to/parent/
#    ├── liberdus.github.io/     (this repo, contains this script)
#    └── lib-lp-staking-frontend/ (source repo)
# 3. The script must have execute permissions: chmod +x update-farm.sh
#
# USAGE:
#   ./update-farm.sh
#
# Optional environment variables:
#   SOURCE_BRANCH=main          Branch to checkout in source (default: main)
#   SKIP_SOURCE_GIT_SYNC=1      Skip fetch/checkout/pull/submodule (use current tree)
#
# WHAT IT DOES:
# - Ensures lib-lp-staking-frontend is on SOURCE_BRANCH with latest origin (ff-only pull)
# - Initializes vendor/liberdus-wallet-module in the source repo before rsync
# - Copies lib-lp-staking-frontend/* to liberdus.github.io/farm/ (excludes migration/, tests, etc.)
# - Excludes vendor wallet-module test/demo from the published copy
# - Increments the patch version in farm/version.html by 1
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
SOURCE_DIR="$(dirname "$REPO_DIR")/lib-lp-staking-frontend"
TARGET_DIR="$REPO_DIR/farm"
SOURCE_BRANCH="${SOURCE_BRANCH:-main}"
WALLET_VENDOR_REL="vendor/liberdus-wallet-module"

cd "$REPO_DIR"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please ensure lib-lp-staking-frontend exists in the same parent directory"
    exit 1
fi

if [ -z "$(ls -A "$SOURCE_DIR")" ]; then
    echo "Error: Source directory is empty: $SOURCE_DIR"
    exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory not found: $TARGET_DIR"
    exit 1
fi

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
        echo "Error: lib-lp-staking-frontend has uncommitted changes."
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

VERSION_FILE="$TARGET_DIR/version.html"
current_version="1.0.0"
if [ -f "$VERSION_FILE" ]; then
    current_version=$(cat "$VERSION_FILE" | tr -d '[:space:]')
fi

sync_source_repo
init_source_submodules

echo "Updating farm folder from lib-lp-staking-frontend..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Current version: $current_version"

if ! command -v rsync &> /dev/null; then
    echo "Error: rsync is required for update-farm.sh"
    exit 1
fi

rsync -av --delete \
    --exclude='README.md' \
    --exclude='README' \
    --exclude='legacy/' \
    --exclude='legacy' \
    --exclude='/migration/' \
    --exclude='.git/' \
    --exclude='.git' \
    --exclude='.gitignore' \
    --exclude='/.github/' \
    --exclude='/tests/' \
    --exclude='/package.json' \
    --exclude='/package-lock.json' \
    --exclude='vendor/liberdus-wallet-module/test' \
    --exclude='vendor/liberdus-wallet-module/demo.html' \
    "$SOURCE_DIR/" "$TARGET_DIR/"

if [ -f "$TARGET_DIR/README.md" ]; then
    rm -f "$TARGET_DIR/README.md"
    echo "Removed README.md from target"
fi
if [ -d "$TARGET_DIR/legacy" ]; then
    rm -rf "$TARGET_DIR/legacy"
    echo "Removed legacy folder from target"
fi

if [[ $current_version =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    patch="${BASH_REMATCH[3]}"
    new_patch=$((patch + 1))
    new_version="${major}.${minor}.${new_patch}"
elif [[ $current_version =~ ^([0-9]+)\.([0-9]+)$ ]]; then
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    new_minor=$((minor + 1))
    new_version="${major}.${new_minor}"
else
    echo "Warning: Could not parse version format, using default increment"
    new_version="1.0.1"
fi

echo "$new_version" > "$VERSION_FILE"

if [ ! -f "$TARGET_DIR/$WALLET_VENDOR_REL/index.js" ]; then
    echo "Error: Missing $TARGET_DIR/$WALLET_VENDOR_REL/index.js after sync"
    exit 1
fi

if ! grep -q 'isEvmProvider' "$TARGET_DIR/$WALLET_VENDOR_REL/core/discovery.js" 2>/dev/null; then
    echo "Warning: farm vendor discovery.js may be missing EVM filter (isEvmProvider)"
fi

file_count=$(find "$TARGET_DIR" -type f | wc -l)
echo "Farm update completed successfully!"
echo "Files copied from: $SOURCE_DIR"
echo "Files copied to: $TARGET_DIR"
echo "Version updated from $current_version to $new_version"
echo "Published wallet module: $(git -C "$TARGET_DIR/$WALLET_VENDOR_REL" rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "Total files in farm folder: $file_count"
