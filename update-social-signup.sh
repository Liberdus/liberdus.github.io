#!/bin/bash

# =============================================================================
# UPDATE SOCIAL SIGNUP SCRIPT
# =============================================================================
#
# PURPOSE: Updates liberdus.github.io/social from the liberdus social signup
#          frontend plus the repo-root wallet module submodule required for
#          ES module imports.
#
# SOURCE PATH RESOLUTION:
# 1. Preferred repo: ../liberus-social-signup
# 2. Fallback repo:  ../liberdus-social-signup
# Frontend source is always <repo>/frontend
#
# USAGE:
#   ./update-social-signup.sh
#
# WHAT IT DOES:
# - Copies the current local source tree
# - Verifies vendor/liberdus-wallet-module is available at repo root before sync
# - Rsyncs frontend/ into social/ (excludes local config variants)
# - Rsyncs vendor/liberdus-wallet-module into social/vendor/
# - Rewrites wallet import paths for flat social/ layout (../../../vendor -> ../../vendor)
# - Copies config.prod.json to social/config.json
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
PARENT_DIR="$(dirname "$REPO_DIR")"

PREFERRED_SOURCE_REPO="$PARENT_DIR/liberus-social-signup"
FALLBACK_SOURCE_REPO="$PARENT_DIR/liberdus-social-signup"
TARGET_DIR="$REPO_DIR/social"
WALLET_VENDOR_REL="vendor/liberdus-wallet-module"
SOURCE_CONFIG_FILE="config.prod.json"
TARGET_CONFIG_FILE="config.json"

if [ -d "$PREFERRED_SOURCE_REPO" ]; then
  SOURCE_REPO="$PREFERRED_SOURCE_REPO"
elif [ -d "$FALLBACK_SOURCE_REPO" ]; then
  SOURCE_REPO="$FALLBACK_SOURCE_REPO"
else
  echo "Error: social signup source repo not found."
  echo "Checked:"
  echo "  $PREFERRED_SOURCE_REPO"
  echo "  $FALLBACK_SOURCE_REPO"
  exit 1
fi

SOURCE_DIR="$SOURCE_REPO/frontend"

cd "$REPO_DIR"

if [ -z "$(ls -A "$SOURCE_DIR")" ]; then
  echo "Error: Source directory is empty: $SOURCE_DIR"
  exit 1
fi

if [ ! -f "$SOURCE_DIR/index.html" ]; then
  echo "Error: index.html not found in source directory: $SOURCE_DIR"
  exit 1
fi

if [ ! -f "$SOURCE_DIR/$SOURCE_CONFIG_FILE" ]; then
  echo "Error: $SOURCE_CONFIG_FILE not found in source directory: $SOURCE_DIR"
  exit 1
fi

mkdir -p "$TARGET_DIR"

init_source_submodules() {
  if [ ! -f "$SOURCE_REPO/$WALLET_VENDOR_REL/index.js" ]; then
    echo "Error: Missing $SOURCE_REPO/$WALLET_VENDOR_REL/index.js"
    echo "Initialize or repair the wallet module in the source repo before publishing:"
    echo "  cd \"$SOURCE_REPO\""
    echo "  git submodule update --init --recursive \"$WALLET_VENDOR_REL\""
    exit 1
  fi

  if git -C "$SOURCE_REPO/$WALLET_VENDOR_REL" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Wallet module pin: $(git -C "$SOURCE_REPO/$WALLET_VENDOR_REL" rev-parse --short HEAD)"
    git -C "$SOURCE_REPO/$WALLET_VENDOR_REL" log -1 --oneline
  else
    echo "Wallet module source: existing directory at $SOURCE_REPO/$WALLET_VENDOR_REL"
  fi
}

fix_wallet_import_paths() {
  local wallet_js="$TARGET_DIR/js/shared/wallet.js"
  if [ ! -f "$wallet_js" ]; then
    echo "Error: Missing $wallet_js after sync"
    exit 1
  fi
  sed -i 's|\.\./\.\./\.\./vendor/|../../vendor/|g' "$wallet_js"
}

init_source_submodules

echo "Updating social signup..."
echo "Source repo: $SOURCE_REPO"
echo "Frontend source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Config source: $SOURCE_CONFIG_FILE"

if ! command -v rsync &> /dev/null; then
  echo "Error: rsync is required for update-social-signup.sh"
  exit 1
fi

rsync -av --delete --delete-excluded \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.DS_Store' \
  --exclude='.vscode' \
  --exclude='node_modules' \
  --exclude='*.log' \
  --exclude='config.json' \
  --exclude='config.local.json' \
  --exclude='config.local.template.json' \
  --exclude='config.prod.json' \
  --exclude='config.test.json' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

mkdir -p "$TARGET_DIR/$WALLET_VENDOR_REL"

rsync -av --delete \
  --exclude='.git' \
  --exclude='.git*' \
  --exclude='test' \
  --exclude='demo.html' \
  --exclude='*.md' \
  "$SOURCE_REPO/$WALLET_VENDOR_REL/" "$TARGET_DIR/$WALLET_VENDOR_REL/"

fix_wallet_import_paths

cp "$SOURCE_DIR/$SOURCE_CONFIG_FILE" "$TARGET_DIR/$TARGET_CONFIG_FILE"
rm -f \
  "$TARGET_DIR/config.local.json" \
  "$TARGET_DIR/config.local.template.json" \
  "$TARGET_DIR/config.prod.json" \
  "$TARGET_DIR/config.test.json"

if [ ! -f "$TARGET_DIR/index.html" ]; then
  echo "Error: Missing index.html after sync: $TARGET_DIR/index.html"
  exit 1
fi

if [ ! -f "$TARGET_DIR/$TARGET_CONFIG_FILE" ]; then
  echo "Error: Missing config file after update: $TARGET_DIR/$TARGET_CONFIG_FILE"
  exit 1
fi

if [ ! -f "$TARGET_DIR/$WALLET_VENDOR_REL/index.js" ]; then
  echo "Error: Missing $TARGET_DIR/$WALLET_VENDOR_REL/index.js after sync"
  exit 1
fi

if ! grep -q 'isEvmProvider' "$TARGET_DIR/$WALLET_VENDOR_REL/core/discovery.js" 2>/dev/null; then
  echo "Warning: social signup vendor discovery.js may be missing EVM filter (isEvmProvider)"
fi

file_count=$(find "$TARGET_DIR" -type f | wc -l)
echo "Social signup update completed successfully."
echo "Source repo: $SOURCE_REPO"
echo "Deployed config: $TARGET_CONFIG_FILE (from $SOURCE_CONFIG_FILE)"
if git -C "$SOURCE_REPO/$WALLET_VENDOR_REL" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Published wallet module files from source pin: $(git -C "$SOURCE_REPO/$WALLET_VENDOR_REL" rev-parse --short HEAD)"
else
  echo "Published wallet module files from existing source directory."
fi
echo "Total files in social folder: $file_count"
