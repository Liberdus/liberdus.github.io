#!/bin/bash

set -euo pipefail

SUBMODULE_PATH="vendor/liberdus-wallet-module"
REF=""
NO_COMMIT=false

usage() {
    cat <<EOF
Usage: $(basename "$0") [--ref <tag|branch|sha>] [--no-commit]

Updates the liberdus-wallet-module submodule and commits the pointer change
in lib-lp-staking-frontend unless --no-commit is passed.

Examples:
  $(basename "$0")
  $(basename "$0") --ref v0.2.0
  $(basename "$0") --ref main --no-commit
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --ref)
            REF="${2:-}"
            if [ -z "$REF" ]; then
                echo "Error: --ref requires a value"
                exit 1
            fi
            shift 2
            ;;
        --no-commit)
            NO_COMMIT=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Error: unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

if [ ! -d "$SUBMODULE_PATH" ]; then
    echo "Error: submodule path not found: $SUBMODULE_PATH"
    exit 1
fi

staged_outside_submodule="$(git diff --cached --name-only | grep -v -E "^${SUBMODULE_PATH}(/|$)" || true)"
if [ -n "$staged_outside_submodule" ]; then
    echo "Error: staged changes exist outside $SUBMODULE_PATH"
    echo "Commit or unstage them before running this script:"
    echo "$staged_outside_submodule"
    exit 1
fi

echo "Initializing submodule..."
git submodule update --init --recursive "$SUBMODULE_PATH"

OLD_SHA="$(git -C "$SUBMODULE_PATH" rev-parse HEAD)"
echo "Current submodule commit: $OLD_SHA"

if [ -n "$REF" ]; then
    echo "Checking out submodule ref: $REF"
    git -C "$SUBMODULE_PATH" fetch origin --tags
    CHECKOUT_REF="$REF"
    if git -C "$SUBMODULE_PATH" show-ref --verify --quiet "refs/remotes/origin/$REF"; then
        CHECKOUT_REF="origin/$REF"
    fi
    git -C "$SUBMODULE_PATH" checkout --detach "$CHECKOUT_REF"
else
    echo "Updating submodule to latest remote commit..."
    git submodule update --remote "$SUBMODULE_PATH"
fi

NEW_SHA="$(git -C "$SUBMODULE_PATH" rev-parse HEAD)"
NEW_SUBJECT="$(git -C "$SUBMODULE_PATH" log -1 --format='%s')"

if [ ! -f "$SUBMODULE_PATH/index.js" ]; then
    echo "Error: $SUBMODULE_PATH/index.js not found after update"
    exit 1
fi

echo
echo "Submodule updated:"
echo "  path:    $SUBMODULE_PATH"
echo "  before:  $OLD_SHA"
echo "  after:   $NEW_SHA"
echo "  subject: $NEW_SUBJECT"
echo

git add "$SUBMODULE_PATH"

if git diff --cached --quiet -- "$SUBMODULE_PATH"; then
    echo "No submodule pointer change to commit."
    exit 0
fi

if [ "$NO_COMMIT" = true ]; then
    echo "Submodule change staged. Skipping commit (--no-commit)."
    exit 0
fi

COMMIT_MSG="chore: bump liberdus-wallet-module submodule to ${NEW_SHA:0:7}"
git commit -m "$COMMIT_MSG" -- "$SUBMODULE_PATH"
echo "Created commit: $COMMIT_MSG"
