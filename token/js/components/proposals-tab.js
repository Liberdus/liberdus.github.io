import { CONFIG } from '../config.js';

export class ProposalsTab {
  constructor() {
    this.panel = null;

    this.listEl = null;
    this.loadMoreBtn = null;
    this.statusEl = null;
    this.countEl = null;
    this.refreshBtn = null;
    this.clearCacheBtn = null;

    this.pageSize = 25;
    // Minimum items to show from cache before triggering a fresh load (used in cache restoration logic)
    this.initialMinItems = 5;

    this._isLoading = false;
    this._allLogsLoaded = false; // whether we've fetched full historical logs once

    this._pendingEvents = []; // prefetched but not yet displayed (newest first)
    this._loadedEvents = []; // displayed (newest first)

    this._requiredSignatures = null; // fetched once per session (no persistent caching)

    // Cache / refresh
    this.cacheTtlMs = 5 * 60 * 1000;
    this.cacheMaxItems = 500;
    this._cacheSchemaVersion = 2;

    this._lastFetchedBlock = 0; // latest block number at time of last scan (for incremental refresh)
    this._refreshInFlight = false;
    this._resolvedThroughBlock = 0; // highest block where all proposals at/below are terminal
  }

  load() {
    this.panel = document.querySelector('.tab-panel[data-panel="proposals"]');
    if (!this.panel) return;

    this.panel.innerHTML = `
      <div class="panel-header">
        <h2>Proposals</h2>
        <p class="muted">Click a row for details.</p>
      </div>

      <div class="card">
        <div class="card-title-row">
          <div class="proposals-description">
            <p class="muted">
              Proposals for operations (Mint, Burn, Distribute, etc.) that require multiple signatures to execute.
            </p>
            <div class="proposals-status-list">
              <span class="muted" style="font-size: var(--font-size-sm);">Status: </span>
              <span class="status-items">
                <strong>Pending</strong>, <strong>Executed</strong>, <strong>Expired</strong>
              </span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="muted" data-proposals-status style="display:none;"></div>
            <button type="button" class="btn btn--ghost" data-proposals-refresh title="Refresh proposals">Refresh</button>
          </div>
        </div>
        <div class="proposal-list" data-proposals-list></div>
        <div class="proposal-footer">
          <button type="button" class="btn" data-proposals-load-more>Load more</button>
          <div class="muted" data-proposals-count></div>
        </div>
      </div>
    `;

    this.listEl = this.panel.querySelector('[data-proposals-list]');
    this.loadMoreBtn = this.panel.querySelector('[data-proposals-load-more]');
    this.statusEl = this.panel.querySelector('[data-proposals-status]');
    this.countEl = this.panel.querySelector('[data-proposals-count]');
    this.refreshBtn = this.panel.querySelector('[data-proposals-refresh]');
    this.clearCacheBtn = document.getElementById('proposals-clear-cache');

    this.loadMoreBtn?.addEventListener('click', () => this.loadMore());
    this.refreshBtn?.addEventListener('click', () => this.refresh());
    this.clearCacheBtn?.addEventListener('click', () => this._clearCacheAndReload());

    // When a signature is submitted from modal, refresh that row.
    document.addEventListener('proposalSigned', async (e) => {
      const opId = e?.detail?.operationId;
      if (!opId) return;
      await this.refreshOne(opId);
    });

    // When a new operation is requested (Phase 5), refresh proposals in background.
    document.addEventListener('operationRequested', async () => {
      // Mark cache stale-ish and pull new logs since lastFetchedBlock.
      await this._refreshNewEventsInBackground().catch(() => {});
      this._updateLoadMoreVisibility();
      this._renderCount();
    });

    // Restore cached proposals (if any) for instant reload UX.
    const cache = this._loadCache();
    if (cache) {
      const fresh = this._isCacheFresh(cache);
      this._applyCache(cache);
      this._renderLoadedFromState();
      this._renderCount();
      this._updateLoadMoreVisibility();

      // Re-hydrate currently visible rows (best-effort).
      this._ensureRequiredSignaturesAndHydrateVisible().catch(() => {});

      if (!fresh) {
        // Background refresh - no UI change needed
        this._refreshNewEventsInBackground().catch(() => {});
      }

      // If cache had nothing visible, do a normal load.
      if (this._loadedEvents.length < this.initialMinItems) {
        this.loadMore();
      }
      return;
    }

    // First-time visitors: normal load.
    this.loadMore();
  }

  async loadMore() {
    if (this._isLoading) return;
    // Allow draining prefetched items even when scanning is finished.
    if (this._allLogsLoaded && this._pendingEvents.length === 0) return;
    await this.loadProposalsPage();
  }

  async loadProposalsPage() {
    if (!this.listEl) return;
    const contractManager = window.contractManager;
    if (!contractManager?.isReady?.()) {
      this._setStatus('Contract not ready');
      return;
    }

    this._isLoading = true;
    this._setStatus('Loading…');
    this.loadMoreBtn.disabled = true;
    const toast = window.toastManager;
    const toastId = toast?.loading?.('Retrieving proposals…', { id: 'proposals-loading', delayMs: 250 });

    try {
      // Fetch all proposals in one getLogs call (if not already loaded), then display first page
      await this._fillPendingUntil(this.pageSize);

      if (this._pendingEvents.length === 0) {
        if (this._loadedEvents.length === 0) {
          this._setStatus('No proposals found');
        } else {
          this._setStatus('Done');
        }
        this._updateLoadMoreVisibility();
        this._renderCount();
        return;
      }

      const page = this._pendingEvents.splice(0, this.pageSize); // may be < pageSize
      this._loadedEvents.push(...page);

      // Render rows quickly from event data
      for (const ev of page) {
        this._appendRow(ev);
      }

      // Ensure required signatures exists (doesn't block initial row render)
      if (this._requiredSignatures == null) {
        this._requiredSignatures = await contractManager.getRequiredSignatures();
      }

      // Hydrate with on-chain details via multicall
      await this._hydrateRows(page.map((e) => e.operationId));

      this._setStatus(this._allLogsLoaded && this._pendingEvents.length === 0 ? 'Done' : 'Ready');
      this._renderCount();
      this._saveCache();
      toast?.dismiss?.(toastId);
    } catch (e) {
      this._setStatus('Error loading proposals');
      toast?.update?.(toastId, { type: 'error', title: 'Failed to load', message: e?.message || 'Failed to load proposals', timeoutMs: 0, dismissible: true });
    } finally {
      this._isLoading = false;
      // Update button state after _isLoading is set to false
      this._updateLoadMoreVisibility();
    }
  }

  async _fillPendingUntil(minCount) {
    const contractManager = window.contractManager;
    const provider = contractManager.getReadOnlyProvider();
    const contract = contractManager.getReadContract();
    const floorBlock = this._getScanFloorBlock();

    if (!provider || !contract) return;

    if (this._allLogsLoaded) return;
    // Skip fetch if we already have enough items in pending queue
    if (this._pendingEvents.length >= minCount) return;

    const latest = await provider.getBlockNumber();
    this._lastFetchedBlock = latest;

    // Fetch all proposals in one getLogs call (Infura supports full range)
    const topic = contract.interface.getEventTopic('OperationRequested');
    const logs = await provider.getLogs({
      address: contract.address,
      topics: [topic],
      fromBlock: floorBlock,
      toBlock: latest,
    });

    const parsed = this._parseLogs(contract, logs);
    this._pendingEvents.push(...parsed);
    this._pendingEvents = dedupeBy(this._pendingEvents, (x) => x.operationId);
    this._allLogsLoaded = true;
  }

  _parseLogs(contract, logs) {
    const parsed = (logs || [])
      .map((log) => {
        try {
          const ev = contract.interface.parseLog(log);
          return {
            operationId: String(ev.args.operationId || ev.args[0]),
            opType: Number(ev.args.opType?.toString?.() ?? ev.args[1]?.toString?.() ?? 0),
            requester: String(ev.args.requester || ev.args[2]),
            target: String(ev.args.target || ev.args[3]),
            value: ev.args.value || ev.args[4],
            data: String(ev.args.data || ev.args[5]),
            deadline: Number((ev.args.deadline || ev.args[6]).toString()),
            timestamp: Number((ev.args.timestamp || ev.args[7]).toString()),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Sort newest first (block desc, logIndex desc)
    parsed.sort((a, b) => {
      if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber;
      return (b.logIndex || 0) - (a.logIndex || 0);
    });

    return parsed;
  }

  async _hydrateRows(operationIds) {
    const contractManager = window.contractManager;
    const detailsMap = await contractManager.getOperationsBatch(operationIds);
    const eventMap = new Map(
      [...this._loadedEvents, ...this._pendingEvents].map((ev) => [ev.operationId, ev])
    );

    for (const opId of operationIds) {
      const details = detailsMap.get(opId);
      if (!details) continue;

      const row = this.listEl.querySelector(`[data-proposal-row="${opId}"]`);
      if (!row) continue;

      const required = details.opType === 7 ? 2 : (this._requiredSignatures ?? '?');
      const sigs = `${details.numSignatures}/${required}`;

      row.querySelector('[data-proposal-sigs]')?.replaceChildren(document.createTextNode(sigs));
      row.querySelector('[data-proposal-executed]')?.replaceChildren(document.createTextNode(details.executed ? 'Executed' : (details.expired ? 'Expired' : 'Pending')));

      row.classList.toggle('is-executed', !!details.executed);
      row.classList.toggle('is-expired', !!details.expired);

      const ev = eventMap.get(opId);
      if (ev) {
        ev.executed = !!details.executed;
        ev.expired = !!details.expired;
      }
    }

    this._recomputeResolvedThroughBlock();
  }

  async refreshOne(operationId) {
    if (!this.listEl) return;
    const contractManager = window.contractManager;
    const detailsMap = await contractManager.getOperationsBatch([operationId]);
    await this._hydrateRows([operationId]);
  }

  async refresh() {
    if (this._refreshInFlight) return;
    const originalText = this.refreshBtn?.textContent || 'Refresh';
    this.refreshBtn?.setAttribute('disabled', '');
    this.refreshBtn && (this.refreshBtn.textContent = 'Refreshing…');
    try {
      await this._refreshNewEventsInBackground();
      this._updateLoadMoreVisibility();
      this._renderCount();
    } catch (e) {
      this._setStatus('Error refreshing');
      window.toastManager?.error?.('Failed to refresh proposals', { message: e?.message || 'Unknown error', timeoutMs: 0, dismissible: true });
    } finally {
      this.refreshBtn?.removeAttribute('disabled');
      this.refreshBtn && (this.refreshBtn.textContent = originalText);
    }
  }

  async _ensureRequiredSignaturesAndHydrateVisible() {
    const contractManager = window.contractManager;
    if (!contractManager?.isReady?.()) return;

    if (this._requiredSignatures == null) {
      try {
        this._requiredSignatures = await contractManager.getRequiredSignatures();
      } catch {
        // keep null; UI will display '?' as denominator
      }
    }

    const visible = this._loadedEvents.slice(0, this.pageSize).map((e) => e.operationId);
    if (visible.length === 0) return;
    await this._hydrateRows(visible);
  }

  _appendRow(ev) {
    const typeLabel = operationEnumToString(ev.opType);
    const when = ev.timestamp ? new Date(ev.timestamp * 1000).toLocaleString() : '';
    const shortOpId = shortHex(ev.operationId);

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'proposal-row';
    row.setAttribute('data-proposal-row', ev.operationId);

    row.innerHTML = `
      <div class="proposal-row-main">
        <div class="proposal-row-top">
          <div class="proposal-opid"><code>${shortOpId}</code></div>
          <div class="proposal-status" data-proposal-executed>Loading…</div>
        </div>
        <div class="proposal-row-bottom">
          <div class="proposal-meta">${typeLabel} • ${when}</div>
          <div class="proposal-sigs" data-proposal-sigs>—</div>
        </div>
      </div>
    `;

    row.addEventListener('click', () => {
      window.proposalDetailModal?.open?.({
        event: ev,
        requiredSignatures: this._requiredSignatures,
      });
    });

    this.listEl.appendChild(row);
  }

  _setStatus(text) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    // Only show status for loading/error states, hide for "Ready" and "Done"
    const shouldShow = text && text !== 'Ready' && text !== 'Done';
    this.statusEl.style.display = shouldShow ? '' : 'none';
  }

  _renderCount() {
    if (!this.countEl) return;
    const shown = this._loadedEvents.length;
    const pending = this._pendingEvents.length;
    const suffix = pending > 0 ? ` (+${pending} prefetched)` : '';
    this.countEl.textContent = `Showing ${shown}${suffix}`;
  }

  _updateLoadMoreVisibility() {
    if (!this.loadMoreBtn) return;
    const noMore = this._allLogsLoaded && this._pendingEvents.length === 0;
    this.loadMoreBtn.classList.toggle('hidden', noMore);
    // Enable button if not loading and there are more items (either prefetched or not yet scanned)
    this.loadMoreBtn.disabled = this._isLoading || noMore;
  }

  _renderLoadedFromState() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    for (const ev of this._loadedEvents) {
      this._appendRow(ev);
    }
  }

  _getCacheKey() {
    const chainId = Number(CONFIG?.NETWORK?.CHAIN_ID || 0);
    const address = String(CONFIG?.CONTRACT?.ADDRESS || '').toLowerCase();
    if (!chainId || !address) return null;
    return `liberdus_token_ui:proposals:v${this._cacheSchemaVersion}:${chainId}:${address}`;
  }

  _isCacheFresh(cache) {
    const ts = Number(cache?.cachedAtMs || 0);
    if (!ts) return false;
    return Date.now() - ts < this.cacheTtlMs;
  }

  _loadCache() {
    const key = this._getCacheKey();
    if (!key) return null;
    try {
      const raw = window.localStorage?.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);

      const schemaOk = Number(parsed?.schemaVersion) === this._cacheSchemaVersion;
      const chainOk = Number(parsed?.chainId) === Number(CONFIG?.NETWORK?.CHAIN_ID || 0);
      const addrOk =
        String(parsed?.contractAddress || '').toLowerCase() === String(CONFIG?.CONTRACT?.ADDRESS || '').toLowerCase();
      const depOk = Number(parsed?.deploymentBlock) === Number(CONFIG?.CONTRACT?.DEPLOYMENT_BLOCK || 0);

      if (!schemaOk || !chainOk || !addrOk || !depOk) return null;
      if (!Array.isArray(parsed?.events)) return null;

      return parsed;
    } catch {
      return null;
    }
  }

  _applyCache(cache) {
    const events = Array.isArray(cache?.events) ? cache.events : [];
    
    // Limit initial render to initialMinItems (5) for fast first paint
    // This prevents "Loading..." rows beyond what we hydrate immediately
    const visibleCount = Math.min(this.initialMinItems, events.length);

    this._loadedEvents = events.slice(0, visibleCount);
    this._pendingEvents = events.slice(visibleCount);

    this._allLogsLoaded = !!cache?.allLogsLoaded;
    this._lastFetchedBlock = Number(cache?.lastFetchedBlock || 0) || this._lastFetchedBlock;
    this._resolvedThroughBlock = Number(cache?.resolvedThroughBlock || 0) || this._resolvedThroughBlock;
  }

  _saveCache() {
    const key = this._getCacheKey();
    if (!key) return;

    const chainId = Number(CONFIG?.NETWORK?.CHAIN_ID || 0);
    const contractAddress = String(CONFIG?.CONTRACT?.ADDRESS || '').toLowerCase();
    const deploymentBlock = Number(CONFIG?.CONTRACT?.DEPLOYMENT_BLOCK || 0);
    const opStart = Number(CONFIG?.CONTRACT?.OPERATION_REQUESTED_START_BLOCK || 0) || 0;

    const combined = dedupeBy([...this._loadedEvents, ...this._pendingEvents], (x) => x.operationId);
    const wasTruncated = combined.length > this.cacheMaxItems;
    const capped = combined.slice(0, this.cacheMaxItems);
    const loadedCount = Math.min(this._loadedEvents.length, capped.length);

    const payload = {
      schemaVersion: this._cacheSchemaVersion,
      chainId,
      contractAddress,
      deploymentBlock,
      operationRequestedStartBlock: opStart,
      cachedAtMs: Date.now(),
      lastFetchedBlock: this._lastFetchedBlock || null,
      allLogsLoaded: this._allLogsLoaded,
      resolvedThroughBlock: this._resolvedThroughBlock || null,
      eventsTruncated: wasTruncated,
      loadedCount,
      events: capped,
    };

    try {
      window.localStorage?.setItem(key, JSON.stringify(payload));
    } catch {
      // Ignore quota errors; cache is best-effort.
    }
  }

  _clearCacheAndReload() {
    const key = this._getCacheKey();
    if (key) {
      try {
        window.localStorage?.removeItem(key);
      } catch {
        // ignore
      }
    }

    // Reset state
    this._pendingEvents = [];
    this._loadedEvents = [];
    this._allLogsLoaded = false;
    this._requiredSignatures = null;
    this._lastFetchedBlock = 0;
    this._resolvedThroughBlock = 0;

    if (this.listEl) this.listEl.innerHTML = '';
    this._setStatus('Cleared cache');
    this._renderCount();
    this.loadMoreBtn?.classList.remove('hidden');

    // Reload
    this.loadMore();
  }

  async _refreshNewEventsInBackground() {
    if (this._refreshInFlight) return;
    this._refreshInFlight = true;

    try {
      const contractManager = window.contractManager;
      const provider = contractManager?.getReadOnlyProvider?.();
      const contract = contractManager?.getReadContract?.();
      if (!provider || !contract) return;

      const latestNow = await provider.getBlockNumber();
      if (!latestNow) return;

      const last = Number(this._lastFetchedBlock || 0);
      const floorBlock = this._getScanFloorBlock();
      if (!last || latestNow <= last) {
        // Nothing new; refresh visible hydration only.
        await this._ensureRequiredSignaturesAndHydrateVisible();
        this._setStatus('Ready');
        return;
      }

      const topic = contract.interface.getEventTopic('OperationRequested');
      const logs = await provider.getLogs({
        address: contract.address,
        topics: [topic],
        fromBlock: Math.max(last + 1, floorBlock),
        toBlock: latestNow,
      });

      const newEvents = this._parseLogs(contract, logs);
      if (newEvents.length === 0) {
        this._lastFetchedBlock = latestNow;
        this._saveCache();
        this._setStatus('Ready');
        return;
      }

      const existingIds = new Set(this._loadedEvents.map((e) => e.operationId));
      const toInsert = newEvents.filter((e) => !existingIds.has(e.operationId));

      // Prepend to state
      this._loadedEvents = [...toInsert, ...this._loadedEvents];
      this._lastFetchedBlock = latestNow;

      // Update DOM: insert new rows at top, preserving newest-first ordering.
      if (this.listEl && toInsert.length > 0) {
        for (let i = toInsert.length - 1; i >= 0; i--) {
          const ev = toInsert[i];
          const before = this.listEl.firstChild;
          // Reuse renderer by temporarily appending then moving; simplest to keep behavior consistent.
          this._appendRow(ev);
          const appended = this.listEl.lastChild;
          if (before && appended) this.listEl.insertBefore(appended, before);
        }
      }

      this._renderCount();
      this._saveCache();
      await this._ensureRequiredSignaturesAndHydrateVisible();
      this._setStatus('Ready');
    } finally {
      this._refreshInFlight = false;
    }
  }

  _getScanFloorBlock() {
    const deploymentBlock = Number(CONFIG?.CONTRACT?.DEPLOYMENT_BLOCK || 0);
    const opStartBlock = Number(CONFIG?.CONTRACT?.OPERATION_REQUESTED_START_BLOCK || 0);
    const baseFloor = Math.max(deploymentBlock, opStartBlock || 0);
    const resolvedFloor = Number(this._resolvedThroughBlock || 0);
    return Math.max(baseFloor, resolvedFloor + 1);
  }

  _recomputeResolvedThroughBlock() {
    if (!this._allLogsLoaded) return;

    const combined = dedupeBy([...this._loadedEvents, ...this._pendingEvents], (x) => x.operationId);
    if (combined.length === 0) return;

    // Only advance if we are confident we haven't truncated history.
    if (combined.length >= this.cacheMaxItems && !this._resolvedThroughBlock) return;

    const sorted = combined.slice().sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
      return (a.logIndex || 0) - (b.logIndex || 0);
    });

    let candidate = null;
    for (const ev of sorted) {
      if (!ev?.blockNumber) continue;
      const isTerminal = ev.executed === true || ev.expired === true;
      if (!isTerminal) break;
      candidate = ev.blockNumber;
    }

    if (candidate != null) {
      this._resolvedThroughBlock = Math.max(this._resolvedThroughBlock || 0, candidate);
    }
  }
}

function operationEnumToString(op) {
  switch (Number(op)) {
    case 0: return 'Mint';
    case 1: return 'Burn';
    case 2: return 'PostLaunch';
    case 3: return 'Pause';
    case 4: return 'Unpause';
    case 5: return 'SetBridgeInCaller';
    case 6: return 'SetBridgeInLimits';
    case 7: return 'UpdateSigner';
    case 8: return 'Distribute';
    default: return 'Unknown';
  }
}

function shortHex(hex) {
  if (!hex) return '';
  return `${hex.slice(0, 10)}…${hex.slice(-6)}`;
}

function dedupeBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}
