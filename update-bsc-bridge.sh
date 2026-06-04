#!/bin/bash

# =============================================================================
# UPDATE BSC BRIDGE SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the production hosted bridge by copying files
#          from liberdus-bsc-bridge-ui to liberdus.github.io/bsc-bridge
#
# SOURCE PATH RESOLUTION:
# 1. Preferred: ../liberdus-bridge/liberdus-bsc-bridge-ui
# 2. Fallback:  ../liberdus-bsc-bridge-ui
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. One of the supported source directories must exist
# 3. The script must have execute permissions: chmod +x update-bsc-bridge.sh
#
# USAGE:
#   ./update-bsc-bridge.sh
#
# Optional environment variables:
#   SOURCE_BRANCH=main          Branch to checkout in source (default: main)
#   SKIP_SOURCE_GIT_SYNC=1      Skip fetch/checkout/pull/submodule (use current tree)
#
# WHAT IT DOES:
# - Ensures liberdus-bsc-bridge-ui is on SOURCE_BRANCH with latest origin (ff-only pull)
# - Initializes vendor/liberdus-wallet-module in the source repo before rsync
# - Copies the bridge UI into bsc-bridge (excludes dev-only files)
# - Sets js/config.js RUNTIME.PROFILE to prod
# - Increments CONFIG.APP.VERSION patch in js/config.js
# - Refreshes version.html with the current timestamp for cache busting
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
PARENT_DIR="$(dirname "$REPO_DIR")"

PREFERRED_SOURCE_DIR="$PARENT_DIR/liberdus-bridge/liberdus-bsc-bridge-ui"
FALLBACK_SOURCE_DIR="$PARENT_DIR/liberdus-bsc-bridge-ui"
TARGET_DIR="$REPO_DIR/bsc-bridge"
SOURCE_BRANCH="${SOURCE_BRANCH:-main}"
WALLET_VENDOR_REL="vendor/liberdus-wallet-module"
RUNTIME_PROFILE="prod"

if [ -d "$PREFERRED_SOURCE_DIR" ]; then
  SOURCE_DIR="$PREFERRED_SOURCE_DIR"
elif [ -d "$FALLBACK_SOURCE_DIR" ]; then
  SOURCE_DIR="$FALLBACK_SOURCE_DIR"
else
  echo "Error: Source directory not found."
  echo "Checked:"
  echo "  $PREFERRED_SOURCE_DIR"
  echo "  $FALLBACK_SOURCE_DIR"
  exit 1
fi

cd "$REPO_DIR"

if [ -z "$(ls -A "$SOURCE_DIR")" ]; then
  echo "Error: Source directory is empty: $SOURCE_DIR"
  exit 1
fi

if [ ! -f "$SOURCE_DIR/index.html" ]; then
  echo "Error: index.html not found in source directory: $SOURCE_DIR"
  exit 1
fi

if [ ! -f "$SOURCE_DIR/js/config.js" ]; then
  echo "Error: js/config.js not found in source directory: $SOURCE_DIR"
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
    echo "Error: liberdus-bsc-bridge-ui has uncommitted changes."
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

config_file="$TARGET_DIR/js/config.js"
version_file="$TARGET_DIR/version.html"
current_version="0.0.0"

if [ -f "$config_file" ]; then
  current_version="$(sed -n "s/.*VERSION:[[:space:]]*'\\([^']*\\)'.*/\\1/p" "$config_file" | head -n1)"
fi

sync_source_repo
init_source_submodules

timestamp="$(date +"%Y.%m.%d.%H.%M")"

echo "Updating bsc-bridge..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Runtime profile: $RUNTIME_PROFILE"
echo "Current APP.VERSION: $current_version"

if ! command -v rsync &> /dev/null; then
  echo "Error: rsync is required for update-bsc-bridge.sh"
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
  --exclude='.codex-local' \
  --exclude='*.log' \
  --exclude='tests' \
  --exclude='tests/' \
  --exclude='scripts' \
  --exclude='scripts/' \
  --exclude='docs' \
  --exclude='docs/' \
  --exclude='LICENSE' \
  --exclude='README.md' \
  --exclude='*.md' \
  --exclude='*.MD' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='vitest.config.mjs' \
  --exclude='vendor/liberdus-wallet-module/test' \
  --exclude='vendor/liberdus-wallet-module/demo.html' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

rm -rf "$TARGET_DIR/.github" "$TARGET_DIR/tests" "$TARGET_DIR/node_modules" 2>/dev/null || true

if [ ! -f "$config_file" ]; then
  echo "Error: Missing config file after sync: $config_file"
  exit 1
fi

sed -i "/RUNTIME: {/,/}/ s/PROFILE: '[^']*'/PROFILE: '$RUNTIME_PROFILE'/" "$config_file"

new_version=""
if [[ "$current_version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  patch=$((10#${BASH_REMATCH[3]} + 1))
  new_version="$major.$minor.$patch"
  sed -i "s/\\(VERSION:[[:space:]]*'\\)[^']*\\('\\)/\\1${new_version}\\2/" "$config_file"
  echo "APP.VERSION bumped: $current_version -> $new_version"
else
  echo "Warning: Could not parse APP.VERSION ('$current_version'); expected semver X.Y.Z. Skipping version bump."
fi

echo "$timestamp" > "$version_file"

if [ ! -f "$TARGET_DIR/index.html" ]; then
  echo "Error: Missing index.html after sync: $TARGET_DIR/index.html"
  exit 1
fi

if [ ! -f "$version_file" ]; then
  echo "Error: Missing version.html after update: $version_file"
  exit 1
fi

if [ ! -f "$TARGET_DIR/$WALLET_VENDOR_REL/index.js" ]; then
  echo "Error: Missing $TARGET_DIR/$WALLET_VENDOR_REL/index.js after sync"
  exit 1
fi

if ! grep -q 'isEvmProvider' "$TARGET_DIR/$WALLET_VENDOR_REL/core/discovery.js" 2>/dev/null; then
  echo "Warning: bsc-bridge vendor discovery.js may be missing EVM filter (isEvmProvider)"
fi

if ! grep -q "PROFILE: '$RUNTIME_PROFILE'" "$config_file"; then
  echo "Error: Failed to set runtime profile in $config_file"
  exit 1
fi

if [[ -n "$new_version" ]] && ! grep -Fq "VERSION: '$new_version'" "$config_file"; then
  echo "Error: Failed to set APP.VERSION in $config_file"
  exit 1
fi

file_count=$(find "$TARGET_DIR" -type f | wc -l)
echo "BSC bridge update completed successfully."
echo "Source used: $SOURCE_DIR"
if [[ -n "$new_version" ]]; then
  echo "APP.VERSION: $new_version"
fi
echo "Version timestamp written: $timestamp"
echo "Published wallet module files from source pin: $(git -C "$SOURCE_DIR/$WALLET_VENDOR_REL" rev-parse --short HEAD)"
echo "Total files in bsc-bridge folder: $file_count"
