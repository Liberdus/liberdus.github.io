import { CONFIG } from '../config.js';
import { getReadOnlyProvider } from '../utils/read-only-provider.js';
import { MulticallService } from '../utils/multicall-service.js';

/**
 * ContractManager (Phase 3)
 * - Loads ABI from `./abi.json` (repo root)
 * - Maintains read-only provider (Polygon RPC from config)
 * - When tx-enabled (MetaMask connected + on Polygon), uses wallet provider for reads
 *   and signer for writes.
 */
export class ContractManager {
  constructor({ walletManager, networkManager } = {}) {
    this.walletManager = walletManager || null;
    this.networkManager = networkManager || null;

    this.readOnlyProvider = null; // ethers.providers.JsonRpcProvider
    this.provider = null; // current provider for reads
    this.signer = null; // signer for writes (only when tx-enabled)

    this.abi = null;
    this.contractRead = null; // ethers.Contract (provider)
    this.contractWrite = null; // ethers.Contract (signer)

    // Multicall (batch read optimization)
    this.multicallService = null;
    this._multicallInitPromise = null;
    this._multicallProviderRef = null;

    // Parameters batch (Step 9.3)
    this._parametersCache = null;
    this._parametersCacheAt = 0;
    this._parametersCacheTtlMs = 15 * 1000;
    this._parametersBatchPromise = null;

    this._loadPromise = null;
  }

  load() {
    if (this._loadPromise) return this._loadPromise;
    this._loadPromise = this._load();
    return this._loadPromise;
  }

  async _load() {
    if (!window.ethers) {
      throw new Error('Ethers.js not loaded');
    }

    // Single shared read-only provider (best practice):
    // - Static network (avoids repeated eth_chainId calls)
    // - Singleton reused across app (avoids duplicate provider instances)
    this.readOnlyProvider = await getReadOnlyProvider();

    // Load ABI once.
    this.abi = await this._fetchAbi();

    // Build initial contracts based on current wallet/network state.
    this.updateConnections();

    // Keep contracts in sync with wallet lifecycle.
    document.addEventListener('walletConnected', () => this.updateConnections());
    document.addEventListener('walletDisconnected', () => this.updateConnections());
    document.addEventListener('walletAccountChanged', () => this.updateConnections());
    document.addEventListener('walletChainChanged', () => this.updateConnections());
  }

  async _fetchAbi() {
    const response = await fetch('./abi.json', { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load ABI (abi.json): ${response.status}`);
    }
    const json = await response.json();
    const abi = Array.isArray(json) ? json : json?.abi;
    if (!Array.isArray(abi)) {
      throw new Error('Invalid ABI format: expected { "abi": [...] }');
    }
    return abi;
  }

  updateConnections() {
    const txEnabled = !!this.networkManager?.isTxEnabled?.();

    if (txEnabled) {
      this.provider = this.walletManager?.getProvider?.() || this.readOnlyProvider;
      this.signer = this.walletManager?.getSigner?.() || null;
    } else {
      this.provider = this.readOnlyProvider;
      this.signer = null;
    }

    this.contractRead = this._makeContract(this.provider);
    this.contractWrite = this.signer ? this._makeContract(this.signer) : null;

    // If provider changed, force multicall to re-bind lazily on next use.
    if (this._multicallProviderRef !== this.provider) {
      this._multicallProviderRef = null;
      this._multicallInitPromise = null;
      // Keep the multicallService instance, but it will be re-initialized with the new provider.
    }

    // Clear cached batched reads on connection changes.
    this._parametersBatchPromise = null;
    this._parametersCache = null;
    this._parametersCacheAt = 0;

    document.dispatchEvent(
      new CustomEvent('contractManagerUpdated', {
        detail: {
          txEnabled,
          address: CONFIG.CONTRACT.ADDRESS,
          chainId: CONFIG.NETWORK.CHAIN_ID,
        },
      })
    );
  }

  _makeContract(signerOrProvider) {
    const address = CONFIG.CONTRACT.ADDRESS;
    if (!address) return null;
    if (!this.abi) return null;
    return new window.ethers.Contract(address, this.abi, signerOrProvider);
  }

  isReady() {
    return !!this.contractRead;
  }

  getReadOnlyProvider() {
    return this.readOnlyProvider;
  }

  getProvider() {
    return this.provider;
  }

  getSigner() {
    return this.signer;
  }

  getReadContract() {
    return this.contractRead;
  }

  getWriteContract() {
    const txEnabled = !!this.networkManager?.isTxEnabled?.();
    if (!txEnabled || !window.ethereum || !window.ethers) {
      return this.contractWrite;
    }

    // Create a fresh provider/signer for each write to avoid stale network caching.
    const freshProvider = new window.ethers.providers.Web3Provider(window.ethereum, 'any');
    const freshSigner = freshProvider.getSigner();
    return this._makeContract(freshSigner);
  }

  async getRequiredSignatures() {
    const contract = this.getReadContract();
    if (!contract) return null;

    // If a parameters batch is in-flight, wait for it and reuse.
    if (this._parametersBatchPromise) {
      try {
        await this._parametersBatchPromise;
      } catch {
        // ignore
      }
    }

    // If we have a recent batched read, reuse it.
    const cached = this._parametersCache?.requiredSignatures;
    if (cached != null) {
      const n = Number(cached?.toString?.() ?? cached);
      if (Number.isFinite(n)) return n;
    }

    // Fallback single call
    const v = await contract.REQUIRED_SIGNATURES();
    return Number(v.toString());
  }

  /**
   * Batch-load common contract parameters (multicall preferred).
   *
   * Returns raw decoded values (BigNumber/bool/address) and a `signers` array.
   * This is used to reduce many small `eth_call`s into ~1 multicall `eth_call`.
   */
  async getParametersBatch({ forceRefresh = false, cacheTtlMs } = {}) {
    const contract = this.getReadContract();
    if (!contract) return null;

    const ttlMs = Number.isFinite(cacheTtlMs) ? cacheTtlMs : this._parametersCacheTtlMs;
    const now = Date.now();
    if (!forceRefresh && this._parametersCache && now - this._parametersCacheAt < ttlMs) {
      return this._parametersCache;
    }

    // Deduplicate in-flight batches (even if forceRefresh was requested).
    if (this._parametersBatchPromise) {
      return await this._parametersBatchPromise;
    }

    this._parametersBatchPromise = (async () => {
      const out = {
        chainId: null,
        requiredSignatures: null,
        isPreLaunch: null,
        paused: null,
        bridgeInCaller: null,
        maxBridgeInAmount: null,
        bridgeInCooldown: null,
        lastMintTime: null,
        mintInterval: null,
        maxSupply: null,
        mintAmount: null,
        signers: [],
        symbol: null,
        decimals: null,
      };

      const hasFn = (name) => !!(contract && typeof contract[name] === 'function');

      const multicall = await this._getMulticallService();
      if (multicall && multicall.isReady?.()) {
        try {
          const calls = [];
          const meta = [];

          const addCall = (key, methodName, args = []) => {
            if (!hasFn(methodName)) return;
            calls.push(multicall.createCall(contract, methodName, args));
            meta.push({ key, methodName });
          };

          addCall('chainId', 'chainId');
          addCall('requiredSignatures', 'REQUIRED_SIGNATURES');
          addCall('isPreLaunch', 'isPreLaunch');
          addCall('paused', 'paused');
          addCall('bridgeInCaller', 'bridgeInCaller');
          addCall('maxBridgeInAmount', 'maxBridgeInAmount');
          addCall('bridgeInCooldown', 'bridgeInCooldown');
          addCall('lastMintTime', 'lastMintTime');
          addCall('mintInterval', 'MINT_INTERVAL');
          addCall('maxSupply', 'MAX_SUPPLY');
          addCall('mintAmount', 'MINT_AMOUNT');
          addCall('symbol', 'symbol');
          addCall('decimals', 'decimals');

          // Signers (UI currently renders up to 4)
          if (hasFn('signers')) {
            for (let i = 0; i < 4; i += 1) {
              calls.push(multicall.createCall(contract, 'signers', [i]));
              meta.push({ key: 'signers', methodName: 'signers', signerIndex: i });
            }
          }

          const results = await multicall.batchCall(calls, { requireSuccess: false, maxRetries: 0 });
          if (results && Array.isArray(results) && results.length === calls.length) {
            results.forEach((entry, idx) => {
              const m = meta[idx];
              const success = !!(entry && (entry.success ?? entry[0]));
              const returnData = entry ? (entry.returnData ?? entry[1]) : null;
              if (!success || !returnData) return;

              const decoded = multicall.decodeResult(contract, m.methodName, returnData);
              if (m.key === 'signers') {
                if (decoded) out.signers.push(String(decoded));
                return;
              }
              // Convert decimals to number if it's the decimals field
              if (m.key === 'decimals' && decoded != null) {
                out[m.key] = Number(decoded?.toString?.() ?? decoded);
              } else {
                out[m.key] = decoded;
              }
            });

            this._parametersCache = out;
            this._parametersCacheAt = Date.now();
            return out;
          }
        } catch {
          // Fall through to per-call fallback
        }
      }

      // Fallback: individual reads (best-effort)
      const safeCall = async (fnName, args = []) => {
        if (!hasFn(fnName)) return null;
        try {
          return await contract[fnName](...args);
        } catch {
          return null;
        }
      };

      const [
        chainId,
        requiredSignatures,
        isPreLaunch,
        paused,
        bridgeInCaller,
        maxBridgeInAmount,
        bridgeInCooldown,
        lastMintTime,
        mintInterval,
        maxSupply,
        mintAmount,
        symbol,
        decimals,
      ] = await Promise.all([
        safeCall('chainId'),
        safeCall('REQUIRED_SIGNATURES'),
        safeCall('isPreLaunch'),
        safeCall('paused'),
        safeCall('bridgeInCaller'),
        safeCall('maxBridgeInAmount'),
        safeCall('bridgeInCooldown'),
        safeCall('lastMintTime'),
        safeCall('MINT_INTERVAL'),
        safeCall('MAX_SUPPLY'),
        safeCall('MINT_AMOUNT'),
        safeCall('symbol'),
        safeCall('decimals'),
      ]);

      out.chainId = chainId;
      out.requiredSignatures = requiredSignatures;
      out.isPreLaunch = isPreLaunch;
      out.paused = paused;
      out.bridgeInCaller = bridgeInCaller;
      out.maxBridgeInAmount = maxBridgeInAmount;
      out.bridgeInCooldown = bridgeInCooldown;
      out.lastMintTime = lastMintTime;
      out.mintInterval = mintInterval;
      out.maxSupply = maxSupply;
      out.mintAmount = mintAmount;
      out.symbol = symbol || null;
      out.decimals = decimals != null ? Number(decimals?.toString?.() ?? decimals) : null;

      if (hasFn('signers')) {
        for (let i = 0; i < 4; i += 1) {
          const addr = await safeCall('signers', [i]);
          if (addr) out.signers.push(String(addr));
        }
      }

      // Fallback: fetch symbol and decimals if not already set
      if (out.symbol == null && hasFn('symbol')) {
        try {
          out.symbol = await contract.symbol();
        } catch {
          // ignore
        }
      }
      
      if (out.decimals == null && hasFn('decimals')) {
        try {
          const dec = await contract.decimals();
          out.decimals = dec != null ? Number(dec?.toString?.() ?? dec) : null;
        } catch {
          // ignore
        }
      }

      this._parametersCache = out;
      this._parametersCacheAt = Date.now();
      return out;
    })();

    try {
      return await this._parametersBatchPromise;
    } finally {
      this._parametersBatchPromise = null;
    }
  }

  getTokenSymbol() {
    // Try to get from cached parameters first
    const batch = this._parametersCache;
    if (batch?.symbol) {
      return String(batch.symbol);
    }
    
    // Return null if symbol not available from contract
    return null;
  }

  getTokenDecimals() {
    const batch = this._parametersCache;
    if (batch?.decimals != null) {
      return Number(batch.decimals);
    }
    return 18; // Default ERC20 decimals
  }

  getMintAmount() {
    const batch = this._parametersCache;
    if (batch?.mintAmount != null) {
      try {
        return window.ethers.BigNumber.isBigNumber(batch.mintAmount)
          ? batch.mintAmount
          : window.ethers.BigNumber.from(batch.mintAmount);
      } catch {
        return null;
      }
    }
    return null;
  }

  async _getMulticallService() {
    const provider = this.provider || this.readOnlyProvider;
    const chainId = Number(CONFIG?.NETWORK?.CHAIN_ID);
    if (!provider || !Number.isFinite(chainId)) return null;

    // If already initialized with current provider, reuse.
    if (
      this.multicallService &&
      this.multicallService.isReady?.() &&
      this._multicallProviderRef === provider
    ) {
      return this.multicallService;
    }

    // Deduplicate init while in-flight.
    if (this._multicallInitPromise) {
      return await this._multicallInitPromise;
    }

    this._multicallInitPromise = (async () => {
      try {
        const svc = this.multicallService || new MulticallService();
        const ok = await svc.initialize(provider, chainId);
        if (!ok) return null;
        this.multicallService = svc;
        this._multicallProviderRef = provider;
        return svc;
      } catch {
        return null;
      } finally {
        this._multicallInitPromise = null;
      }
    })();

    return await this._multicallInitPromise;
  }

  /**
   * Batch-load per-operation state (multicall preferred).
   * @param {string[]} operationIds bytes32 hex strings
   */
  async getOperationsBatch(operationIds) {
    const contract = this.getReadContract();
    if (!contract) return new Map();
    if (!Array.isArray(operationIds) || operationIds.length === 0) return new Map();

    // Prefer Multicall: 1 RPC instead of 2N calls.
    const multicall = await this._getMulticallService();
    if (multicall && multicall.isReady?.()) {
      try {
        const calls = [];
        operationIds.forEach((opId) => {
          calls.push(multicall.createCall(contract, 'operations', [opId]));
          calls.push(multicall.createCall(contract, 'isOperationExpired', [opId]));
        });

        const results = await multicall.batchCall(calls, { requireSuccess: false, maxRetries: 0 });
        if (results && Array.isArray(results) && results.length === calls.length) {
          const out = new Map();
          for (let i = 0; i < operationIds.length; i++) {
            const opId = operationIds[i];
            const opEntry = results[i * 2];
            const expiredEntry = results[i * 2 + 1];

            const opSuccess = !!(opEntry && (opEntry.success ?? opEntry[0]));
            const opReturnData = opEntry ? (opEntry.returnData ?? opEntry[1]) : null;
            const expiredSuccess = !!(expiredEntry && (expiredEntry.success ?? expiredEntry[0]));
            const expiredReturnData = expiredEntry ? (expiredEntry.returnData ?? expiredEntry[1]) : null;

            if (!opSuccess || !opReturnData) continue;

            const op = multicall.decodeResult(contract, 'operations', opReturnData);
            const expired = expiredSuccess && expiredReturnData
              ? multicall.decodeResult(contract, 'isOperationExpired', expiredReturnData)
              : null;

            if (!op) continue;

            out.set(opId, {
              operationId: opId,
              opType: Number(op[0].toString()),
              target: op[1],
              value: op[2],
              data: op[3],
              numSignatures: Number(op[4].toString()),
              executed: !!op[5],
              deadline: Number(op[6].toString()),
              expired: !!expired,
            });
          }

          return out;
        }
      } catch {
        // Fall through to per-call fallback
      }
    }

    // Fallback: individual calls with small concurrency cap (Phase 9.5)
    const out = new Map();
    const results = await mapWithConcurrencySettled(operationIds, 4, async (opId) => {
      const op = await contract.operations(opId);
      const expired = await contract.isOperationExpired(opId);
      return { opId, op, expired };
    });

    results.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      const { opId, op, expired } = r.value;
      out.set(opId, {
        operationId: opId,
        opType: Number(op[0].toString()),
        target: op[1],
        value: op[2],
        data: op[3],
        numSignatures: Number(op[4].toString()),
        executed: !!op[5],
        deadline: Number(op[6].toString()),
        expired: !!expired,
      });
    });
    return out;
  }
}

async function mapWithConcurrencySettled(items, concurrency, fn) {
  const list = Array.isArray(items) ? items : [];
  const limit = Math.max(1, Number(concurrency) || 1);
  const results = new Array(list.length);

  let nextIndex = 0;
  async function worker() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= list.length) return;
      try {
        const value = await fn(list[i], i);
        results[i] = { status: 'fulfilled', value };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, list.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

