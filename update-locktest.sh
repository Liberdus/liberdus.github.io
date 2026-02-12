#!/bin/bash

# =============================================================================
# UPDATE LOCKTEST SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the locktest frontend by copying files from
#          token-lock-ui to liberdus.github.io/locktest.
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. The token-lock-ui repository must be in the same parent directory as liberdus.github.io
#    example structure:
#    /path/to/parent/
#    ├── liberdus.github.io/     (this repo, contains this script)
#    └── token-lock-ui/          (source repo)
# 3. The script must have execute permissions: chmod +x update-locktest.sh
#
# USAGE:
# 1. Run the script from anywhere: ./update-locktest.sh
#    (or: cd liberdus.github.io && ./update-locktest.sh)
#
# WHAT IT DOES:
# - Copies all files from token-lock-ui/* to liberdus.github.io/locktest/
# - Excludes build artifacts, node_modules, git files, and editor junk
# - Replaces existing files in the locktest folder
# - Preserves directory structure
# - Removes files that no longer exist in the source (syncs the folders)
#
# =============================================================================

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The script should be in liberdus.github.io, so that's our repo root
REPO_DIR="$SCRIPT_DIR"

# Source directory is in the sibling token-lock-ui directory
SOURCE_DIR="$(dirname "$REPO_DIR")/token-lock-ui"

# Target directory is the locktest folder in this repo
TARGET_DIR="$REPO_DIR/locktest"

# Change to the repo directory
cd "$REPO_DIR" || exit 1

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

echo "Updating locktest frontend..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"

# Copy all files and directories from source to target
rsync -av --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.idea' \
  --exclude='.DS_Store' \
  --exclude='.vscode' \
  --exclude='.cursorrles' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='out' \
  --exclude='*.log' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

# Verify the copy operation
if [ $? -eq 0 ]; then
    echo "Locktest update completed successfully!"
    echo "Files copied from: $SOURCE_DIR"
    echo "Files copied to: $TARGET_DIR"

    # Show some statistics
    file_count=$(find "$TARGET_DIR" -type f | wc -l)
    echo "Total files in locktest folder: $file_count"
else
    echo "Error: Copy operation failed"
    exit 1
fi
