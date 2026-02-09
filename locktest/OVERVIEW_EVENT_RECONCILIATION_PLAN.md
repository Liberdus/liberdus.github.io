# Overview Event-Reconciliation Plan

## Summary

This document outlines a phased plan to add **block-resume caching** for the Overview
tab using **event reconciliation**. The goal is to reduce RPC load after the first
full scan by replaying events from the last processed block and updating a cached
lock map.

## Pros and Cons (at a glance)

**Pros**
- Significantly fewer RPC calls after the first full load.
- Faster Overview load times for large datasets.
- Scales better as active lock count grows.

**Cons**
- More complex logic (reorg buffers, dedupe, event ordering).
- Higher risk of subtle UI inconsistencies if reconciliation is wrong.
- `previewWithdrawable` still needs recompute (time-based).

## Phased Plan (numbered)

1) **Phase 1 — Cache schema + persistence**
   - Define a localStorage schema for:
     - `lastProcessedBlock`
     - `locksById` (map of lockId → lock data)
   - Add read/write helpers and versioning.

2) **Phase 2 — Full snapshot bootstrap**
   - Keep current snapshot logic for the first load.
   - After successful snapshot, persist:
     - `lastProcessedBlock = latestBlock`
     - `locksById` from `_locks`.

3) **Phase 3 — Event replay (read-only)**
   - On load, if cache exists:
     - Read `lastProcessedBlock`.
     - Fetch events from `lastProcessedBlock - reorgBuffer`.
   - Apply events to cached map:
     - `LockCreated` → add lock
     - `Unlocked` → update unlock fields
     - `Withdrawn` → update withdrawn
     - `LockClosed` / `Retracted` → remove lock
   - Update `lastProcessedBlock` and persist.

4) **Phase 4 — Validation + guardrails**
   - Add dedupe by `(txHash, logIndex)` when replaying.
   - Add sanity checks (e.g., active count mismatch triggers full refresh).

5) **Phase 5 — Optimize previewWithdrawable**
   - Recompute `previewWithdrawable` only for visible rows or on refresh.
   - Consider short TTL for computed values (seconds).

6) **Phase 6 — Production hardening**
   - Add telemetry or logging for cache hits/misses.
   - Add a manual “reset cache” option (or auto‑reset on failures).

