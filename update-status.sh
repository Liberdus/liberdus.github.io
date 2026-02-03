#!/bin/bash

# =============================================================================
# UPDATE STATUS FRONTEND SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the status frontend by copying files from
#          Status to liberdus.github.io/status.
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. The Status directory must be in the same parent directory as liberdus.github.io
#    example structure:
#    /path/to/parent/
#    ├── liberdus.github.io/     (this repo, contains this script)
#    └── Status/                 (source directory)
# 3. The script must have execute permissions: chmod +x update-status.sh
#
# USAGE:
# 1. Run the script from anywhere: ./update-status.sh
#    (or: cd liberdus.github.io && ./update-status.sh)
#
# WHAT IT DOES:
# - Copies all files from Status/* to liberdus.github.io/status/
# - Excludes backend files, build artifacts, and editor junk
# - Replaces existing files in the status folder
# - Preserves directory structure
# - Removes files that no longer exist in the source (syncs the folders)
#
# =============================================================================

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The script should be in liberdus.github.io, so that's our repo root
REPO_DIR="$SCRIPT_DIR"

# Source directory is in the sibling Status directory
SOURCE_DIR="$(dirname "$REPO_DIR")/Status"

# Target directory is the status folder in this repo
TARGET_DIR="$REPO_DIR/status"

# Change to the repo directory
cd "$REPO_DIR" || exit 1

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please ensure Status exists in the same parent directory as liberdus.github.io"
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

echo "Updating status frontend..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"

# Copy all files and directories from source to target
# Using rsync for better control with exclusions
rsync -av --delete \
  --exclude='.git' \
  --exclude='.gitignore' \
  --exclude='.DS_Store' \
  --exclude='Thumbs.db' \
  --exclude='*.swp' \
  --exclude='*.tmp' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='*.log' \
  --exclude='documentation' \
  --exclude='backup' \
  --exclude='Status-Backend' \
  --exclude='backend-server.js' \
  --exclude='services.json' \
  --exclude='status-history.db' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

# Verify the copy operation
if [ $? -eq 0 ]; then
    echo "Status frontend update completed successfully!"
    echo "Files copied from: $SOURCE_DIR"
    echo "Files copied to: $TARGET_DIR"

    # Show some statistics
    file_count=$(find "$TARGET_DIR" -type f | wc -l)
    echo "Total files in Status folder: $file_count"
else
    echo "Error: Copy operation failed"
    exit 1
fi
