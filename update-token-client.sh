#!/bin/bash

# =============================================================================
# UPDATE TOKEN CLIENT SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the token UI by copying files from
#          liberdus-dao-ui/liberdus-token-ui to liberdus.github.io/token
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. The liberdus-dao-ui directory must be in the same parent directory as liberdus.github.io
#    example structure:
#    /path/to/parent/
#    ├── liberdus.github.io/     (this repo, contains this script)
#    └── liberdus-dao-ui/        (source, copied from libedus-dao-ui-new)
# 3. The script must have execute permissions: chmod +x update-token-client.sh
#
# USAGE:
# 1. Run the script from anywhere: ./update-token-client.sh
#    (or: cd liberdus.github.io && ./update-token-client.sh)
#
# WHAT IT DOES:
# - Copies all files from liberdus-dao-ui/liberdus-token-ui/* to liberdus.github.io/token/
# - Excludes node_modules, .git, and other build/IDE artifacts
# - Mirrors source to target (removes files not in source)
# - Increments VERSION in token/js/config.js (patch increment: 0.0.X -> 0.0.X+1)
#
# =============================================================================

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The script should be in liberdus.github.io, so that's our repo root
REPO_DIR="$SCRIPT_DIR"

# Source directory is in the sibling liberdus-dao-ui directory
SOURCE_DIR="$(dirname "$REPO_DIR")/liberdus-dao-ui/liberdus-token-ui"

# Target directory is the token folder in this repo
TARGET_DIR="$REPO_DIR/token"

# Change to the repo directory
cd "$REPO_DIR" || exit 1

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please ensure liberdus-dao-ui is in the same parent directory as liberdus.github.io"
    exit 1
fi

# Check if source directory is empty
if [ -z "$(ls -A "$SOURCE_DIR")" ]; then
    echo "Error: Source directory is empty: $SOURCE_DIR"
    exit 1
fi

# Create target directory if it doesn't exist
if [ ! -d "$TARGET_DIR" ]; then
    mkdir -p "$TARGET_DIR"
    echo "Created target directory: $TARGET_DIR"
fi

echo "Copying token UI contents..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Note: If no files are listed, source and target are identical."

# Read current VERSION (prefer target's existing version)
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

# Parse semver and increment patch (0.0.X -> 0.0.X+1)
IFS=. read -r maj min patch _ <<< "${current_version}.0"
patch=$((patch + 1))
new_version="$maj.$min.$patch"

# Copy files while excluding build artifacts and IDE config
rsync -av --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.idea' \
  --exclude='.DS_Store' \
  --exclude='.vscode' \
  --exclude='.cursorrles' \
  --exclude='*.log' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

echo "Updating version in token/js/config.js..."
if [ -f "$TARGET_DIR/js/config.js" ]; then
    sed -i "s/VERSION: '[0-9.]*'/VERSION: '$new_version'/" "$TARGET_DIR/js/config.js"
    echo "Set VERSION to $new_version"
else
    echo "Warning: token/js/config.js not found, skipping version bump"
fi

# Debugging output
echo "Current directory: $(pwd)"
echo "Config version source: $SOURCE_DIR/js/config.js"
echo "New VERSION in config.js: $new_version"

# Check that key files exist
if [ ! -f "$TARGET_DIR/index.html" ]; then
    echo "Warning: index.html not found in token folder"
fi

echo "Update completed successfully!"
