#!/bin/bash

# =============================================================================
# UPDATE REWARDS SCRIPT
# =============================================================================
#
# PURPOSE: Updates liberdus.github.io/rewards from liberdus-airdrop/frontend plus
#          the repo-root wallet module submodule (required for ES module imports).
#
# SOURCE PATH RESOLUTION:
# 1. Preferred repo: ../follower-campaign/liberdus-airdrop
# 2. Fallback repo:  ../liberdus-airdrop
# Frontend source is always <repo>/frontend
#
# USAGE:
#   ./update-rewards.sh <source-branch>
#   SOURCE_BRANCH=<source-branch> ./update-rewards.sh
#
# Required input:
#   source-branch               Branch to deploy (argument or SOURCE_BRANCH)
#
# Optional environment variables:
#   SKIP_SOURCE_GIT_SYNC=1      Skip fetch/checkout/pull; require requested branch
#
# WHAT IT DOES:
# - Ensures liberdus-airdrop is on SOURCE_BRANCH with latest origin (ff-only pull)
# - Initializes vendor/liberdus-wallet-module at repo root before sync
# - Rsyncs frontend/ into rewards/ (excludes local config variants)
# - Rsyncs vendor/liberdus-wallet-module into rewards/vendor/
# - Rewrites wallet import paths for flat rewards/ layout (../../../vendor -> ../../vendor)
# - Copies config.prod.json to rewards/config.json
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
PARENT_DIR="$(dirname "$REPO_DIR")"

PREFERRED_AIRDROP_REPO="$PARENT_DIR/follower-campaign/liberdus-airdrop"
FALLBACK_AIRDROP_REPO="$PARENT_DIR/liberdus-airdrop"
TARGET_DIR="$REPO_DIR/rewards"
SOURCE_BRANCH_FROM_ENV="${SOURCE_BRANCH:-}"
WALLET_VENDOR_REL="vendor/liberdus-wallet-module"
SOURCE_CONFIG_FILE="config.prod.json"
TARGET_CONFIG_FILE="config.json"
SOURCE_COMMIT=""

if [ "$#" -gt 1 ]; then
  echo "Usage: $0 <source-branch>"
  exit 1
fi

if [ -n "$SOURCE_BRANCH_FROM_ENV" ] && [ "$#" -eq 1 ]; then
  echo "Error: Set the source branch using either the argument or SOURCE_BRANCH, not both."
  exit 1
fi

SOURCE_BRANCH="${SOURCE_BRANCH_FROM_ENV:-${1:-}}"
if [ -z "$SOURCE_BRANCH" ]; then
  echo "Error: An explicit source branch is required."
  echo "Usage: $0 main"
  echo "   or: SOURCE_BRANCH=main $0"
  exit 1
fi

if [ -d "$PREFERRED_AIRDROP_REPO" ]; then
  AIRDROP_REPO="$PREFERRED_AIRDROP_REPO"
elif [ -d "$FALLBACK_AIRDROP_REPO" ]; then
  AIRDROP_REPO="$FALLBACK_AIRDROP_REPO"
else
  echo "Error: liberdus-airdrop repo not found."
  echo "Checked:"
  echo "  $PREFERRED_AIRDROP_REPO"
  echo "  $FALLBACK_AIRDROP_REPO"
  exit 1
fi

SOURCE_DIR="$AIRDROP_REPO/frontend"

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

assert_source_clean() {
  local source_status
  source_status="$(git -C "$AIRDROP_REPO" status --porcelain --untracked-files=normal)"
  if [ -n "$source_status" ]; then
    echo "Error: liberdus-airdrop has uncommitted or untracked changes."
    echo "$source_status"
    echo "Commit or stash them before migrating."
    exit 1
  fi
}

sync_source_repo() {
  if [ ! -d "$AIRDROP_REPO/.git" ]; then
    echo "Error: $AIRDROP_REPO is not a git repository"
    exit 1
  fi

  assert_source_clean

  if [ "${SKIP_SOURCE_GIT_SYNC:-}" = "1" ]; then
    local current_branch
    current_branch="$(git -C "$AIRDROP_REPO" branch --show-current)"
    if [ "$current_branch" != "$SOURCE_BRANCH" ]; then
      echo "Error: Source is on $current_branch, but $SOURCE_BRANCH was requested."
      exit 1
    fi
    SOURCE_COMMIT="$(git -C "$AIRDROP_REPO" rev-parse HEAD)"
    echo "Skipping source git sync (SKIP_SOURCE_GIT_SYNC=1)"
    echo "Source at: ${SOURCE_COMMIT:0:7} ($(git -C "$AIRDROP_REPO" log -1 --format='%s'))"
    return 0
  fi

  echo "Syncing source repo: $AIRDROP_REPO"
  echo "Target branch: $SOURCE_BRANCH"

  git -C "$AIRDROP_REPO" fetch origin

  if ! git -C "$AIRDROP_REPO" checkout "$SOURCE_BRANCH"; then
    echo "Error: Could not checkout branch $SOURCE_BRANCH in $AIRDROP_REPO"
    exit 1
  fi

  if ! git -C "$AIRDROP_REPO" pull --ff-only origin "$SOURCE_BRANCH"; then
    echo "Error: fast-forward pull failed for origin/$SOURCE_BRANCH"
    echo "Resolve the source repo manually, then re-run this script."
    exit 1
  fi

  assert_source_clean
  SOURCE_COMMIT="$(git -C "$AIRDROP_REPO" rev-parse HEAD)"
  echo "Source at: ${SOURCE_COMMIT:0:7} ($(git -C "$AIRDROP_REPO" log -1 --format='%s'))"
}

init_source_submodules() {
  echo "Initializing source submodules..."
  if ! git -C "$AIRDROP_REPO" submodule update --init --recursive "$WALLET_VENDOR_REL"; then
    echo "Error: Failed to initialize $WALLET_VENDOR_REL in $AIRDROP_REPO"
    exit 1
  fi

  if [ ! -f "$AIRDROP_REPO/$WALLET_VENDOR_REL/index.js" ]; then
    echo "Error: Missing $AIRDROP_REPO/$WALLET_VENDOR_REL/index.js after submodule init"
    exit 1
  fi

  echo "Wallet module pin: $(git -C "$AIRDROP_REPO/$WALLET_VENDOR_REL" rev-parse --short HEAD)"
  git -C "$AIRDROP_REPO/$WALLET_VENDOR_REL" log -1 --oneline
}

fix_wallet_import_paths() {
  local wallet_js="$TARGET_DIR/js/shared/wallet.js"
  local wallet_js_tmp="${wallet_js}.tmp"
  if [ ! -f "$wallet_js" ]; then
    echo "Error: Missing $wallet_js after sync"
    exit 1
  fi

  sed 's|\.\./\.\./\.\./vendor/|../../vendor/|g' "$wallet_js" > "$wallet_js_tmp"
  mv "$wallet_js_tmp" "$wallet_js"

  if grep -q '\.\./\.\./\.\./vendor/' "$wallet_js"; then
    echo "Error: Failed to rewrite wallet import paths in $wallet_js"
    exit 1
  fi
}

verify_deployment_sync() {
  local frontend_drift
  local vendor_drift
  local wallet_js="$TARGET_DIR/js/shared/wallet.js"

  frontend_drift="$(rsync -rcn --delete \
    --exclude='.git' \
    --exclude='.github' \
    --exclude='.DS_Store' \
    --exclude='.vscode' \
    --exclude='node_modules' \
    --exclude='*.log' \
    --exclude='claims/generated' \
    --exclude='config.json' \
    --exclude='config.local.json' \
    --exclude='config.local.template.json' \
    --exclude='config.prod.json' \
    --exclude='config.test.json' \
    --exclude='vendor' \
    --exclude='js/shared/wallet.js' \
    --out-format='%i %n%L' \
    "$SOURCE_DIR/" "$TARGET_DIR/")"
  if [ -n "$frontend_drift" ]; then
    echo "Error: Deployed frontend does not match source commit $SOURCE_COMMIT:"
    echo "$frontend_drift"
    exit 1
  fi

  if ! sed 's|\.\./\.\./\.\./vendor/|../../vendor/|g' "$SOURCE_DIR/js/shared/wallet.js" | cmp -s - "$wallet_js"; then
    echo "Error: Deployed wallet.js does not match the rewritten source file."
    exit 1
  fi

  if ! cmp -s "$SOURCE_DIR/$SOURCE_CONFIG_FILE" "$TARGET_DIR/$TARGET_CONFIG_FILE"; then
    echo "Error: Deployed config.json does not match $SOURCE_CONFIG_FILE."
    exit 1
  fi

  vendor_drift="$(rsync -rcn --delete \
    --exclude='.git' \
    --exclude='test' \
    --exclude='demo.html' \
    --out-format='%i %n%L' \
    "$AIRDROP_REPO/$WALLET_VENDOR_REL/" "$TARGET_DIR/$WALLET_VENDOR_REL/")"
  if [ -n "$vendor_drift" ]; then
    echo "Error: Deployed wallet module does not match source pin:"
    echo "$vendor_drift"
    exit 1
  fi
}

sync_source_repo
init_source_submodules

echo "Updating rewards..."
echo "Airdrop repo: $AIRDROP_REPO"
echo "Frontend source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Config source: $SOURCE_CONFIG_FILE"

if ! command -v rsync &> /dev/null; then
  echo "Error: rsync is required for update-rewards.sh"
  exit 1
fi

rsync -av --delete --delete-excluded \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.DS_Store' \
  --exclude='.vscode' \
  --exclude='node_modules' \
  --exclude='*.log' \
  --exclude='claims/generated' \
  --exclude='config.json' \
  --exclude='config.local.json' \
  --exclude='config.local.template.json' \
  --exclude='config.prod.json' \
  --exclude='config.test.json' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

mkdir -p "$TARGET_DIR/$WALLET_VENDOR_REL"

rsync -av --delete \
  --exclude='test' \
  --exclude='demo.html' \
  "$AIRDROP_REPO/$WALLET_VENDOR_REL/" "$TARGET_DIR/$WALLET_VENDOR_REL/"

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
  echo "Warning: rewards vendor discovery.js may be missing EVM filter (isEvmProvider)"
fi

verify_deployment_sync

file_count=$(find "$TARGET_DIR" -type f | wc -l)
echo "Rewards update completed successfully."
echo "Airdrop repo: $AIRDROP_REPO"
echo "Source branch: $SOURCE_BRANCH"
echo "Source commit: $SOURCE_COMMIT"
echo "Deployed config: $TARGET_CONFIG_FILE -> $TARGET_CONFIG_FILE"
echo "Published wallet module files from source pin: $(git -C "$AIRDROP_REPO/$WALLET_VENDOR_REL" rev-parse --short HEAD)"
echo "Total files in rewards folder: $file_count"
