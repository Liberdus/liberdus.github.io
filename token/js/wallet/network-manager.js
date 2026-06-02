import { switchOrAddEthereumChain } from '../../vendor/liberdus-wallet-module/adapters/chain.js';
import { CONFIG } from '../config.js';

export class NetworkManager {
  constructor({ walletManager } = {}) {
    this.walletManager = walletManager;
    this.requiredChainId = CONFIG.NETWORK.CHAIN_ID;
  }

  load() {
    const refresh = () => this.updateTxGatedControls();
    document.addEventListener('walletConnected', refresh);
    document.addEventListener('walletDisconnected', refresh);
    document.addEventListener('walletAccountChanged', refresh);
    document.addEventListener('walletChainChanged', refresh);
    refresh();
  }

  isOnRequiredNetwork(chainId = null) {
    const cid = chainId ?? this.walletManager.getChainId();
    return Number(cid) === Number(this.requiredChainId);
  }

  isTxEnabled() {
    return this.walletManager.isConnected() && this.isOnRequiredNetwork();
  }

  async ensurePolygonNetwork() {
    const provider = this.walletManager.getEip1193Provider();
    if (!provider) throw new Error('Wallet not available');

    await switchOrAddEthereumChain(provider, {
      chainId: this.requiredChainId,
      chainName: CONFIG.NETWORK.NAME,
      rpcUrls: [CONFIG.NETWORK.RPC_URL, ...(CONFIG.NETWORK.FALLBACK_RPCS || [])].filter(Boolean),
      nativeCurrency: CONFIG.NETWORK.NATIVE_CURRENCY,
      blockExplorerUrls: [CONFIG.NETWORK.BLOCK_EXPLORER].filter(Boolean),
    });
  }

  networkSymbol() {
    return CONFIG.NETWORK.NATIVE_CURRENCY.symbol;
  }

  updateTxGatedControls() {
    const txEnabled = this.isTxEnabled();
    document.querySelectorAll('[data-requires-tx="true"]').forEach((el) => {
      if (el.getAttribute('data-always-disabled') === 'true') return;
      if ('disabled' in el) el.disabled = !txEnabled;
      el.classList.toggle('is-disabled', !txEnabled);
    });
  }
}
