# Overview Refresh Middle-Ground (No Full Reload)

## Summary

This describes a low-risk middle-ground between full refreshes and full
event-reconciliation. The idea is to **update only the affected lock(s)**
after a successful transaction, while keeping the rest of the list as-is.

## Why this helps

- Fewer RPC calls after each tx.
- UI stays responsive without a full reload.
- Much simpler than full event-reconciliation.

## Suggested per-action updates

1) **Lock created**
   - Add new lock to `_locks` (append or insert by id).
   - Fetch the new lock via `getLock(id)` or use the lock params from the tx.
   - Fetch token metadata for its token if missing.

2) **Unlock**
   - Update the cached lock’s `unlockTime` and `unlocked` fields.
   - No need to refetch the whole list.

3) **Withdraw**
   - Update the cached lock’s `withdrawn` amount.
   - Optionally recompute `previewWithdrawable` for just that lock.

4) **Retract / LockClosed**
   - Remove the lock from `_locks` and `_lockIndex`.

## Minimal API support needed

- `getLock(lockId)` for accurate updates (optional if you trust tx params).
- `previewWithdrawable(lockId)` for per-lock refresh on withdraw.

## Risks / gotchas

- Requires careful local state updates to avoid UI drift.
- If anything fails, you still need a fallback full refresh.

