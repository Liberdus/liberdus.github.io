#!/bin/bash

# =============================================================================
# UPDATE DOCS SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the documentation by copying files from
#          liberdus-docs/build to liberdus.github.io/docs
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. The liberdus-docs repository must be in the same parent directory as liberdus.github.io
#    example structure:
#    /path/to/parent/
#    ├── liberdus.github.io/     (this repo, contains this script)
#    └── liberdus-docs/          (source repo with build folder)
# 3. The liberdus-docs/build folder must exist (run npm run build in liberdus-docs first)
# 4. The script must have execute permissions: chmod +x update-docs.sh
#
# USAGE:
# 1. First, build the docs in liberdus-docs:
#    cd ../liberdus-docs
#    npm run build
# 2. Run the script from anywhere: ./update-docs.sh
#    (or: cd liberdus.github.io && ./update-docs.sh)
#
# WHAT IT DOES:
# - Copies all files from liberdus-docs/build/* to liberdus.github.io/docs/
# - Replaces existing files in the docs folder
# - Preserves directory structure
# - Removes files that no longer exist in the source (syncs the folders)
#
# =============================================================================

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The script should be in liberdus.github.io, so that's our repo root
REPO_DIR="$SCRIPT_DIR"

# Source directory is in the sibling liberdus-docs directory
SOURCE_DIR="$(dirname "$REPO_DIR")/liberdus-docs/build"

# Target directory is the docs folder in this repo
TARGET_DIR="$REPO_DIR/docs-test"

# Change to the repo directory
cd "$REPO_DIR" || exit 1

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please build the docs first by running 'npm run build' in liberdus-docs"
    exit 1
fi

# Check if source directory is empty
if [ -z "$(ls -A "$SOURCE_DIR")" ]; then
    echo "Error: Source directory is empty: $SOURCE_DIR"
    echo "Please build the docs first by running 'npm run build' in liberdus-docs"
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory not found: $TARGET_DIR"
    exit 1
fi

echo "Updating docs folder..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"

# Copy all files and directories from source to target
# Using rsync for better control, or cp -r if rsync is not available
if command -v rsync &> /dev/null; then
    # Use rsync for efficient copying (preserves permissions, can exclude patterns)
    rsync -av --delete "$SOURCE_DIR/" "$TARGET_DIR/"
else
    # Fallback to cp if rsync is not available
    # First, remove all existing files in target (be careful!)
    echo "Warning: rsync not found, using cp. This will overwrite all files."
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    
    # Remove all files and directories in target (except .git if it exists)
    find "$TARGET_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
    
    # Copy all files from source to target
    cp -r "$SOURCE_DIR"/* "$TARGET_DIR/"
fi

# Verify the copy operation
if [ $? -eq 0 ]; then
    echo "Documentation update completed successfully!"
    echo "Files copied from: $SOURCE_DIR"
    echo "Files copied to: $TARGET_DIR"
    
    # Show some statistics
    file_count=$(find "$TARGET_DIR" -type f | wc -l)
    echo "Total files in docs folder: $file_count"
else
    echo "Error: Copy operation failed"
    exit 1
fi
