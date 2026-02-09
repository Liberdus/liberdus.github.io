# Overview Tab Data Flow (ASCII)

```
App Load
  |
  v
overviewTab.load()
  |
  v
refreshLocks()
  |
  +--> getActiveLockCount()
  |
  +--> getActiveLockIds(offset, 50) [loop until complete]
  |
  v
_loadLocks(ids)
  |
  +--> getLocksBatch(ids)  [multicall if available]
  |        |
  |        +--> _locks[] + _lockIndex map
  |
  +--> _primeTokenMeta()
  |        |
  |        +--> token metadata cache (localStorage, 30-day TTL)
  |        +--> getTokenMetadataBatch() [multicall if available]
  |
  +--> _primeAvailable()
  |        |
  |        +--> previewWithdrawableBatch() [multicall if available]
  |
  v
renderLocks()
  |
  +--> filters (token, mine)
  +--> sort (newest lock id first)
  +--> render rows

User clicks Refresh
  |
  v
refreshLocks({ force: true })
  |
  v
full reload of the above (no lock list cache across sessions)
```

## Caching: what we keep and why

### Active lock list across sessions (currently NOT cached)

- **Current behavior:** `_locks` is only stored in memory for the current session.
- **Why it isn’t cached across sessions:** active locks are *mutable*. They can be
  unlocked, withdrawn, or closed between visits. If we persisted the full active
  lock list across sessions, users could see stale data unless we always revalidate
  it — which defeats the cache.
- **If we did cache:** we’d need a very short TTL (seconds) or a validation step
  (compare against a fresh `getActiveLockCount()` + spot-check IDs) to avoid stale UI.

#### Note on block-resume caching (not implemented)

We *could* cache the active lock list and resume from a cached block, **but only**
if we add event reconciliation logic. This contract emits all the right events
to make it possible:

- `LockCreated` → add lock
- `Unlocked` → update unlock fields
- `Withdrawn` → update withdrawn
- `LockClosed` / `Retracted` → remove lock

Without this reconciliation step, any cached snapshot can drift and become stale.
Because of the added complexity (reorg buffers, dedupe, ordering), we are **not**
implementing this for Overview right now.

### `previewWithdrawable` values (currently NOT cached across sessions)

- **Current behavior:** values are recomputed on every refresh.
- **Why it isn’t cached across sessions:** `previewWithdrawable` changes with time
  (vesting over days). If you persist it, it’s stale almost immediately, and that
  can be misleading to users.
- **If we did cache:** we’d need a very short TTL or recompute on visible rows only.
  Generally better to recompute on refresh and keep the number accurate.

## Safe caching that *is* used

- **Token metadata (symbol/decimals):** cached in `localStorage` for 30 days because
  it rarely changes and saves repeated ERC‑20 calls.
- **Session-only lock list:** avoids re-fetching when users switch tabs in the same
  session; refresh button still forces a full reload.
