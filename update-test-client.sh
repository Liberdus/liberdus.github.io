#!/bin/bash

# =============================================================================
# UPDATE TEST CLIENT SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the test client by copying files from 
#          web-client-v2 to liberdus.github.io/test and updating version numbers.
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. The web-client-v2 repository must be in the same parent directory as liberdus.github.io
#    example structure:
#    /path/to/parent/
#    ├── liberdus.github.io/     (this repo, contains this script)
#    └── web-client-v2/          (source repo)
# 3. The script must have execute permissions: chmod +x update-test-client.sh
#
# USAGE:
# 1. Run the script from anywhere: ./update-test-client.sh
#    (or: cd liberdus.github.io && ./update-test-client.sh)
#
# WHAT IT DOES:
# - Copies all files from web-client-v2/* to liberdus.github.io/test/
# - Removes unwanted folders (.vscode, .cursorrles, data_structures_flow)
# - Updates network configuration (copies network.js_web to network.js)
# - Increments version in test/app.js (last character: a->b, z->a, etc.)
# - Updates version.html with current timestamp
# - Adds cache-busting parameters (?v=timestamp) to CSS, JS, lib.js, and crypto.js references
#
# =============================================================================

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The script should be in liberdus.github.io, so that's our repo root
REPO_DIR="$SCRIPT_DIR"

# Source directory is in the sibling web-client-v2 directory
SOURCE_DIR="$(dirname "$REPO_DIR")/web-client-v2"

# Target directory is the test folder in this repo
TARGET_DIR="$REPO_DIR/test"

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

# Extract the current version from test/app.js (BEFORE copying)
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

echo "Copying web-client-v2 contents to test..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
cp -a "$SOURCE_DIR"/* "$TARGET_DIR"/

echo "Removing unwanted folders and files..."
rm -rf "$TARGET_DIR/data_structures_flow"
rm -rf "$TARGET_DIR/.vscode"
rm -rf "$TARGET_DIR/.cursorrles"
rm -f "$TARGET_DIR/package.json"
rm -f "$TARGET_DIR/package-lock.json"

echo "Updating network configuration..."
cp "$TARGET_DIR/network.js_web" "$TARGET_DIR/network.js"

# Update the version in the newly copied test/app.js with the incremented version
sed -i "s/^const version = .*/const version = '$new_version_char_increment'/" "$TARGET_DIR/app.js"

# Get the current date and time for version.html
current_date=$(date +"%Y.%m.%d.%H.%M")

# Update the version in test/version.html
echo "$current_date" > "$TARGET_DIR/version.html"

# Use current_date as the ?v= value for cache busting
# Update or add ?v=... in styles.css reference in test/index.html
if grep -q 'href="\./styles\.css\?v=' "$TARGET_DIR/index.html"; then
  sed -i -E "s|(href=\"\./styles\.css\?v=)[^\"]*(\")|\1$current_date\2|" "$TARGET_DIR/index.html"
else
  sed -i -E "s|(href=\"\./styles\.css)(\")|\1?v=$current_date\2|" "$TARGET_DIR/index.html"
fi

# Update or add ?v=... in app.js reference in test/index.html
if grep -q 'src="\./app\.js\?v=' "$TARGET_DIR/index.html"; then
  sed -i -E "s|(src=\"\./app\.js\?v=)[^\"]*(\")|\1$current_date\2|" "$TARGET_DIR/index.html"
else
  sed -i -E "s|(src=\"\./app\.js)(\")|\1?v=$current_date\2|" "$TARGET_DIR/index.html"
fi

# Update or add ?v=... in lib.js reference in test/index.html
if grep -q 'href="lib\.js\?v=' "$TARGET_DIR/index.html"; then
  sed -i -E "s|(href=\"lib\.js\?v=)[^\"]*(\")|\1$current_date\2|" "$TARGET_DIR/index.html"
else
  sed -i -E "s|(href=\"lib\.js)(\")|\1?v=$current_date\2|" "$TARGET_DIR/index.html"
fi

# Update or add ?v=... in crypto.js reference in test/index.html
if grep -q 'href="crypto\.js\?v=' "$TARGET_DIR/index.html"; then
  sed -i -E "s|(href=\"crypto\.js\?v=)[^\"]*(\")|\1$current_date\2|" "$TARGET_DIR/index.html"
else
  sed -i -E "s|(href=\"crypto\.js)(\")|\1?v=$current_date\2|" "$TARGET_DIR/index.html"
fi

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

if [ ! -f "$TARGET_DIR/index.html" ]; then
    echo "Error: index.html not found"
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

if [ ! -w "$TARGET_DIR/index.html" ]; then
    echo "Error: No write permission for index.html"
    exit 1
fi

echo "Update completed successfully!"