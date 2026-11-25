#!/bin/bash

set -euo pipefail

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
#   ./update-test-client.sh
#   ./update-test-client.sh <branch>
#
# With no argument, copies the sibling web-client-v2 checkout as it sits.
# With a branch, copies the existing worktree already checked out on that
# branch. It does not fetch, checkout, or otherwise change any worktree.
# The branch must already be checked out somewhere (the main repo counts).
#
# WHAT IT DOES:
# - Copies the app's runtime files and their licenses to liberdus.github.io/test/
# - Installs the source's network.js_test as network.js
# - Increments version in test/app.js (last character: a->b, z->a, etc.)
# - Updates version.html with current timestamp (YYYY.MMDD.HHmm, e.g. 2026.1027.1328)
#
# =============================================================================

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The script should be in liberdus.github.io, so that's our repo root
REPO_DIR="$SCRIPT_DIR"

# Source directory is in the sibling web-client-v2 directory
SOURCE_REPO="$(dirname "$REPO_DIR")/web-client-v2"
SOURCE_DIR="$SOURCE_REPO"

# Target directory is the test folder in this repo
TARGET_DIR="$REPO_DIR/test"

if [[ $# -gt 1 ]]; then
    echo "Usage: $(basename "$0") [branch]" >&2
    exit 1
fi
REQUESTED_BRANCH="${1:-}"

# Find the worktree already checked out on REQUESTED_BRANCH.
# Prints the worktree path. Does not create or switch checkouts.
find_branch_worktree() {
    local repo="$1"
    local branch="$2"
    local target_ref="refs/heads/${branch}"
    local current="" line found=""

    if ! git -C "$repo" rev-parse --git-dir >/dev/null 2>&1; then
        echo "Error: $repo is not a git repository" >&2
        return 1
    fi

    while IFS= read -r line || [[ -n "$line" ]]; do
        case "$line" in
            worktree\ *)
                current="${line#worktree }"
                ;;
            "branch ${target_ref}")
                found="$current"
                ;;
            "")
                current=""
                ;;
        esac
    done < <(git -C "$repo" worktree list --porcelain)

    if [[ -z "$found" ]]; then
        echo "Error: No worktree is checked out on ${branch}." >&2
        echo "Check that branch out in a worktree, then re-run this script." >&2
        return 1
    fi

    if [[ ! -d "$found" ]]; then
        echo "Error: Worktree for ${branch} is missing: ${found}" >&2
        return 1
    fi

    printf '%s\n' "$found"
}

# Change to the repo directory
cd "$REPO_DIR" || exit 1

# Check if source directory exists
if [ ! -d "$SOURCE_REPO" ]; then
    echo "Error: Source directory not found: $SOURCE_REPO"
    echo "Please ensure web-client-v2 is in the same parent directory as liberdus.github.io"
    exit 1
fi

if [[ -n "$REQUESTED_BRANCH" ]]; then
    SOURCE_DIR="$(find_branch_worktree "$SOURCE_REPO" "$REQUESTED_BRANCH")"
fi

# Check if target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory not found: $TARGET_DIR"
    exit 1
fi

# List the files served by the app. The site maintains its own explorer and network redirects.
runtime_files=(
    LICENSE
    index.html
    index.html.txt
    styles.css
    app.js
    lib.js
    crypto.js
    dao.js
    evm-assets.js
    near-assets.js
    encryption.worker.js
    notice.html
    offline.html
    bridge/index.html
    meet/index.html
    data/emoji-picker-data.js
    external/blake2b.js
    external/keccak256.js
    external/noble-ciphers.js
    external/noble-post-quantum.js
    external/noble-secp256k1.js
    external/qr.js
    external/stringify-shardus.js
    fonts/LICENSE.txt
    fonts/inter-latin.woff2
    fonts/inter-latin-ext.woff2
    media/chatSound.mp3
    media/paymentSound.mp3
    media/ethereum_logo.png
    media/near_logo.png
    media/liberdus_logo_50.png
    media/liberdus_logo_250.png
    media/liberdus_logo_512.png
)

for file in "${runtime_files[@]}" network.js_test; do
    if [ ! -f "$SOURCE_DIR/$file" ]; then
        echo "Error: Required source file not found: $SOURCE_DIR/$file" >&2
        exit 1
    fi
done

# Extract the current version from test/app.js (BEFORE copying)
if ! current_version=$(grep -oP "(?<=^const version = ')[^']+" "$TARGET_DIR/app.js"); then
    echo "Error: Could not read the app version from $TARGET_DIR/app.js" >&2
    exit 1
fi

# Increment the last character of the version
last_char=${current_version: -1}
if [[ $last_char =~ [a-yA-Y] ]]; then
    next_char=$(echo "$last_char" | tr "A-Ya-y" "B-Zb-z")
elif [[ $last_char == "z" ]]; then
    next_char="a"
else
    next_char="A"
fi
new_version_char_increment="${current_version:0:-1}$next_char"

echo "Copying web-client-v2 runtime files to test..."
echo "Source: $SOURCE_DIR"
if git -C "$SOURCE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Source branch: $(git -C "$SOURCE_DIR" rev-parse --abbrev-ref HEAD) @ $(git -C "$SOURCE_DIR" rev-parse --short HEAD)"
    if [[ -n "$(git -C "$SOURCE_DIR" status --porcelain)" ]]; then
        echo "Warning: source worktree has uncommitted changes; those files will be copied."
    fi
fi
echo "Target: $TARGET_DIR"

printf '%s\n' "${runtime_files[@]}" |
    rsync -av --delay-updates --files-from=- "$SOURCE_DIR/" "$TARGET_DIR/"

echo "Updating network configuration..."
cp "$SOURCE_DIR/network.js_test" "$TARGET_DIR/network.js"

# Update the version in the newly copied test/app.js with the incremented version
sed -i "s/^const version = .*/const version = '$new_version_char_increment'/" "$TARGET_DIR/app.js"

# Get the current date and time for version.html (YYYY.MMDD.HHmm)
current_date=$(date +"%Y.%m%d.%H%M")

# Update the version in test/version.html
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
