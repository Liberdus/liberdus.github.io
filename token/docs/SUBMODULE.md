# Wallet module submodule

`liberdus-token-ui` vendors [`liberdus-wallet-module`](https://github.com/Liberdus/liberdus-wallet-module) as a git submodule at:

```text
vendor/liberdus-wallet-module/
```

The parent repo stores a **pointer** to a specific commit in the wallet module repo. Updating the submodule means moving that pointer and committing the change in `liberdus-token-ui`.

Deploy repos such as `liberdus.github.io` do **not** use submodules. Deploy scripts rsync flat static files into `/tokentest` or `/token`.

## First-time setup

Clone with submodules:

```bash
git clone --recurse-submodules https://github.com/Liberdus/liberdus-token-ui.git
```

If the repo is already cloned:

```bash
git submodule update --init --recursive
```

Verify the wallet files are present:

```bash
test -f vendor/liberdus-wallet-module/index.js && echo OK
```

## Update to latest `main`

From the repo root:

```bash
./scripts/bump-wallet-module.sh
```

That script:

1. Fetches the latest commit from the submodule's tracked branch
2. Stages `vendor/liberdus-wallet-module`
3. Creates a commit in `liberdus-token-ui`

Use `--no-commit` if you only want to update and stage locally:

```bash
./scripts/bump-wallet-module.sh --no-commit
```

## Pin to a tag or commit

```bash
./scripts/bump-wallet-module.sh --ref v0.2.0
./scripts/bump-wallet-module.sh --ref d393766
```

## Manual update (equivalent commands)

Latest remote commit:

```bash
git submodule update --init --recursive vendor/liberdus-wallet-module
git submodule update --remote vendor/liberdus-wallet-module
git add vendor/liberdus-wallet-module
git commit -m "chore: bump liberdus-wallet-module submodule"
```

Specific tag or commit:

```bash
cd vendor/liberdus-wallet-module
git fetch origin --tags
git checkout v0.2.0
cd ../..
git add vendor/liberdus-wallet-module
git commit -m "chore: bump wallet module to v0.2.0"
```

## Inspect current pin

```bash
git submodule status vendor/liberdus-wallet-module
git -C vendor/liberdus-wallet-module log -1 --oneline
```

## Deploy after a submodule bump

After merging the submodule bump in `liberdus-token-ui`, copy the built static app into GitHub Pages:

```bash
cd ../liberdus.github.io
./update-tokentest.sh     # staging
./update-token-client.sh  # production /token
git add tokentest token
git commit -m "chore: deploy token UI"
git push
```

Deploy scripts run `git submodule update --init --recursive` in the source repo before rsync, so vendored wallet files are copied as plain static assets.

## Typical release flow

```bash
# 1. Bump wallet module in liberdus-token-ui
cd liberdus-token-ui
./scripts/bump-wallet-module.sh
git push

# 2. Deploy staging
cd ../liberdus.github.io
./update-tokentest.sh
git commit -am "chore: deploy tokentest"
git push
```

## Troubleshooting

### Empty `vendor/liberdus-wallet-module` after clone

```bash
git submodule update --init --recursive
```

### Submodule shows modified content inside vendor path

You may have detached HEAD state inside the submodule after checkout. From repo root:

```bash
git submodule update --init vendor/liberdus-wallet-module
```

### Browser still runs old JS after deploy

`CONFIG.APP.VERSION` only updates the header label today. See [liberdus.github.io#48](https://github.com/Liberdus/liberdus.github.io/issues/48) for cache-busting work.
