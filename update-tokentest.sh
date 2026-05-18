#!/bin/bash

# =============================================================================
# UPDATE TOKENTEST SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the tokentest staging frontend by copying files
#          from liberdus-token-ui to liberdus.github.io/tokentest
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. The liberdus-token-ui repository must be in the same parent directory
#    example structure:
#    /path/to/parent/
#    ├── liberdus.github.io/     (this repo, contains this script)
#    └── liberdus-token-ui/      (source repo)
# 3. The script must have execute permissions: chmod +x update-tokentest.sh
#
# USAGE:
# 1. Run the script from anywhere: ./update-tokentest.sh
#    (or: cd liberdus.github.io && ./update-tokentest.sh)
#
# WHAT IT DOES:
# - Initializes liberdus-token-ui submodules (vendor/liberdus-wallet-module)
# - Copies liberdus-token-ui/* to liberdus.github.io/tokentest/
# - Excludes node_modules, .git, and other build/IDE artifacts
# - Mirrors source to target (removes files not in source)
# - Increments VERSION in tokentest/js/config.js (patch increment: 0.0.X -> 0.0.X+1)
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
SOURCE_DIR="$(dirname "$REPO_DIR")/liberdus-token-ui"
TARGET_DIR="$REPO_DIR/tokentest"

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

echo "Initializing source submodules..."
if ! git -C "$SOURCE_DIR" submodule update --init --recursive; then
    echo "Error: Failed to initialize submodules in $SOURCE_DIR"
    exit 1
fi

if [ ! -f "$SOURCE_DIR/vendor/liberdus-wallet-module/index.js" ]; then
    echo "Warning: vendor/liberdus-wallet-module/index.js not found in source."
    echo "The wallet module submodule may be missing from the checked-out branch."
fi

mkdir -p "$TARGET_DIR"

echo "Copying token UI contents to tokentest..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Note: If no files are listed, source and target are identical."

CONFIG_SRC="$SOURCE_DIR/js/config.js"
CONFIG_TGT="$TARGET_DIR/js/config.js"
current_version="0.0.0"

if [ -f "$CONFIG_SRC" ]; then
    current_version=$(grep -oP "VERSION: '\K[0-9.]+" "$CONFIG_SRC" 2>/dev/null || echo "0.0.0")
fi

if [ -f "$CONFIG_TGT" ]; then
    tgt_ver=$(grep -oP "VERSION: '\K[0-9.]+" "$CONFIG_TGT" 2>/dev/null)
    [ -n "$tgt_ver" ] && current_version="$tgt_ver"
fi

IFS=. read -r maj min patch _ <<< "${current_version}.0"
patch=$((patch + 1))
new_version="$maj.$min.$patch"

rsync -av --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.gitmodules' \
  --exclude='.idea' \
  --exclude='.DS_Store' \
  --exclude='.vscode' \
  --exclude='.cursorrles' \
  --exclude='*.log' \
  --exclude='vendor/liberdus-wallet-module/test' \
  --exclude='vendor/liberdus-wallet-module/demo.html' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

echo "Updating version in tokentest/js/config.js..."
if [ -f "$TARGET_DIR/js/config.js" ]; then
    sed -i "s/VERSION: '[0-9.]*'/VERSION: '$new_version'/" "$TARGET_DIR/js/config.js"
    echo "Set VERSION to $new_version"
else
    echo "Warning: tokentest/js/config.js not found, skipping version bump"
fi

if [ ! -f "$TARGET_DIR/index.html" ]; then
    echo "Error: index.html not found in tokentest folder"
    exit 1
fi

if [ ! -f "$TARGET_DIR/vendor/liberdus-wallet-module/index.js" ]; then
    echo "Warning: tokentest/vendor/liberdus-wallet-module/index.js not found after sync"
fi

echo "Tokentest update completed successfully!"
echo "New VERSION in config.js: $new_version"
