#!/bin/bash

# =============================================================================
# UPDATE OTC CLIENT SCRIPT
# =============================================================================
#
# PURPOSE: Updates liberdus.github.io/otc from otc-web-client (production OTC UI).
#
# PREREQUISITES:
# 1. This script lives in liberdus.github.io/
# 2. otc-web-client is a sibling directory:
#    /path/to/parent/
#    ├── liberdus.github.io/
#    └── otc-web-client/
# 3. chmod +x update-otc-client.sh
#
# USAGE:
#   ./update-otc-client.sh
#
# Optional environment variables:
#   SOURCE_BRANCH=main          Branch to checkout in source (default: main)
#   SKIP_SOURCE_GIT_SYNC=1      Skip fetch/checkout/pull/submodule (use current tree)
#
# WHAT IT DOES:
# - Ensures otc-web-client is on SOURCE_BRANCH with latest origin (ff-only pull)
# - Initializes vendor/liberdus-wallet-module before rsync
# - Mirrors runtime files into otc/ (excludes dev-only paths)
# - Increments vX.Y.Z in otc/index.html (from current published version)
# - Writes otc/version.html timestamp and cache-busts css/styles.css + js/app.js
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
SOURCE_DIR="$(dirname "$REPO_DIR")/otc-web-client"
TARGET_DIR="$REPO_DIR/otc"
SOURCE_BRANCH="${SOURCE_BRANCH:-main}"
WALLET_VENDOR_REL="vendor/liberdus-wallet-module"

cd "$REPO_DIR"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please ensure otc-web-client exists in the same parent directory as liberdus.github.io"
    exit 1
fi

if [ -z "$(ls -A "$SOURCE_DIR")" ]; then
    echo "Error: Source directory is empty: $SOURCE_DIR"
    exit 1
fi

if [ ! -f "$SOURCE_DIR/index.html" ]; then
    echo "Error: index.html not found in source: $SOURCE_DIR"
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
        echo "Error: otc-web-client has uncommitted changes."
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

index_file="$TARGET_DIR/index.html"
current_version="1.0.0"

if [ -f "$index_file" ]; then
    current_version=$(grep -oP '(?<=v)[0-9]+\.[0-9]+\.[0-9]+' "$index_file" | head -1 || true)
fi
[ -z "$current_version" ] && current_version="1.0.0"

sync_source_repo
init_source_submodules

if [[ $current_version =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    patch="${BASH_REMATCH[3]}"
    new_patch=$((patch + 1))
    new_version="${major}.${minor}.${new_patch}"
else
    echo "Warning: Could not parse version from published index.html; using 1.0.1"
    new_version="1.0.1"
fi

timestamp="$(date +"%Y.%m.%d.%H.%M")"

echo "Updating otc frontend..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Published version bump: $current_version -> $new_version"

if ! command -v rsync &> /dev/null; then
    echo "Error: rsync is required for update-otc-client.sh"
    exit 1
fi

rsync -av --delete --delete-excluded \
  --exclude='.git' \
  --exclude='.gitignore' \
  --exclude='.gitmodules' \
  --exclude='.github' \
  --exclude='.github/' \
  --exclude='node_modules' \
  --exclude='.idea' \
  --exclude='.DS_Store' \
  --exclude='.vscode' \
  --exclude='.cursor' \
  --exclude='.cursor/' \
  --exclude='.cursorrles' \
  --exclude='*.log' \
  --exclude='.env' \
  --exclude='/artifacts/' \
  --exclude='/cache/' \
  --exclude='/contracts/' \
  --exclude='/components/' \
  --exclude='/delete_when_done/' \
  --exclude='/depracated/' \
  --exclude='hardhat.config.js' \
  --exclude='playwright.config.cjs' \
  --exclude='tests' \
  --exclude='tests/' \
  --exclude='scripts' \
  --exclude='scripts/' \
  --exclude='debug-flags.patch' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='README.md' \
  --exclude='*.md' \
  --exclude='vendor/liberdus-wallet-module/test' \
  --exclude='vendor/liberdus-wallet-module/demo.html' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

sed -i -E "s/v[0-9]+\.[0-9]+\.[0-9]+/v$new_version/" "$TARGET_DIR/index.html"

echo "$timestamp" > "$TARGET_DIR/version.html"

if grep -q 'href="css/styles\.css\?v=' "$TARGET_DIR/index.html"; then
    sed -i -E "s|(href=\"css/styles\.css\?v=)[^\"]*(\")|\1$timestamp\2|" "$TARGET_DIR/index.html"
else
    sed -i -E "s|(href=\"css/styles\.css)(\")|\1?v=$timestamp\2|" "$TARGET_DIR/index.html"
fi

if grep -q 'src="js/app\.js\?v=' "$TARGET_DIR/index.html"; then
    sed -i -E "s|(src=\"js/app\.js\?v=)[^\"]*(\")|\1$timestamp\2|" "$TARGET_DIR/index.html"
else
    sed -i -E "s|(src=\"js/app\.js)(\")|\1?v=$timestamp\2|" "$TARGET_DIR/index.html"
fi

if [ ! -f "$TARGET_DIR/index.html" ]; then
    echo "Error: otc/index.html missing after sync"
    exit 1
fi

if [ ! -f "$TARGET_DIR/$WALLET_VENDOR_REL/index.js" ]; then
    echo "Error: Missing $TARGET_DIR/$WALLET_VENDOR_REL/index.js after sync"
    exit 1
fi

if ! grep -q 'isEvmProvider' "$TARGET_DIR/$WALLET_VENDOR_REL/core/discovery.js" 2>/dev/null; then
    echo "Warning: otc vendor discovery.js may be missing EVM filter (isEvmProvider)"
fi

if ! grep -q "v$new_version" "$TARGET_DIR/index.html"; then
    echo "Error: Failed to set version v$new_version in index.html"
    exit 1
fi

file_count=$(find "$TARGET_DIR" -type f | wc -l)
echo "OTC client update completed successfully!"
echo "Files copied from: $SOURCE_DIR"
echo "Files copied to: $TARGET_DIR"
echo "Version: v$current_version -> v$new_version"
echo "version.html: $timestamp"
echo "Published wallet module files from source pin: $(git -C "$SOURCE_DIR/$WALLET_VENDOR_REL" rev-parse --short HEAD)"
echo "Total files in otc folder: $file_count"
