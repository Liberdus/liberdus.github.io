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
# 2. The lib-lp-staking-frontend repository must be in the same parent directory as liberdus.github.io
#    example structure:
#    /path/to/parent/
#    ├── liberdus.github.io/     (this repo, contains this script)
#    └── lib-lp-staking-frontend/ (source repo)
# 3. The script must have execute permissions: chmod +x update-farm.sh
#
# USAGE:
# 1. Run the script from anywhere: ./update-farm.sh
#    (or: cd liberdus.github.io && ./update-farm.sh)
#
# WHAT IT DOES:
# - Copies all files from lib-lp-staking-frontend/* to liberdus.github.io/farm/
# - Excludes README.md and legacy folder
# - Replaces existing files in the farm folder
# - Preserves directory structure
# - Removes files that no longer exist in the source (syncs the folders)
# - Increments the patch version in farm/version.html by 1
#
# =============================================================================

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The script should be in liberdus.github.io, so that's our repo root
REPO_DIR="$SCRIPT_DIR"

# Source directory is in the sibling lib-lp-staking-frontend directory
SOURCE_DIR="$(dirname "$REPO_DIR")/lib-lp-staking-frontend"

# Target directory is the farm folder in this repo
TARGET_DIR="$REPO_DIR/farm"

# Change to the repo directory
cd "$REPO_DIR" || exit 1

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please ensure lib-lp-staking-frontend exists in the same parent directory"
    exit 1
fi

# Check if source directory is empty
if [ -z "$(ls -A "$SOURCE_DIR")" ]; then
    echo "Error: Source directory is empty: $SOURCE_DIR"
    exit 1
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory not found: $TARGET_DIR"
    exit 1
fi

# Read current version from target before copying
VERSION_FILE="$TARGET_DIR/version.html"
current_version="1.0.0"
if [ -f "$VERSION_FILE" ]; then
    current_version=$(cat "$VERSION_FILE" | tr -d '[:space:]')
fi

echo "Updating farm folder from lib-lp-staking-frontend..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Current version: $current_version"

# Copy all files and directories from source to target
# Using rsync for better control with exclusions
if command -v rsync &> /dev/null; then
    # Use rsync for efficient copying with exclusions
    # Exclude README.md, legacy folder, and hidden files like .git
    rsync -av --delete \
        --exclude='README.md' \
        --exclude='README' \
        --exclude='legacy/' \
        --exclude='legacy' \
        --exclude='.git/' \
        --exclude='.git' \
        --exclude='.gitignore' \
        "$SOURCE_DIR/" "$TARGET_DIR/"
else
    # Fallback to cp if rsync is not available
    echo "Warning: rsync not found, using cp. This will overwrite all files."
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
    
    # Temporarily copy everything
    temp_dir=$(mktemp -d)
    cp -r "$SOURCE_DIR"/* "$temp_dir/" 2>/dev/null || true
    
    # Remove excluded items
    rm -f "$temp_dir/README.md" "$temp_dir/README" 2>/dev/null || true
    rm -rf "$temp_dir/legacy" 2>/dev/null || true
    
    # Remove all files and directories in target (except .git if it exists and version.html)
    find "$TARGET_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' ! -name 'version.html' -exec rm -rf {} +
    
    # Copy all files from temp to target
    cp -r "$temp_dir"/* "$TARGET_DIR/" 2>/dev/null || true
    
    # Clean up temp directory
    rm -rf "$temp_dir"
fi

# Remove excluded items if they were copied (safety check)
if [ -f "$TARGET_DIR/README.md" ]; then
    rm -f "$TARGET_DIR/README.md"
    echo "Removed README.md from target"
fi
if [ -d "$TARGET_DIR/legacy" ]; then
    rm -rf "$TARGET_DIR/legacy"
    echo "Removed legacy folder from target"
fi

# Increment the version (patch version)
if [[ $current_version =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    patch="${BASH_REMATCH[3]}"
    new_patch=$((patch + 1))
    new_version="${major}.${minor}.${new_patch}"
else
    # Fallback if version format is not found - try to increment as number
    if [[ $current_version =~ ^([0-9]+)\.([0-9]+)$ ]]; then
        major="${BASH_REMATCH[1]}"
        minor="${BASH_REMATCH[2]}"
        new_minor=$((minor + 1))
        new_version="${major}.${new_minor}"
    else
        # Default fallback
        echo "Warning: Could not parse version format, using default increment"
        new_version="1.0.1"
    fi
fi

# Write the new version to version.html
echo "$new_version" > "$VERSION_FILE"

# Verify the copy operation
if [ $? -eq 0 ]; then
    echo "Farm update completed successfully!"
    echo "Files copied from: $SOURCE_DIR"
    echo "Files copied to: $TARGET_DIR"
    echo "Version updated from $current_version to $new_version"
    
    # Show some statistics
    file_count=$(find "$TARGET_DIR" -type f | wc -l)
    echo "Total files in farm folder: $file_count"
else
    echo "Error: Copy operation failed"
    exit 1
fi



