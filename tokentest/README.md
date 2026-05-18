# liberdus-token-ui

Liberdus Token UI - User interface for Liberdus token operations.

## Getting Started

Clone with submodules:

```bash
git clone --recurse-submodules https://github.com/Liberdus/liberdus-token-ui.git
```

If you already cloned the repo, initialize submodules with:

```bash
git submodule update --init --recursive
```

The wallet library lives at `vendor/liberdus-wallet-module/` (from
[`liberdus-wallet-module`](https://github.com/Liberdus/liberdus-wallet-module)).

To run locally (needs a static server because we use ES modules):

- `python3 -m http.server 8080`
- or `npx serve` (from repo root)
