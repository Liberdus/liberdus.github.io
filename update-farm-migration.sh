#!/bin/bash

# =============================================================================
# UPDATE FARM MIGRATION SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the farm/migration folder by copying files from
#          lib-lp-staking-frontend to liberdus.github.io/farm/migration.
#
# Use this after checking out the old-farm-migration branch in the source repo.
#
# Expected sibling directory structure:
# /path/to/parent/
# ├── liberdus.github.io/     (this repo, contains this script)
# └── lib-lp-staking-frontend/ (source repo)
#
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
SOURCE_DIR="$(dirname "$REPO_DIR")/lib-lp-staking-frontend"
TARGET_DIR="$REPO_DIR/farm/migration"

cd "$REPO_DIR" || exit 1

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please ensure lib-lp-staking-frontend exists in the same parent directory"
    exit 1
fi

if [ -z "$(ls -A "$SOURCE_DIR")" ]; then
    echo "Error: Source directory is empty: $SOURCE_DIR"
    exit 1
fi

mkdir -p "$TARGET_DIR"

VERSION_FILE="$TARGET_DIR/version.html"
current_version="1.0.0"
if [ -f "$VERSION_FILE" ]; then
    current_version=$(cat "$VERSION_FILE" | tr -d '[:space:]')
fi

echo "Updating farm migration folder from lib-lp-staking-frontend..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Current version: $current_version"

if command -v rsync &> /dev/null; then
    rsync -av --delete \
        --exclude='README.md' \
        --exclude='README' \
        --exclude='legacy/' \
        --exclude='legacy' \
        --exclude='.git/' \
        --exclude='.git' \
        --exclude='.gitignore' \
        --exclude='/.github/' \
        --exclude='/tests/' \
        --exclude='/package.json' \
        --exclude='/package-lock.json' \
        "$SOURCE_DIR/" "$TARGET_DIR/"
else
    echo "Warning: rsync not found, using cp. This will overwrite all files."
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi

    temp_dir=$(mktemp -d)
    cp -r "$SOURCE_DIR"/* "$temp_dir/" 2>/dev/null || true

    rm -f "$temp_dir/README.md" "$temp_dir/README" "$temp_dir/package.json" "$temp_dir/package-lock.json" 2>/dev/null || true
    rm -rf "$temp_dir/legacy" "$temp_dir/tests" "$temp_dir/.github" 2>/dev/null || true

    find "$TARGET_DIR" -mindepth 1 -maxdepth 1 \
        ! -name '.git' \
        ! -name 'version.html' \
        ! -name '.github' \
        ! -name 'tests' \
        ! -name 'package.json' \
        ! -name 'package-lock.json' \
        -exec rm -rf {} +

    cp -r "$temp_dir"/* "$TARGET_DIR/" 2>/dev/null || true
    rm -rf "$temp_dir"
fi

if [ -f "$TARGET_DIR/README.md" ]; then
    rm -f "$TARGET_DIR/README.md"
    echo "Removed README.md from target"
fi
if [ -d "$TARGET_DIR/legacy" ]; then
    rm -rf "$TARGET_DIR/legacy"
    echo "Removed legacy folder from target"
fi

if [[ $current_version =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    patch="${BASH_REMATCH[3]}"
    new_patch=$((patch + 1))
    new_version="${major}.${minor}.${new_patch}"
elif [[ $current_version =~ ^([0-9]+)\.([0-9]+)$ ]]; then
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    new_minor=$((minor + 1))
    new_version="${major}.${new_minor}"
else
    echo "Warning: Could not parse version format, using default increment"
    new_version="1.0.1"
fi

echo "$new_version" > "$VERSION_FILE"

if [ $? -eq 0 ]; then
    echo "Farm migration update completed successfully!"
    echo "Files copied from: $SOURCE_DIR"
    echo "Files copied to: $TARGET_DIR"
    echo "Version updated from $current_version to $new_version"

    file_count=$(find "$TARGET_DIR" -type f | wc -l)
    echo "Total files in farm/migration folder: $file_count"
else
    echo "Error: Copy operation failed"
    exit 1
fi
