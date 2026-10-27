import { CONFIG } from '../config.js';
import { formatSignatureProgress } from '../utils/proposal-helpers.js';

// Infura Polygon allows 10,000 blocks per eth_getLogs request.
const MAX_GET_LOGS_BLOCK_SPAN = 9999;
const PROPOSALS_PER_LOAD = 3;
// Automatic initial loading checks at most 50,000 blocks, including empty ranges.
const HISTORY_SCAN_CHUNKS_PER_LOAD = 5;
const GET_LOGS_CHUNK_DELAY_MS = 500;
const OPERATION_COUNT_TTL_MS = 30 * 1000;

export class ProposalsTab {
  constructor() {
    this.panel = null;

    this.listEl = null;
    this.loadMoreBtn = null;
    this.statusEl = null;
    this.countEl = null;
    this.refreshBtn = null;
    this.clearCacheBtn = null;

    this.pageSize = PROPOSALS_PER_LOAD;
    // Minimum items to show from cache before triggering a fresh load (used in cache restoration logic)
    this.initialMinItems = PROPOSALS_PER_LOAD;

    this._isLoading = false;
    this._statusIsProgress = false;
    this._allLogsLoaded = false; // whether we've fetched full historical logs once

    this._pendingEvents = []; // prefetched but not yet displayed (newest first)
    this._loadedEvents = []; // displayed (newest first)

    this._requiredSignatures = null; // fetched once per session (no persistent caching)
    this._operationCount = null; // fetched from operationCount() and persisted with proposal cache
    this._operationCountFetchedAtMs = 0;

    // Cache / refresh
    this.cacheTtlMs = 5 * 60 * 1000;
    this._cacheSchemaVersion = 5; // Bumped to add operationCount metadata

    this._lastFetchedBlock = 0; // end of the last successfully completed check for new events
    this._nextScanToBlock = null; // next older block to scan when loading historical proposal logs
    this._initialScanHead = null; // frozen target until the first newest chunk succeeds

    // Filters
    this._filterOpType = null; // null = all, or number (0-8)
    this._filterStatus = null; // null = all, or 'Pending', 'Executed', 'Expired'

    // Phase 9.4: lazy tab loading
    this._isActive = false;
    this._needsRefresh = false;
    this._refreshQueued = false;
    this._cacheWasFresh = false;
    this._refreshDebounceTimer = null;
    this._lastRefreshAtMs = 0;
    this._activationRefreshMinIntervalMs = 30 * 1000;
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
        <div class="card-title-row proposals-heading">
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
          <div class="proposals-actions">
            <div class="muted proposals-status" data-proposals-status role="status" aria-live="polite" aria-busy="false" style="display:none;"></div>
            <button type="button" class="btn btn--ghost" data-proposals-refresh title="Refresh proposals">Refresh</button>
          </div>
        </div>
        <div class="proposals-filters">
          <label class="filter-field">
            <span class="filter-label">Operation</span>
            <select class="field-input" data-proposals-filter-optype>
              <option value="">All Operations</option>
              <option value="0">Mint</option>
              <option value="1">Burn</option>
              <option value="8">Distribute</option>
              <option value="2">PostLaunch</option>
              <option value="3">Pause</option>
              <option value="4">Unpause</option>
              <option value="5">SetBridgeInCaller</option>
              <option value="6">SetBridgeInLimits</option>
              <option value="7">UpdateSigner</option>
            </select>
          </label>
          <label class="filter-field">
            <span class="filter-label">Status</span>
            <select class="field-input" data-proposals-filter-status>
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Executed">Executed</option>
              <option value="Expired">Expired</option>
            </select>
          </label>
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
    this.filterOpTypeEl = this.panel.querySelector('[data-proposals-filter-optype]');
    this.filterStatusEl = this.panel.querySelector('[data-proposals-filter-status]');

    this.loadMoreBtn?.addEventListener('click', () => this.loadMore());
    this.refreshBtn?.addEventListener('click', () => this.refresh());
    this.clearCacheBtn?.addEventListener('click', () => this._clearCacheAndReload());
    this.filterOpTypeEl?.addEventListener('change', () => this._onFilterChange());
    this.filterStatusEl?.addEventListener('change', () => this._onFilterChange());

    // When a signature is submitted from modal, refresh that row.
    document.addEventListener('proposalSigned', async (e) => {
      const opId = e?.detail?.operationId;
      if (!opId) return;
      if (!this._isActive) {
        this._needsRefresh = true;
        return;
      }
      await this.refreshOne(opId);
    });

    // When a new operation is requested (Phase 5), refresh proposals in background.
    document.addEventListener('operationRequested', (e) => this._onOperationRequested(e.detail?.successMessageHtml));

    document.addEventListener('readRpcRetry', () => {
      if (this._isLoading && this._statusIsProgress) this._setStatus('Connection interrupted. Retrying…', true);
    });

    document.addEventListener('tabActivated', (e) => {
      if (e?.detail?.tabName === 'proposals') this._onActivated();
    });
    document.addEventListener('tabDeactivated', (e) => {
      if (e?.detail?.tabName === 'proposals') this._onDeactivated();
    });

    // Restore filters from localStorage (before loading cache/events)
    this._restoreFilters();

    // Restore cached proposals (if any) for instant reload UX (no RPC here).
    const cache = this._loadCache();
    if (cache) {
      const fresh = this._isCacheFresh(cache);
      this._cacheWasFresh = fresh;
      this._lastRefreshAtMs = Number(cache?.cachedAtMs || 0) || 0;
      this._applyCache(cache);
      this._renderLoadedFromState();
      this._renderCount();
      this._updateLoadMoreVisibility();
      return;
    }

    // First-time visitors: render empty state and wait for activation to fetch.
    this._cacheWasFresh = false;
    this._renderLoadedFromState();
    this._renderCount();
    this._updateLoadMoreVisibility();
    this._setStatus('Ready');
  }

  _onActivated() {
    this._isActive = true;

    // Check stale existing state before continuing older history, even with a partial page.
    const hasAnyState = this._lastFetchedBlock > 0 || this._loadedEvents.length > 0 || this._pendingEvents.length > 0;
    const staleForRefresh =
      !this._lastRefreshAtMs || Date.now() - this._lastRefreshAtMs > this._activationRefreshMinIntervalMs;
    if (hasAnyState && (this._needsRefresh || !this._cacheWasFresh || staleForRefresh)) {
      this._scheduleBackgroundRefresh();
    } else if (this._loadedEvents.length < this.initialMinItems && !this._hasNoMoreEventsToLoad()) {
      this.loadProposalsPage(PROPOSALS_PER_LOAD, HISTORY_SCAN_CHUNKS_PER_LOAD).catch(() => {});
    } else {
      this._runProposalJob(async () => {
        this._setStatus('Updating proposal status…', true);
        await this._ensureRequiredSignaturesAndHydrateVisible();
      }, false).catch(() => {});
    }
  }

  _onDeactivated() {
    this._isActive = false;
    if (this._refreshDebounceTimer) {
      clearTimeout(this._refreshDebounceTimer);
      this._refreshDebounceTimer = null;
    }
  }

  _scheduleBackgroundRefresh() {
    this._needsRefresh = true;
    this._refreshQueued = true;
    if (this._isLoading || !this._isActive) return;
    if (this._refreshDebounceTimer) clearTimeout(this._refreshDebounceTimer);
    this._refreshDebounceTimer = setTimeout(() => {
      this._refreshDebounceTimer = null;
      if (this._isActive) this.refresh(false).catch(() => {});
    }, 250);
  }

  _onOperationRequested(successMessageHtml) {
    if (this._isLoading && successMessageHtml) {
      window.toastManager?.update?.('propose-success', {
        title: 'Proposal confirmed',
        message: `${successMessageHtml}<br><br>Another search is running; a refresh is queued for the Proposals tab.`,
        allowHtml: true,
      });
    }
    this._scheduleBackgroundRefresh();
  }

  _showBusyToast() {
    window.toastManager?.show?.({
      id: 'proposals-busy',
      message: 'Currently loading proposals. Please wait.',
      timeoutMs: 2500,
    });
  }

  async _runProposalJob(work, manual) {
    if (this._isLoading) {
      if (manual) this._showBusyToast();
      else this._scheduleBackgroundRefresh();
      return;
    }

    this._isLoading = true;
    this.statusEl?.classList?.toggle('is-loading', true);
    this.statusEl?.setAttribute?.('aria-busy', 'true');
    this._setStatus('Loading proposals…', true);
    try {
      await work();
    } catch (error) {
      this._setStatus('Unable to finish proposal checks. Please try again.');
      throw error;
    } finally {
      this._isLoading = false;
      this.statusEl?.classList?.toggle('is-loading', false);
      this.statusEl?.setAttribute?.('aria-busy', 'false');
      if (this._statusIsProgress) this._setStatus('Ready');
      this._updateLoadMoreVisibility();
      if (this._refreshQueued && this._isActive) this._scheduleBackgroundRefresh();
    }
  }

  async loadMore() {
    await this.loadProposalsPage(this.pageSize, Infinity, true);
  }

  async loadProposalsPage(pageSize, maxScanChunks = HISTORY_SCAN_CHUNKS_PER_LOAD, manual = false) {
    await this._runProposalJob(() => this._loadProposalsPage(pageSize, maxScanChunks), manual);
  }

  async _loadProposalsPage(pageSize, maxScanChunks) {
    if (!this.listEl || this._hasNoMoreEventsToLoad()) return false;

    const contractManager = window.contractManager;
    if (!contractManager?.isReady?.()) {
      this._setStatus('Contract not ready');
      return false;
    }

    this._setStatus('Searching older proposals…', true);
    const toast = window.toastManager;
    const toastId = toast?.loading?.('Retrieving proposals…', { id: 'proposals-loading', delayMs: 250 });

    try {
      await this._fillHistoryPage(pageSize, maxScanChunks);

      if (this._hasNoMoreEventsToLoad()) {
        this._setStatus(this._loadedEvents.length === 0 ? 'No proposals found' : 'All proposal history loaded');
      } else {
        this._setStatus(this._allLogsLoaded
          ? 'More proposals available. Select Load more to continue.'
          : 'More history remains. Select Load more to continue.');
      }
      this._renderCount();
      this._saveCache();
      this._cacheWasFresh = true;
      this._lastRefreshAtMs = Date.now();
      toast?.dismiss?.(toastId);
      return true;
    } catch (e) {
      if (isRateLimitError(e)) {
        this._setStatus('Rate limited. Select Load more to retry shortly.');
        toast?.dismiss?.(toastId);
      } else {
        this._setStatus('Loading stopped. Select Load more to retry.');
        toast?.update?.(toastId, { type: 'error', title: 'Failed to load', message: e?.message || 'Failed to load proposals', timeoutMs: 0, dismissible: true });
      }
      return false;
    }
  }

  _hasNoMoreEventsToLoad() {
    return this._pendingEvents.length === 0 && this._allLogsLoaded;
  }

  async _ensureOperationCount(forceRefresh = false) {
    const now = Date.now();
    if (
      !forceRefresh &&
      this._operationCount != null &&
      now - this._operationCountFetchedAtMs < OPERATION_COUNT_TTL_MS
    ) {
      return this._operationCount;
    }

    const contract = window.contractManager?.getReadContract?.();
    if (!contract || typeof contract.operationCount !== 'function') return this._operationCount;

    try {
      const value = await contract.operationCount();
      const count = Number(value?.toString?.() ?? value);
      if (!Number.isFinite(count)) return this._operationCount;

      this._operationCount = count;
      this._operationCountFetchedAtMs = Date.now();

      this._renderCount();
      this._updateLoadMoreVisibility();
      this._saveCache();
      return this._operationCount;
    } catch {
      // The count is informational; its failure cannot prevent log discovery.
      return this._operationCount;
    }
  }

  async _fillHistoryPage(pageSize, maxScanChunks = HISTORY_SCAN_CHUNKS_PER_LOAD) {
    const contractManager = window.contractManager;
    const provider = contractManager.getReadOnlyProvider();
    const contract = contractManager.getReadContract();
    const floorBlock = this._getScanFloorBlock();

    if (!provider || !contract) return;

    const initialLoadedCount = this._loadedEvents.length;
    const targetLoadedCount = initialLoadedCount + pageSize;
    await this._showPendingUntil(targetLoadedCount);
    if (this._allLogsLoaded || this._loadedEvents.length >= targetLoadedCount) return;

    await this._ensureOperationCount();

    const topic = contract.interface.getEventTopic('OperationRequested');
    if (!this._lastFetchedBlock && this._initialScanHead == null) {
      const head = Number(await provider.getBlockNumber());
      if (!Number.isSafeInteger(head) || head < floorBlock) {
        throw new Error('RPC returned a head before the proposal history. Try again.');
      }
      this._initialScanHead = head;
      this._saveCache();
    }
    let toBlock = this._lastFetchedBlock ? this._nextScanToBlock : this._initialScanHead;
    if (toBlock == null || toBlock < floorBlock) return;

    let chunksScanned = 0;
    let blocksSearched = 0;
    while (
      this._loadedEvents.length < targetLoadedCount &&
      !this._allLogsLoaded &&
      chunksScanned < maxScanChunks
    ) {
      const chunkTo = toBlock;
      const chunkFrom = Math.max(floorBlock, chunkTo - MAX_GET_LOGS_BLOCK_SPAN);
      this._setHistoryProgress(this._loadedEvents.length - initialLoadedCount, pageSize, blocksSearched);
      const logs = await getLogsWithFallback(provider, {
        address: contract.address,
        topics: [topic],
        fromBlock: chunkFrom,
        toBlock: chunkTo,
      });

      const existingIds = new Set(
        [...this._loadedEvents, ...this._pendingEvents].map((e) => e.operationId)
      );
      const parsed = this._parseLogs(contract, logs).filter((e) => {
        if (existingIds.has(e.operationId)) return false;
        existingIds.add(e.operationId);
        return true;
      });
      this._pendingEvents.push(...parsed);

      if (!this._lastFetchedBlock) {
        this._lastFetchedBlock = this._initialScanHead;
        this._initialScanHead = null;
      }

      chunksScanned += 1;
      blocksSearched += chunkTo - chunkFrom + 1;
      if (chunkFrom <= floorBlock) {
        this._allLogsLoaded = true;
        this._nextScanToBlock = null;
      } else {
        toBlock = chunkFrom - 1;
        this._nextScanToBlock = toBlock;
      }

      this._saveCache();
      await this._showPendingUntil(targetLoadedCount);
      this._setHistoryProgress(this._loadedEvents.length - initialLoadedCount, pageSize, blocksSearched);
      if (
        !this._allLogsLoaded &&
        this._loadedEvents.length < targetLoadedCount &&
        chunksScanned < maxScanChunks
      ) {
        await sleep(GET_LOGS_CHUNK_DELAY_MS);
      }
    }
  }

  _setHistoryProgress(foundCount, targetCount, blocksSearched) {
    this._setStatus(`Searching older proposals… Found ${foundCount} of ${targetCount} · searched ${blocksSearched.toLocaleString()} blocks`, true);
  }

  async _showPendingUntil(targetLoadedCount) {
    const page = this._pendingEvents.splice(0, Math.max(0, targetLoadedCount - this._loadedEvents.length));
    if (page.length === 0) return;
    this._loadedEvents.push(...page);
    this._renderLoadedFromState();
    this._renderCount();
    this._saveCache();
    // Rows are usable before optional details finish or the next range is requested.
    await this._hydrateProposalRows(page.map((event) => event.operationId));
  }

  _parseLogs(contract, logs) {
    // Decode the whole chunk before its events or completed range can be committed.
    const parsed = (logs || []).map((log) => {
      const ev = contract.interface.parseLog(log);
      const rawValue = ev.args.value || ev.args[4];

      // Preserve uint256 precision, including values restored from JSON.
      let value = rawValue;
      if (rawValue && window.ethers?.BigNumber?.isBigNumber?.(rawValue)) {
        value = rawValue;
      } else if (rawValue && typeof rawValue === 'object' && rawValue.type === 'BigNumber' && rawValue.hex) {
        value = window.ethers?.BigNumber?.from?.(rawValue.hex) || rawValue;
      } else if (rawValue != null && window.ethers?.BigNumber) {
        value = window.ethers.BigNumber.from(rawValue);
      }

      return {
        operationId: String(ev.args.operationId || ev.args[0]),
        opType: Number(ev.args.opType?.toString?.() ?? ev.args[1]?.toString?.() ?? 0),
        requester: String(ev.args.requester || ev.args[2]),
        target: String(ev.args.target || ev.args[3]),
        value,
        data: String(ev.args.data || ev.args[5]),
        deadline: Number((ev.args.deadline || ev.args[6]).toString()),
        timestamp: Number((ev.args.timestamp || ev.args[7]).toString()),
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      };
    });

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

      const ev = eventMap.get(opId);
      if (ev) {
        const oldStatus = this._getProposalStatus(ev);
        ev.executed = details.executed;
        ev.expired = details.expired;
        ev.numSignatures = Number(details.numSignatures);
        const newStatus = this._getProposalStatus(ev);
        
        // If status filter is active and status changed, re-render filtered view
        if (this._filterStatus != null && oldStatus !== newStatus) {
          this._renderLoadedFromState();
          this._renderCount();
        }
      }

      // Update DOM row if it's currently rendered (it may be filtered out).
      const row = this.listEl?.querySelector?.(`[data-proposal-row="${opId}"]`);
      if (row) {
        row.querySelector('[data-proposal-sigs]')?.replaceChildren(
          document.createTextNode(formatSignatureProgress(details.numSignatures, this._requiredSignatures))
        );
        row.querySelector('[data-proposal-executed]')?.replaceChildren(
          document.createTextNode(this._getProposalStatus(details))
        );
        row.classList.toggle('is-executed', details.executed === true);
        row.classList.toggle('is-expired', details.expired === true && details.executed !== true);
      }
    }
  }

  async refreshOne(operationId) {
    if (!this.listEl) return;
    await this._runProposalJob(async () => {
      this._setStatus('Updating proposal status…', true);
      await this._hydrateProposalRows([operationId]);
    }, false);
  }

  async refresh(manual = true) {
    await this._runProposalJob(async () => {
      this._refreshQueued = false;
      this._needsRefresh = false;
      if (this._refreshDebounceTimer) {
        clearTimeout(this._refreshDebounceTimer);
        this._refreshDebounceTimer = null;
      }
      if (this.refreshBtn) this.refreshBtn.textContent = 'Refreshing…';
      this._setStatus('Checking recent proposals…', true);
      try {
        const completed = await this._refreshNewEventsInBackground();
        if (completed === false) {
          this._needsRefresh = true;
          return;
        }
        this._cacheWasFresh = true;
        this._lastRefreshAtMs = Date.now();
        this._renderCount();
      } catch (e) {
        this._needsRefresh = true;
        this._setStatus('Refresh stopped. Select Refresh to retry.');
        window.toastManager?.error?.('Failed to refresh proposals', { message: e?.message || 'Unknown error', timeoutMs: 0, dismissible: true });
      } finally {
        if (this.refreshBtn) this.refreshBtn.textContent = 'Refresh';
      }
    }, manual);
  }

  async _ensureRequiredSignaturesAndHydrateVisible() {
    const contractManager = window.contractManager;
    if (!contractManager?.isReady?.()) return;

    const visibleEvents = this._loadedEvents.slice(0, this.pageSize);

    // Only hydrate rows that can still change (pending/unknown).
    const pendingIds = visibleEvents
      .filter((e) => !(e?.executed === true || e?.expired === true))
      .map((e) => e.operationId)
      .filter(Boolean);
    await this._hydrateProposalRows(pendingIds);
  }

  _appendRow(ev) {
    const typeLabel = operationEnumToString(ev.opType);
    const when = ev.timestamp ? new Date(ev.timestamp * 1000).toLocaleString() : '';
    const shortOpId = shortHex(ev.operationId);
    const status = this._getProposalStatus(ev);
    const sigsText = formatSignatureProgress(ev.numSignatures, this._requiredSignatures);

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'proposal-row';
    row.setAttribute('data-proposal-row', ev.operationId);
    row.classList.toggle('is-executed', status === 'Executed');
    row.classList.toggle('is-expired', status === 'Expired' && status !== 'Executed');

    row.innerHTML = `
      <div class="proposal-row-main">
        <div class="proposal-row-top">
          <div class="proposal-opid"><code>${shortOpId}</code></div>
          <div class="proposal-status" data-proposal-executed>${status}</div>
        </div>
        <div class="proposal-row-bottom">
          <div class="proposal-meta">${typeLabel} • ${when}</div>
          <div class="proposal-sigs" data-proposal-sigs>${sigsText}</div>
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

  _setStatus(text, inProgress = false) {
    // A helper cannot dismiss the active job's loading feedback.
    if (this._isLoading && (text === 'Ready' || text === 'Done')) return;
    this._statusIsProgress = inProgress;
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    // Only show status for loading/error states, hide for "Ready" and "Done"
    const shouldShow = this._isLoading || (text && text !== 'Ready' && text !== 'Done');
    this.statusEl.style.display = shouldShow ? '' : 'none';
  }

  _renderCount() {
    if (!this.countEl) return;
    const filtered = this._getFilteredEvents();
    const shown = filtered.length;
    const total = this._loadedEvents.length;
    const pending = this._pendingEvents.length;
    const suffix = pending > 0 ? ` (+${pending} prefetched)` : '';
    const filterSuffix = shown < total ? ` (filtered from ${total})` : '';
    const totalSuffix = this._operationCount != null ? ` of ${this._operationCount} proposals` : '';
    this.countEl.textContent = `Showing ${shown}${filterSuffix}${totalSuffix}${suffix}`;
  }

  _updateLoadMoreVisibility() {
    if (!this.loadMoreBtn) return;
    const noMore = this._hasNoMoreEventsToLoad();
    this.loadMoreBtn.classList.toggle('hidden', noMore);
    // Keep busy actions reachable so the shared guard can explain why they cannot run.
    this.loadMoreBtn.disabled = noMore;
  }

  _renderLoadedFromState() {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    const filtered = this._getFilteredEvents();
    for (const ev of filtered) {
      this._appendRow(ev);
    }
  }

  _getFilteredEvents() {
    return this._loadedEvents.filter((ev) => {
      // Filter by operation type
      if (this._filterOpType != null) {
        if (ev.opType !== this._filterOpType) return false;
      }

      // Filter by status
      if (this._filterStatus != null) {
        if (this._getProposalStatus(ev) !== this._filterStatus) return false;
      }

      return true;
    });
  }

  _getProposalStatus(event) {
    if (event.executed === true) return 'Executed';
    if (event.expired === true) return 'Expired';
    if (event.executed === false && event.expired === false) return 'Pending';
    return 'Unknown';
  }

  _onFilterChange() {
    const opTypeValue = this.filterOpTypeEl?.value || '';
    const statusValue = this.filterStatusEl?.value || '';

    this._filterOpType = opTypeValue === '' ? null : Number(opTypeValue);
    this._filterStatus = statusValue === '' ? null : statusValue;

    this._saveFilters();
    this._renderLoadedFromState();
    this._renderCount();
  }

  _restoreFilters() {
    try {
      const key = this._getFilterCacheKey();
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.opType !== undefined) {
          this._filterOpType = parsed.opType === null ? null : Number(parsed.opType);
          if (this.filterOpTypeEl) {
            this.filterOpTypeEl.value = parsed.opType === null ? '' : String(parsed.opType);
          }
        }
        if (parsed.status !== undefined) {
          this._filterStatus = parsed.status;
          if (this.filterStatusEl) {
            this.filterStatusEl.value = parsed.status || '';
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  _saveFilters() {
    try {
      const key = this._getFilterCacheKey();
      const data = {
        opType: this._filterOpType,
        status: this._filterStatus,
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      // Ignore storage errors
    }
  }

  _getFilterCacheKey() {
    const chainId = Number(CONFIG?.NETWORK?.CHAIN_ID || 0);
    const address = String(CONFIG?.CONTRACT?.ADDRESS || '').toLowerCase();
    return `liberdus_token_ui:proposals:filters:v1:${chainId}:${address}`;
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
    
    // Restore BigNumber instances from serialized format (localStorage converts them to {type: 'BigNumber', hex: '...'})
    // Also handle cases where value might be stored as a plain number (shouldn't happen, but defensive)
    const restored = events.map((ev) => {
      if (ev && typeof ev === 'object') {
        const restored = { ...ev };
        // Restore value if it's a serialized BigNumber
        if (restored.value && typeof restored.value === 'object' && restored.value.type === 'BigNumber' && restored.value.hex) {
          try {
            restored.value = window.ethers?.BigNumber?.from?.(restored.value.hex) || restored.value;
          } catch {
            // Keep original if conversion fails
          }
        } else if (typeof restored.value === 'number' && window.ethers?.BigNumber) {
          // If value is stored as a plain number (shouldn't happen, but handle it defensively)
          try {
            restored.value = window.ethers.BigNumber.from(restored.value);
          } catch {
            // Keep original if conversion fails
          }
        } else if (typeof restored.value === 'string' && !restored.value.startsWith('0x') && window.ethers?.BigNumber) {
          // If value is stored as a decimal string, convert to BigNumber
          try {
            restored.value = window.ethers.BigNumber.from(restored.value);
          } catch {
            // Keep original if conversion fails
          }
        }
        return restored;
      }
      return ev;
    });
    
    // Limit initial render to initialMinItems for fast first paint
    // This prevents "Loading..." rows beyond what we hydrate immediately
    const visibleCount = Math.min(this.initialMinItems, restored.length);

    this._loadedEvents = restored.slice(0, visibleCount);
    this._pendingEvents = restored.slice(visibleCount);

    this._allLogsLoaded = !!cache?.allLogsLoaded;
    this._lastFetchedBlock = Number(cache?.lastFetchedBlock || 0);
    this._nextScanToBlock =
      cache?.nextScanToBlock == null ? null : Number(cache.nextScanToBlock);
    this._initialScanHead = cache?.initialScanHead == null ? null : Number(cache.initialScanHead);
    this._operationCount =
      cache?.operationCount == null ? null : Number(cache.operationCount);
    this._operationCountFetchedAtMs =
      this._operationCount == null
        ? 0
        : (Number(cache?.cachedAtMs || 0) || 0);
  }

  _saveCache() {
    const key = this._getCacheKey();
    if (!key) return;

    const chainId = Number(CONFIG?.NETWORK?.CHAIN_ID || 0);
    const contractAddress = String(CONFIG?.CONTRACT?.ADDRESS || '').toLowerCase();
    const deploymentBlock = Number(CONFIG?.CONTRACT?.DEPLOYMENT_BLOCK || 0);
    const opStart = Number(CONFIG?.CONTRACT?.OPERATION_REQUESTED_START_BLOCK || 0) || 0;

    const combined = dedupeBy([...this._loadedEvents, ...this._pendingEvents], (x) => x.operationId);

    const payload = {
      schemaVersion: this._cacheSchemaVersion,
      chainId,
      contractAddress,
      deploymentBlock,
      operationRequestedStartBlock: opStart,
      cachedAtMs: Date.now(),
      lastFetchedBlock: this._lastFetchedBlock || null,
      nextScanToBlock: this._nextScanToBlock,
      initialScanHead: this._initialScanHead,
      operationCount: this._operationCount ?? null,
      allLogsLoaded: this._allLogsLoaded,
      events: combined,
    };

    try {
      window.localStorage?.setItem(key, JSON.stringify(payload));
    } catch {
      // Ignore quota errors; cache is best-effort.
    }
  }

  _clearCacheAndReload() {
    if (this._isLoading) {
      this._showBusyToast();
      return;
    }
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
    this._operationCount = null;
    this._operationCountFetchedAtMs = 0;
    this._lastFetchedBlock = 0;
    this._nextScanToBlock = null;
    this._initialScanHead = null;

    if (this.listEl) this.listEl.innerHTML = '';
    this._setStatus('Cleared cache');
    this._renderCount();
    this.loadMoreBtn?.classList.remove('hidden');

    // Reload only if tab is active (Phase 9.4 lazy loading).
    if (this._isActive) {
      this.loadProposalsPage(
        PROPOSALS_PER_LOAD,
        HISTORY_SCAN_CHUNKS_PER_LOAD
      ).catch(() => {});
    } else {
      this._needsRefresh = true;
      this._setStatus('Ready');
    }
  }

  async _refreshNewEventsInBackground() {
    const contractManager = window.contractManager;
    const provider = contractManager?.getReadOnlyProvider?.();
    const contract = contractManager?.getReadContract?.();
    if (!provider || !contract) return false;

    if (!this._lastFetchedBlock) {
      return this._loadProposalsPage(PROPOSALS_PER_LOAD, HISTORY_SCAN_CHUNKS_PER_LOAD);
    }

    const latestNow = Number(await provider.getBlockNumber());
    if (!Number.isFinite(latestNow)) throw new Error('Invalid current block number');
    await this._ensureOperationCount(true);

    const last = Number(this._lastFetchedBlock || 0);
    const floorBlock = this._getScanFloorBlock();

    if (latestNow <= last) {
      // Nothing new; refresh visible hydration only.
      await this._hydrateProposalRows(this._loadedEvents.slice(0, this.pageSize).map((event) => event.operationId));
      this._setStatus('Ready');
      return;
    }

    const topic = contract.interface.getEventTopic('OperationRequested');
    for (let fromBlock = Math.max(last + 1, floorBlock); fromBlock <= latestNow; fromBlock += MAX_GET_LOGS_BLOCK_SPAN + 1) {
      const toBlock = Math.min(fromBlock + MAX_GET_LOGS_BLOCK_SPAN, latestNow);
      this._setStatus('Checking recent proposals…', true);
      const logs = await getLogsWithFallback(provider, {
        address: contract.address,
        topics: [topic],
        fromBlock,
        toBlock,
      });

      const events = this._parseLogs(contract, logs);
      this._mergeRefreshEvents(events);
      this._lastFetchedBlock = toBlock;
      this._renderLoadedFromState();
      this._renderCount();
      this._saveCache();

      if (events.length > 0) {
        await this._hydrateProposalRows([...new Set(events.map((event) => event.operationId))]);
      }
      if (toBlock < latestNow) await sleep(GET_LOGS_CHUNK_DELAY_MS);
    }

    await this._hydrateProposalRows(this._loadedEvents.slice(0, this.pageSize).map((event) => event.operationId));
    this._setStatus('Ready');
  }

  _mergeRefreshEvents(events) {
    const retained = new Map();
    for (const event of [...this._loadedEvents, ...this._pendingEvents]) {
      if (!retained.has(event.operationId)) retained.set(event.operationId, event);
    }

    let visibleCount = new Set(this._loadedEvents.map((event) => event.operationId)).size;
    for (const event of events) {
      if (retained.has(event.operationId)) continue;
      retained.set(event.operationId, event);
      visibleCount++;
    }

    const ordered = [...retained.values()].sort((a, b) => {
      if (b.blockNumber !== a.blockNumber) return b.blockNumber - a.blockNumber;
      return (b.logIndex || 0) - (a.logIndex || 0);
    });
    this._loadedEvents = ordered.slice(0, visibleCount);
    this._pendingEvents = ordered.slice(visibleCount);
  }

  async _hydrateProposalRows(operationIds) {
    if (this._requiredSignatures == null) {
      try {
        this._requiredSignatures = await window.contractManager.getRequiredSignatures();
      } catch {
        // A missing signature threshold does not prevent operation detail reads.
      }
    }
    try {
      if (operationIds.length > 0) await this._hydrateRows(operationIds);
    } catch {
      // Raw events and coverage were saved first; unknown details can be retried later.
    }
    this._renderLoadedFromState();
    this._renderCount();
    this._saveCache();
  }

  _getScanFloorBlock() {
    return Number(CONFIG?.CONTRACT?.DEPLOYMENT_BLOCK || 0);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getLogsWithFallback(provider, filter) {
  const from = Number(filter.fromBlock);
  const to = Number(filter.toBlock);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new Error('Invalid getLogs block range');
  }
  if (from > to) return [];
  try {
    return await provider.getLogs(filter);
  } catch (error) {
    if (!isLogLimitError(error)) {
      throw error;
    }
  }

  if (from >= to) {
    throw new Error('getLogs fallback failed to split range');
  }

  const mid = Math.floor((from + to) / 2);
  const left = await getLogsWithFallback(provider, { ...filter, fromBlock: from, toBlock: mid });
  await sleep(GET_LOGS_CHUNK_DELAY_MS);
  const right = await getLogsWithFallback(provider, { ...filter, fromBlock: mid + 1, toBlock: to });

  return [...left, ...right];
}

/**
 * Detect eth_getLogs "too many results" limit errors.
 *
 * Known behavior (from community reports, not always in official provider docs):
 * - Infura: message "query returned more than 10000 results"; some endpoints use RPC code -32005.
 * - Other providers may use different messages or codes.
 *
 * We check message (including nested error.error/data/reason) and code in common
 * nested shapes. If a provider uses a different format, the fallback won't trigger
 * and the error will surface; we can extend checks as needed.
 */
function isLogLimitError(error) {
  if (!error) return false;

  if (isRateLimitError(error)) return false;

  const code = Number(error?.code ?? error?.error?.code ?? error?.data?.code);
  if (code === -32005) return true;

  const message = getErrorMessage(error);
  if (!message) return false;

  return (
    message.includes('more than 10000') ||
    message.includes('10000 results') ||
    message.includes('too many results') ||
    message.includes('exceeds limit') ||
    message.includes('block range') ||
    /range\s+\d+\s+exceeds\s+limit\s+of\s+\d+/i.test(message) ||
    /query\s+returned\s+more\s+than\s+\d+\s+result/i.test(message)
  );
}

function isRateLimitError(error) {
  if (!error) return false;

  const message = getErrorMessage(error);
  return (
    message.includes('too many requests') ||
    message.includes('rate limit') ||
    message.includes('rate-limited')
  );
}

function getErrorMessage(error) {
  return [
    error?.message,
    error?.reason,
    error?.error?.message,
    error?.error?.data?.message,
    error?.data?.message,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
    .join(' ');
}
