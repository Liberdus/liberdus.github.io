#!/bin/bash

# =============================================================================
# UPDATE LOCK SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the production lock frontend by copying files from
#          token-lock-ui to liberdus.github.io/lock.
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. The token-lock-ui repository must be in the same parent directory as liberdus.github.io
#    example structure:
#    /path/to/parent/
#    |-- liberdus.github.io/     (this repo, contains this script)
#    `-- token-lock-ui/          (source repo)
# 3. The script must have execute permissions: chmod +x update-lock.sh
#
# USAGE:
# 1. Run the script from anywhere: ./update-lock.sh
#    (or: cd liberdus.github.io && ./update-lock.sh)
#
# WHAT IT DOES:
# - Initializes token-lock-ui submodules (vendor/liberdus-wallet-module)
# - Copies the static runtime files from token-lock-ui/* to liberdus.github.io/lock/
# - Excludes build artifacts, tests, docs, package files, patches, local scripts, git files, and editor junk
# - Excludes vendor wallet-module test/demo files from the published copy
# - Replaces existing files in the lock folder
# - Increments CONFIG.APP.VERSION patch in lock/js/config.js
#
# =============================================================================

set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The script should be in liberdus.github.io, so that's our repo root
REPO_DIR="$SCRIPT_DIR"

# Source directory is in the sibling token-lock-ui directory
SOURCE_DIR="$(dirname "$REPO_DIR")/token-lock-ui"

# Target directory is the production lock folder in this repo
TARGET_DIR="$REPO_DIR/lock"

# Change to the repo directory
cd "$REPO_DIR"

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please ensure token-lock-ui exists in the same parent directory as liberdus.github.io"
    exit 1
fi

# Check if source directory is empty
if [ -z "$(ls -A "$SOURCE_DIR")" ]; then
    echo "Error: Source directory is empty: $SOURCE_DIR"
    exit 1
fi

# Create target directory if missing
if [ ! -d "$TARGET_DIR" ]; then
    mkdir -p "$TARGET_DIR"
    echo "Created target directory: $TARGET_DIR"
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

echo "Updating lock frontend..."
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

# Copy all files and directories from source to target
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
  --exclude='.next' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='out' \
  --exclude='coverage' \
  --exclude='coverage/' \
  --exclude='playwright-report' \
  --exclude='playwright-report/' \
  --exclude='test-results' \
  --exclude='test-results/' \
  --exclude='tests' \
  --exclude='tests/' \
  --exclude='scripts' \
  --exclude='scripts/' \
  --exclude='patches' \
  --exclude='patches/' \
  --exclude='*.patch' \
  --exclude='*.diff' \
  --exclude='*.md' \
  --exclude='*.MD' \
  --exclude='package.json' \
  --exclude='package-lock.json' \
  --exclude='playwright.config.*' \
  --exclude='*.log' \
  --exclude='.gitmodules' \
  --exclude='vendor/liberdus-wallet-module/test' \
  --exclude='vendor/liberdus-wallet-module/demo.html' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

echo "Updating version in lock/js/config.js..."
if [ -f "$TARGET_DIR/js/config.js" ]; then
    sed -i "s/VERSION: '[0-9.]*'/VERSION: '$new_version'/" "$TARGET_DIR/js/config.js"
    echo "Set VERSION to $new_version"
else
    echo "Warning: lock/js/config.js not found, skipping version bump"
fi

if [ ! -f "$TARGET_DIR/index.html" ]; then
    echo "Error: index.html not found in lock folder"
    exit 1
fi

if [ ! -f "$TARGET_DIR/vendor/liberdus-wallet-module/index.js" ]; then
    echo "Warning: lock/vendor/liberdus-wallet-module/index.js not found after sync"
fi

echo "Lock update completed successfully!"
echo "New VERSION in config.js: $new_version"
echo "Files copied from: $SOURCE_DIR"
echo "Files copied to: $TARGET_DIR"

# Show some statistics
file_count=$(find "$TARGET_DIR" -type f | wc -l)
echo "Total files in lock folder: $file_count"
