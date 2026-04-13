#!/bin/bash

# =============================================================================
# UPDATE REWARDS SCRIPT
# =============================================================================
#
# PURPOSE: This script updates the production hosted airdrop frontend by copying
#          the frontend directory from liberdus-airdrop into
#          liberdus.github.io/rewards
#
# SOURCE PATH RESOLUTION:
# 1. Preferred: ../follower-campaign/liberdus-airdrop/frontend
# 2. Fallback:  ../liberdus-airdrop/frontend
#
# WHAT IT DOES:
# - Copies only the frontend contents into rewards
# - Excludes local and environment-specific config variants from the sync
# - Copies config.prod.json into the target as config.json
#
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
PARENT_DIR="$(dirname "$REPO_DIR")"

PREFERRED_SOURCE_DIR="$PARENT_DIR/follower-campaign/liberdus-airdrop/frontend"
FALLBACK_SOURCE_DIR="$PARENT_DIR/liberdus-airdrop/frontend"
TARGET_DIR="$REPO_DIR/rewards"
SOURCE_CONFIG_FILE="config.prod.json"
TARGET_CONFIG_FILE="config.json"

if [ -d "$PREFERRED_SOURCE_DIR" ]; then
  SOURCE_DIR="$PREFERRED_SOURCE_DIR"
elif [ -d "$FALLBACK_SOURCE_DIR" ]; then
  SOURCE_DIR="$FALLBACK_SOURCE_DIR"
else
  echo "Error: Source directory not found."
  echo "Checked:"
  echo "  $PREFERRED_SOURCE_DIR"
  echo "  $FALLBACK_SOURCE_DIR"
  exit 1
fi

cd "$REPO_DIR" || exit 1

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

echo "Updating rewards..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo "Config source: $SOURCE_CONFIG_FILE"

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

echo "Rewards update completed successfully."
echo "Source used: $SOURCE_DIR"
echo "Deployed config: $TARGET_CONFIG_FILE (from $SOURCE_CONFIG_FILE)"
