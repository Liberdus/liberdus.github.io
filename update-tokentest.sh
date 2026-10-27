#!/bin/bash

# =============================================================================
# UPDATE TOKENTEST SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the token frontend using only committed files
#          from the current liberdus-token-ui branch.
#
# PREREQUISITES:
# 1. This script must be located in the liberdus.github.io directory
# 2. The liberdus-token-ui repository must be in the same parent directory
#    example structure:
#    /path/to/parent/
#    ├── liberdus.github.io/     (this repo, contains this script)
#    └── liberdus-token-ui/      (source repo)
# 3. The script must have execute permissions: chmod +x update-tokentest.sh
#
# USAGE:
# 1. Run the script from anywhere: ./update-tokentest.sh
#    (or: cd liberdus.github.io && ./update-tokentest.sh)
# 2. To update the production folder instead: ./update-tokentest.sh token
#
# WHAT IT DOES:
# - Exports the current HEAD and its recorded submodule commits to a temp directory
# - Leaves source branches, the index, and local changes untouched; does not pull
# - Requires submodules and their recorded commits to already be available locally
# - Copies the committed snapshot to tokentest/ (default) or token/
# - Excludes node_modules, .git, and other build/IDE artifacts
# - For token/, also excludes docs, tests, package files, and local scripts
# - Mirrors source to target (removes files not in source)
# - Increments VERSION in the target's js/config.js (patch increment: 0.0.X -> 0.0.X+1)
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
SOURCE_DIR="$(dirname "$REPO_DIR")/liberdus-token-ui"
TARGET_NAME="${1:-tokentest}"

if [ "$#" -gt 1 ] || [[ "$TARGET_NAME" != "token" && "$TARGET_NAME" != "tokentest" ]]; then
    echo "Usage: $0 [tokentest|token]"
    exit 1
fi

TARGET_DIR="$REPO_DIR/$TARGET_NAME"

cd "$REPO_DIR"

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory not found: $SOURCE_DIR"
    echo "Please ensure liberdus-token-ui exists in the same parent directory as liberdus.github.io"
    exit 1
fi

if ! command -v rsync &> /dev/null; then
    echo "Error: rsync is required for update-tokentest.sh"
    exit 1
fi

export_committed_tree() {
    local repository="$1" commit="$2" destination="$3"
    local metadata path mode type object

    if [ ! -e "$repository/.git" ] || ! git -C "$repository" cat-file -e "${commit}^{commit}" 2>/dev/null; then
        echo "Error: Commit $commit is not available in $repository"
        echo "Initialize or fetch the missing submodule before retrying."
        exit 1
    fi

    mkdir -p "$destination"
    git -C "$repository" archive "$commit" | tar -x -C "$destination"

    while IFS=$'\t' read -r -d '' metadata path; do
        read -r mode type object <<< "$metadata"
        if [ "$mode" = "160000" ]; then
            export_committed_tree "$repository/$path" "$object" "$destination/$path"
        fi
    done < <(git -C "$repository" ls-tree -rz "$commit")
}

SOURCE_COMMIT="$(git -C "$SOURCE_DIR" rev-parse --verify 'HEAD^{commit}')"
SNAPSHOT_DIR="$(mktemp -d)"
trap 'rm -rf "$SNAPSHOT_DIR"' EXIT

echo "Exporting committed source files..."
echo "Source: $SOURCE_DIR"
echo "Source commit: $SOURCE_COMMIT"
export_committed_tree "$SOURCE_DIR" "$SOURCE_COMMIT" "$SNAPSHOT_DIR"

for runtime_file in index.html js/config.js vendor/liberdus-wallet-module/index.js; do
    if [ ! -f "$SNAPSHOT_DIR/$runtime_file" ]; then
        echo "Error: $runtime_file not found in committed source"
        exit 1
    fi
done

echo "Copying committed token UI contents to $TARGET_NAME..."
echo "Target: $TARGET_DIR"
echo "Note: If no files are listed, source and target are identical."

CONFIG_SRC="$SNAPSHOT_DIR/js/config.js"
CONFIG_TGT="$TARGET_DIR/js/config.js"
current_version="0.0.0"

if [ -f "$CONFIG_SRC" ]; then
    current_version=$(grep -oP "VERSION: '\K[0-9.]+" "$CONFIG_SRC" 2>/dev/null || echo "0.0.0")
fi

if [ -f "$CONFIG_TGT" ]; then
    tgt_ver=$(grep -oP "VERSION: '\K[0-9.]+" "$CONFIG_TGT" 2>/dev/null)
    [ -n "$tgt_ver" ] && current_version="$tgt_ver"
fi

IFS=. read -r maj min patch _ <<< "${current_version}.0"
patch=$((patch + 1))
new_version="$maj.$min.$patch"

rsync_options=()
if [ "$TARGET_NAME" = "token" ]; then
    rsync_options=(
        --delete-excluded
        --exclude='.gitignore'
        --exclude='.github'
        --exclude='.cursor'
        --exclude='docs'
        --exclude='tests'
        --exclude='scripts'
        --exclude='*.md'
        --exclude='*.MD'
        --exclude='package.json'
        --exclude='package-lock.json'
    )
fi

mkdir -p "$TARGET_DIR"
rsync -av --delete \
  "${rsync_options[@]}" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.gitmodules' \
  --exclude='.idea' \
  --exclude='.DS_Store' \
  --exclude='.vscode' \
  --exclude='.cursorrles' \
  --exclude='*.log' \
  --exclude='vendor/liberdus-wallet-module/test' \
  --exclude='vendor/liberdus-wallet-module/demo.html' \
  "$SNAPSHOT_DIR/" "$TARGET_DIR/"

echo "Updating version in $TARGET_NAME/js/config.js..."
if [ -f "$TARGET_DIR/js/config.js" ]; then
    sed -i "s/VERSION: '[0-9.]*'/VERSION: '$new_version'/" "$TARGET_DIR/js/config.js"
    echo "Set VERSION to $new_version"
else
    echo "Error: $TARGET_NAME/js/config.js not found after sync"
    exit 1
fi

if [ ! -f "$TARGET_DIR/index.html" ]; then
    echo "Error: index.html not found in $TARGET_NAME folder"
    exit 1
fi

if [ ! -f "$TARGET_DIR/vendor/liberdus-wallet-module/index.js" ]; then
    echo "Error: $TARGET_NAME/vendor/liberdus-wallet-module/index.js not found after sync"
    exit 1
fi

echo "$TARGET_NAME update completed successfully!"
echo "New VERSION in config.js: $new_version"
