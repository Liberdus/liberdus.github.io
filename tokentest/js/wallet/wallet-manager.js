import { createWalletCore } from '../../vendor/liberdus-wallet-module/index.js';

const DEFAULT_WALLET_SESSION_KEY = 'liberdus_token_ui:wallet-session';

/**
 * WalletManager
 * - Wraps liberdus-wallet-core for discovery, connect, and session restore
 * - Keeps the existing app-facing API (provider/signer getters, DOM events)
 */
export class WalletManager {
  constructor({ walletSessionKey = DEFAULT_WALLET_SESSION_KEY } = {}) {
    this.walletSessionKey = walletSessionKey;

    this.walletCore = createWalletCore({
      storage: typeof window !== 'undefined' ? window.localStorage : null,
      walletSessionKey,
    });

    this.provider = null; // ethers.providers.Web3Provider
    this.signer = null; // ethers.Signer
    this.address = null;
    this.chainId = null; // number
    this.walletType = null;

    this._connectionPromise = null;
    this._unsubscribeCore = null;

    this.listeners = new Set();
  }

  load() {
    this._unsubscribeCore = this.walletCore.subscribe((event, data) => {
      if (event === 'connected') {
        this._syncFromCoreState();
        this._notify('connected', {
          address: this.address,
          chainId: this.chainId,
          walletType: this.walletType,
        });
        return;
      }

      if (event === 'disconnected') {
        this._clearEthersState();
        this._notify('disconnected', {});
        return;
      }

      if (event === 'accountChanged') {
        if (!data) {
          this._clearEthersState();
          this._notify('disconnected', {});
          return;
        }

        this._syncFromCoreState();
        this._notify('accountChanged', { address: this.address, chainId: this.chainId });
        return;
      }

      if (event === 'chainChanged') {
        this._syncFromCoreState();
        this._notify('chainChanged', { address: this.address, chainId: this.chainId });
      }
    });
  }

  async init() {
    await this.checkPreviousConnection();
  }

  get isConnecting() {
    return !!this.walletCore.getState().isConnecting || !!this._connectionPromise;
  }

  isConnected() {
    return !!(this.address && this.provider && this.signer);
  }

  isWalletConnected() {
    return this.isConnected();
  }

  getAccount() {
    return this.address;
  }

  getAddress() {
    return this.address;
  }

  getChainId() {
    return this.chainId;
  }

  getProvider() {
    return this.provider;
  }

  getSigner() {
    return this.signer;
  }

  getEip1193Provider() {
    return this.walletCore.getEip1193Provider();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async getDiscoveredWallets() {
    return this.walletCore.discoverWallets();
  }

  async connectWallet({ walletId } = {}) {
    if (this._connectionPromise) return this._connectionPromise;
    this._connectionPromise = this._performConnectWallet({ walletId });
    try {
      return await this._connectionPromise;
    } finally {
      this._connectionPromise = null;
    }
  }

  async _performConnectWallet({ walletId } = {}) {
    if (this.isConnected()) {
      return {
        success: true,
        address: this.address,
        chainId: this.chainId,
        walletType: this.walletType,
      };
    }

    const wallets = await this.walletCore.discoverWallets();
    if (!wallets.length) {
      throw new Error('No compatible wallet was found in this browser.');
    }

    let selectedWalletId = walletId;
    if (!selectedWalletId) {
      if (wallets.length === 1) {
        selectedWalletId = wallets[0].id;
      } else {
        await this.walletCore.sync();
        const sessionWalletId = this.walletCore.getState().sessionWalletId;
        if (sessionWalletId && wallets.some((wallet) => wallet.id === sessionWalletId)) {
          selectedWalletId = sessionWalletId;
        } else {
          const error = new Error('Wallet selection required.');
          error.code = 'WALLET_SELECTION_REQUIRED';
          error.wallets = wallets;
          throw error;
        }
      }
    }

    await this.walletCore.connect({ walletId: selectedWalletId });
    this._syncFromCoreState();

    return {
      success: true,
      address: this.address,
      chainId: this.chainId,
      walletType: this.walletType,
    };
  }

  async disconnect() {
    await this.walletCore.disconnect();
  }

  async checkPreviousConnection() {
    try {
      await this.walletCore.sync();
      const state = this.walletCore.getState();
      if (!state.account) return false;

      this._syncFromCoreState();
      this._notify('connected', {
        address: this.address,
        chainId: this.chainId,
        walletType: this.walletType,
        restored: true,
      });
      return true;
    } catch {
      await this.walletCore.disconnect().catch(() => {});
      this._clearEthersState();
      return false;
    }
  }

  _syncFromCoreState() {
    const state = this.walletCore.getState();
    const injectedProvider = this.walletCore.getEip1193Provider();

    if (!state.account || !injectedProvider || !window.ethers) {
      this._clearEthersState();
      return;
    }

    this.provider = new window.ethers.providers.Web3Provider(injectedProvider);
    this.signer = this.provider.getSigner();
    this.address = state.account;
    this.chainId = state.chainId;
    this.walletType = state.selectedWalletName || 'wallet';
  }

  _clearEthersState() {
    this.provider = null;
    this.signer = null;
    this.address = null;
    this.chainId = null;
    this.walletType = null;
  }

  _notify(event, data) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, data);
      } catch {
        // ignore
      }
    });

    const eventNameMap = {
      connected: 'walletConnected',
      disconnected: 'walletDisconnected',
      accountChanged: 'walletAccountChanged',
      chainChanged: 'walletChainChanged',
    };
    const domName = eventNameMap[event] || `wallet${event.charAt(0).toUpperCase()}${event.slice(1)}`;
    document.dispatchEvent(new CustomEvent(domName, { detail: { event, data } }));
  }
}
