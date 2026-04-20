# Manual Debug Patches For `issue-1249-edit-pending-revert`

These patches are local-only helpers for manual testing. Do not keep them on the branch when you open the PR.

Patches `01`, `02`, `04`, and `05` are self-contained. Once applied, they affect every edit flow automatically until you revert them. You do not need to set anything in the browser console.

Apply a patch:

```bash
git apply tests-local/manual-debug-patches/<patch-name>.patch
```

Revert a patch:

```bash
git apply -R tests-local/manual-debug-patches/<patch-name>.patch
```

## Patches

### `01-debug-pending-timeout.patch`

Shortens pending polling thresholds so timeout rollback happens quickly without waiting for the normal 30-second window.

Use it to test:
- timeout / no receipt
- rollback from pending timeout

### `02-debug-fail-next-edit-inject.patch`

Forces every edit submission to fail immediately before `injectTx()` is called while the patch is applied.

Use it to test:
- immediate edit inject failure
- rollback to original message
- rollback to original wallet memo
- edit composer restoration

### `04-debug-skew-next-edit-timestamp.patch`

Skews every edit transaction timestamp by 10 seconds before signing while the patch is applied, so the backend should reject it as out of range.

Use it to test:
- backend timestamp rejection for edit txs
- rollback after a real `/inject` failure response
- edit composer restoration after server-side rejection

### `05-debug-fail-next-edit-receipt.patch`

Forces every edit transaction receipt lookup to return `success: false` after inject succeeds and the tx is pending while the patch is applied.

Use it to test:
- pending transaction failure after inject success
- rollback from `checkPendingTransactions()`
- failure toast from receipt processing

### `03-debug-edit-pending-hooks.patch`

Adds `window.debugEditPending` helpers in the browser console.

This one is optional. It is only for manual inspection / forcing state from the console.

After applying:

```js
window.debugEditPending.list()
window.debugEditPending.expire()
await window.debugEditPending.expireAndCheck()
```

Helpers:

- `list()` returns current pending edits
- `expire(targetTxid?)` ages a pending edit so timeout logic will treat it as old
- `expireAndCheck(targetTxid?)` ages it and immediately runs pending reconciliation
- `failNextInject()` sets the same flag used by patch `02`
- `setTimeoutMs(ms)` / `clearTimeoutMs()` set the same timeout override used by patch `01`

## Suggested Combinations

Immediate inject failure:

```bash
git apply tests-local/manual-debug-patches/02-debug-fail-next-edit-inject.patch
```

Backend timestamp rejection:

```bash
git apply tests-local/manual-debug-patches/04-debug-skew-next-edit-timestamp.patch
```

Pending receipt failure after inject:

```bash
git apply tests-local/manual-debug-patches/05-debug-fail-next-edit-receipt.patch
```

Fast timeout rollback:

```bash
git apply tests-local/manual-debug-patches/01-debug-pending-timeout.patch
```
