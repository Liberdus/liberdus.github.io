import { switchOrAddEthereumChain } from '../../vendor/liberdus-wallet-module/adapters/chain.js';
import { CONFIG } from '../config.js';
import { peekReadOnlyProvider } from '../utils/read-only-provider.js';

/**
 * NetworkManager
 * Polygon-only:
 * - Read-only mode uses CONFIG.NETWORK.RPC_URL
 * - Tx-enabled mode requires a connected wallet on Polygon
 */
export class NetworkManager {
  constructor({ walletManager } = {}) {
    this.walletManager = walletManager || null;
    this.requiredChainId = CONFIG.NETWORK.CHAIN_ID;
    this.requiredChainHex = this._toHexChainId(this.requiredChainId);
  }

  load() {
    document.addEventListener('walletConnected', () => this.updateUIState());
    document.addEventListener('walletDisconnected', () => this.updateUIState());
    document.addEventListener('walletAccountChanged', () => this.updateUIState());
    document.addEventListener('walletChainChanged', () => this.updateUIState());

    this.updateUIState();
  }

  isOnRequiredNetwork(chainId = null) {
    const cid = chainId ?? this.walletManager?.getChainId?.() ?? null;
    return Number(cid) === Number(this.requiredChainId);
  }

  isTxEnabled() {
    const connected = !!this.walletManager?.isConnected?.();
    return connected && this.isOnRequiredNetwork();
  }

  getReadOnlyProvider() {
    return peekReadOnlyProvider() || null;
  }

  getTxProvider() {
    return this.walletManager?.getProvider?.() || null;
  }

  getWalletProvider() {
    return this.walletManager?.getEip1193Provider?.() || null;
  }

  async ensurePolygonNetwork() {
    const provider = this.getWalletProvider();
    if (!provider) {
      throw new Error('Wallet not available');
    }

    await switchOrAddEthereumChain(provider, this.buildPolygonNetworkConfig());
    return true;
  }

  buildPolygonNetworkConfig() {
    return {
      chainId: this.requiredChainId,
      chainName: CONFIG.NETWORK.NAME,
      rpcUrls: [CONFIG.NETWORK.RPC_URL, ...(CONFIG.NETWORK.FALLBACK_RPCS || [])].filter(Boolean),
      nativeCurrency: CONFIG.NETWORK.NATIVE_CURRENCY,
      blockExplorerUrls: [CONFIG.NETWORK.BLOCK_EXPLORER].filter(Boolean),
    };
  }

  networkSymbol() {
    return CONFIG.NETWORK?.NATIVE_CURRENCY?.symbol || 'MATIC';
  }

  updateUIState() {
    this.updateTxGatedControls();
  }

  updateTxGatedControls() {
    const txEnabled = this.isTxEnabled();
    const gated = Array.from(document.querySelectorAll('[data-requires-tx="true"]'));
    gated.forEach((el) => {
      if (el.getAttribute('data-always-disabled') === 'true') return;

      if ('disabled' in el) {
        el.disabled = !txEnabled;
      }
      el.classList.toggle('is-disabled', !txEnabled);
    });
  }

  _toHexChainId(chainId) {
    return '0x' + Number(chainId).toString(16);
  }
}
