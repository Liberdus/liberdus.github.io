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
# - Uses VERSION from the source config.js without modification
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

# Copy files while excluding build artifacts and IDE config
rsync -av \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.idea' \
  --exclude='.DS_Store' \
  --exclude='.vscode' \
  --exclude='.cursorrles' \
  --exclude='*.log' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

# Debugging output
echo "Current directory: $(pwd)"
echo "Config version source: $SOURCE_DIR/js/config.js"

# Check that key files exist
if [ ! -f "$TARGET_DIR/index.html" ]; then
    echo "Warning: index.html not found in token folder"
fi

echo "Update completed successfully!"
