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
# WHAT IT DOES:
# - Copies the bridge UI into bsc-bridge
# - Removes development-only files that should not be published to GitHub Pages
# - Sets js/config.js RUNTIME.PROFILE to prod
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

cd "$REPO_DIR" || exit 1

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

timestamp="$(date +"%Y.%m.%d.%H.%M")"
config_file="$TARGET_DIR/js/config.js"
version_file="$TARGET_DIR/version.html"

mkdir -p "$TARGET_DIR"

echo "Updating bsc-bridge..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Runtime profile: $RUNTIME_PROFILE"

rsync -av --delete \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='node_modules' \
  --exclude='.idea' \
  --exclude='.DS_Store' \
  --exclude='.vscode' \
  --exclude='.cursorrles' \
  --exclude='.codex-local' \
  --exclude='*.log' \
  --exclude='tests' \
  --exclude='.gitignore' \
  --exclude='LICENSE' \
  --exclude='README.md' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='vitest.config.mjs' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

rm -rf "$TARGET_DIR/.github" "$TARGET_DIR/tests" "$TARGET_DIR/node_modules"
rm -f \
  "$TARGET_DIR/.gitignore" \
  "$TARGET_DIR/LICENSE" \
  "$TARGET_DIR/README.md" \
  "$TARGET_DIR/package.json" \
  "$TARGET_DIR/package-lock.json" \
  "$TARGET_DIR/vitest.config.mjs"

if [ ! -f "$config_file" ]; then
  echo "Error: Missing config file after sync: $config_file"
  exit 1
fi

sed -i "/RUNTIME: {/,/}/ s/PROFILE: '[^']*'/PROFILE: '$RUNTIME_PROFILE'/" "$config_file"
echo "$timestamp" > "$version_file"

if [ ! -f "$TARGET_DIR/index.html" ]; then
  echo "Error: Missing index.html after sync: $TARGET_DIR/index.html"
  exit 1
fi

if [ ! -f "$version_file" ]; then
  echo "Error: Missing version.html after update: $version_file"
  exit 1
fi

if ! grep -q "PROFILE: '$RUNTIME_PROFILE'" "$config_file"; then
  echo "Error: Failed to set runtime profile in $config_file"
  exit 1
fi

echo "BSC bridge update completed successfully."
echo "Source used: $SOURCE_DIR"
echo "Version timestamp written: $timestamp"
