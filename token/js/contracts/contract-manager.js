import { CONFIG } from '../config.js';

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

    // Single read-only provider (Infura).
    // If this fails, surface a clear error rather than silently switching networks/providers.
    const rpcUrl = CONFIG.NETWORK.RPC_URL;
    if (!rpcUrl) throw new Error('Missing CONFIG.NETWORK.RPC_URL');

    const provider = new window.ethers.providers.JsonRpcProvider(rpcUrl);
    // Validate chainId early (helps catch misconfigured RPCs).
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== Number(CONFIG.NETWORK.CHAIN_ID)) {
      throw new Error(`Unexpected chainId ${network.chainId} (expected ${CONFIG.NETWORK.CHAIN_ID})`);
    }
    // Basic health check
    await provider.getBlockNumber();
    this.readOnlyProvider = provider;

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
    return this.contractWrite;
  }

  async getRequiredSignatures() {
    const contract = this.getReadContract();
    if (!contract) return null;

    // Fallback single call
    const v = await contract.REQUIRED_SIGNATURES();
    return Number(v.toString());
  }

  /**
   * Batch-load per-operation state (multicall preferred).
   * @param {string[]} operationIds bytes32 hex strings
   */
  async getOperationsBatch(operationIds) {
    const contract = this.getReadContract();
    if (!contract) return new Map();
    if (!Array.isArray(operationIds) || operationIds.length === 0) return new Map();

    // Fallback: parallel individual calls (slower, but works)
    const out = new Map();
    const results = await Promise.allSettled(
      operationIds.map(async (opId) => {
        const op = await contract.operations(opId);
        const expired = await contract.isOperationExpired(opId);
        return { opId, op, expired };
      })
    );

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

