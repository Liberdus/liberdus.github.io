#!/bin/bash

# =============================================================================
# UPDATE DEV CLIENT SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the development client by copying files from 
#          web-client-v2 to liberdus.github.io/dev and updating version numbers.
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. The web-client-v2 repository must be in the same parent directory as liberdus.github.io
#    example structure:
#    /path/to/parent/
#    ├── liberdus.github.io/     (this repo, contains this script)
#    └── web-client-v2/          (source repo)
# 3. The script must have execute permissions: chmod +x update-dev-client.sh
#
# USAGE:
# 1. Run the script from anywhere: ./update-dev-client.sh
#    (or: cd liberdus.github.io && ./update-dev-client.sh)
#
# WHAT IT DOES:
# - Copies all files from web-client-v2/* to liberdus.github.io/dev/
# - Excludes files listed in .gitignore
# - Removes unwanted folders (.vscode, .cursorrles, data_structures_flow)
# - Updates network configuration (copies local dev/network.js_dev to network.js)
# - Increments version in dev/app.js (last character: a->b, z->a, etc.)
# - Updates version.html with current timestamp
#
# =============================================================================

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The script should be in liberdus.github.io, so that's our repo root
REPO_DIR="$SCRIPT_DIR"

# Source directory is in the sibling web-client-v2 directory
SOURCE_DIR="$(dirname "$REPO_DIR")/web-client-v2"

# Target directory is the dev folder in this repo
TARGET_DIR="$REPO_DIR/dev"

# Change to the repo directory
cd "$REPO_DIR" || exit 1

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please ensure web-client-v2 is in the same parent directory as liberdus.github.io"
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

# Save the local network.js_dev before copying (in case it gets overwritten)
# We'll use this to restore network.js after copying
LOCAL_NETWORK_JS_DEV="$TARGET_DIR/network.js_dev"

# Extract the current version from dev/app.js (BEFORE copying)
current_version=$(grep -oP "(?<=^const version = ')[^']+" "$TARGET_DIR/app.js")

# Increment the last character of the version
last_char=${current_version: -1}
if [[ $last_char =~ [a-yA-Y] ]]; then
    next_char=$(echo $last_char | tr "A-Ya-y" "B-Zb-z")
elif [[ $last_char == "z" ]]; then
    next_char="a"
else
    next_char="A"
fi
new_version_char_increment="${current_version:0:-1}$next_char"

echo "Copying web-client-v2 contents to dev..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"

# Use rsync to copy files while excluding gitignore patterns and network.js_dev
rsync -av \
  --exclude='node_modules' \
  --exclude='.idea' \
  --exclude='.next' \
  --exclude='.DS_Store' \
  --exclude='out' \
  --exclude='network.js_dev' \
  --exclude='network.js_test' \
  --exclude='.vscode' \
  --exclude='.cursorrles' \
  --exclude='data_structures_flow' \
  --exclude='explorer/index.html' \
  --exclude='network/index.html' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

echo "Removing unwanted folders..."
rm -rf "$TARGET_DIR/data_structures_flow"
rm -rf "$TARGET_DIR/.vscode"
rm -rf "$TARGET_DIR/.cursorrles"

echo "Updating network configuration..."
# Copy the local network.js_dev to network.js (restore from local file)
if [ ! -f "$LOCAL_NETWORK_JS_DEV" ]; then
    echo "Warning: network.js_dev not found in dev directory"
else
    cp "$LOCAL_NETWORK_JS_DEV" "$TARGET_DIR/network.js"
    echo "Copied local network.js_dev to network.js"
fi

# Update the version in the newly copied dev/app.js with the incremented version
sed -i "s/^const version = .*/const version = '$new_version_char_increment'/" "$TARGET_DIR/app.js"

# Get the current date and time for version.html
current_date=$(date +"%Y.%m.%d.%H.%M")

# Update the version in dev/version.html
echo "$current_date" > "$TARGET_DIR/version.html"

# Debugging output
echo "Current directory: $(pwd)"
echo "New version in app.js: $new_version_char_increment"
echo "New version in version.html: $current_date"

# Check if files exist
if [ ! -f "$TARGET_DIR/app.js" ]; then
    echo "Error: app.js not found"
    exit 1
fi

if [ ! -f "$TARGET_DIR/version.html" ]; then
    echo "Error: version.html not found"
    exit 1
fi

# Check permissions
if [ ! -w "$TARGET_DIR/app.js" ]; then
    echo "Error: No write permission for app.js"
    exit 1
fi

if [ ! -w "$TARGET_DIR/version.html" ]; then
    echo "Error: No write permission for version.html"
    exit 1
fi

echo "Update completed successfully!"