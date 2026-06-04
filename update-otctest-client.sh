#!/bin/bash

# =============================================================================
# UPDATE OTC TEST CLIENT SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the OTC Test client by copying 
#          files from otc-web-client-1 to liberdus.github.io/otctest and updating 
#          version numbers.
#
# PREREQUISITES:
# 1. This script must be run from the liberdus.github.io directory
# 2. The otc-web-client-1 repository must be in the same parent directory as liberdus.github.io
#    example structure:
#    /home/bui/shared/liberdus/
#    ├── liberdus.github.io/     (current repo)
#    └── otc-web-client-1/       (source repo)
# 3. The script must have execute permissions: chmod +x update-otctest-client.sh
#
# USAGE:
# 1. Navigate to the liberdus.github.io directory
# 2. Run: ./update-otctest-client.sh
#
# WHAT IT DOES:
# - Copies files from otc-web-client-1/* to liberdus.github.io/otctest/ (only existing files/folders)
# - Removes unwanted folders (.vscode, .cursorrles, data_structures_flow)
# - Updates network configuration (copies network.js_web to network.js)
# - Increments patch version in otctest/index.html (e.g., 1.0.25 -> 1.0.26)
# - Updates version.html with current timestamp
# - Adds cache-busting parameters (?v=timestamp) to CSS and JS references
#
# =============================================================================

# Define the base directory
BASE_DIR="$HOME/shared/liberdus"

# Change to the website directory to read the current version
cd "$BASE_DIR/liberdus.github.io" || exit 1

# Extract the current version from otctest/index.html (BEFORE copying)
current_version=$(grep -oP "(?<=v)[0-9]+\.[0-9]+\.[0-9]+" otctest/index.html | head -1)

# Increment the patch version
if [[ $current_version =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    major="${BASH_REMATCH[1]}"
    minor="${BASH_REMATCH[2]}"
    patch="${BASH_REMATCH[3]}"
    new_patch=$((patch + 1))
    new_version="${major}.${minor}.${new_patch}"
else
    # Fallback if version format is not found
    new_version="1.0.26"
fi

# Now change back to the base directory to perform the copy
cd "$BASE_DIR" || exit 1

echo "Updating existing folders and files in liberdus.github.io/otctest with otc-web-client-1..."

# Copy entire folders that already exist in target
for source_dir in otc-web-client-1/*/; do
    if [ -d "$source_dir" ]; then
        folder_name=$(basename "$source_dir")
        target_folder="liberdus.github.io/otctest/$folder_name"
        
        if [ -d "$target_folder" ]; then
            echo "Copying entire folder: $folder_name"
            cp -r "$source_dir"* "$target_folder/"
        else
            echo "Skipping folder (doesn't exist in target): $folder_name"
        fi
    fi
done

# Copy individual files in root that already exist in target
for source_file in otc-web-client-1/*; do
    if [ -f "$source_file" ]; then
        file_name=$(basename "$source_file")
        target_file="liberdus.github.io/otctest/$file_name"
        
        if [ -f "$target_file" ]; then
            echo "Copying file: $file_name"
            cp "$source_file" "$target_file"
        else
            echo "Skipping file (doesn't exist in target): $file_name"
        fi
    fi
done

# Remove unwanted folders if they exist
if [ -d "liberdus.github.io/otctest/data_structures_flow" ]; then
    rm -rf liberdus.github.io/otctest/data_structures_flow
fi
if [ -d "liberdus.github.io/otctest/.vscode" ]; then
    rm -rf liberdus.github.io/otctest/.vscode
fi
if [ -d "liberdus.github.io/otctest/.cursorrles" ]; then
    rm -rf liberdus.github.io/otctest/.cursorrles
fi

echo "Updating network configuration..."
cd liberdus.github.io || exit 1
cp otctest/network.js_web otctest/network.js

# Update the version in the newly copied otctest/index.html with the incremented version
sed -i -E "s/v[0-9]+\.[0-9]+\.[0-9]+/v$new_version/" otctest/index.html

# Get the current date and time for version tracking
current_date=$(date +"%Y.%m.%d.%H.%M")

# Create a version file for OTC Test client
echo "$current_date" > otctest/version.html

# Use current_date as the ?v= value for cache busting
# Update or add ?v=... in styles.css reference
if grep -q 'href="css/styles\.css\?v=' otctest/index.html; then
  sed -i -E "s|(href=\"css/styles\.css\?v=)[^\"]*(\")|\1$current_date\2|" otctest/index.html
else
  sed -i -E "s|(href=\"css/styles\.css)(\")|\1?v=$current_date\2|" otctest/index.html
fi

# Update or add ?v=... in app.js reference
if grep -q 'src="js/app\.js\?v=' otctest/index.html; then
  sed -i -E "s|(src=\"js/app\.js\?v=)[^\"]*(\")|\1$current_date\2|" otctest/index.html
else
  sed -i -E "s|(src=\"js/app\.js)(\")|\1?v=$current_date\2|" otctest/index.html
fi

# Debugging output
echo "Current directory: $(pwd)"
echo "New version in index.html: $new_version"
echo "New version in version.html: $current_date"

# Check if files exist
if [ ! -f "otctest/index.html" ]; then
    echo "Error: otctest/index.html not found"
    exit 1
fi

if [ ! -f "otctest/version.html" ]; then
    echo "Error: otctest/version.html not found"
    exit 1
fi

# Check permissions
if [ ! -w "otctest/index.html" ]; then
    echo "Error: No write permission for otctest/index.html"
    exit 1
fi

if [ ! -w "otctest/version.html" ]; then
    echo "Error: No write permission for otctest/version.html"
    exit 1
fi

echo "OTC Test client update completed successfully!"
