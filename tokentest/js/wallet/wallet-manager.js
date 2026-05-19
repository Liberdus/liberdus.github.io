import { createWalletCore } from '../../vendor/liberdus-wallet-module/index.js';

const WALLET_SESSION_KEY = 'liberdus_token_ui:wallet-session';

export class WalletManager {
  constructor() {
    this.walletCore = createWalletCore({
      storage: window.localStorage,
      walletSessionKey: WALLET_SESSION_KEY,
    });

    this.provider = null;
    this.signer = null;
    this.address = null;
    this.chainId = null;
    this.walletType = null;
    this._connectionPromise = null;
  }

  load() {
    this.walletCore.subscribe((event, data) => {
      if (event === 'connected') {
        this._syncFromCoreState();
        this._notify('connected');
        return;
      }

      if (event === 'disconnected' || (event === 'accountChanged' && !data)) {
        this._clearEthersState();
        this._notify('disconnected');
        return;
      }

      if ((event === 'accountChanged' || event === 'chainChanged') && !this._hasActiveWalletSession()) {
        return;
      }

      if (event === 'accountChanged' || event === 'chainChanged') {
        this._syncFromCoreState();
        this._notify(event);
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

  async connectWallet({ walletId } = {}) {
    if (this._connectionPromise) return this._connectionPromise;
    this._connectionPromise = this._connect(walletId);
    try {
      await this._connectionPromise;
    } finally {
      this._connectionPromise = null;
    }
  }

  async _connect(walletId) {
    if (this.isConnected()) return;

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
  }

  async disconnect() {
    await this.walletCore.disconnect();
  }

  async checkPreviousConnection() {
    try {
      await this.walletCore.sync();
    } catch {
      await this.walletCore.disconnect();
      this._clearEthersState();
      return false;
    }

    const state = this.walletCore.getState();
    if (!state.account) return false;

    this._syncFromCoreState();
    this._notify('connected', { restored: true });
    return true;
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

  _hasActiveWalletSession() {
    const state = this.walletCore.getState();
    return !!(state.sessionWalletId || state.selectedWalletId);
  }

  _clearEthersState() {
    this.provider = null;
    this.signer = null;
    this.address = null;
    this.chainId = null;
    this.walletType = null;
  }

  _notify(event, extra = {}) {
    const domEvent = {
      connected: 'walletConnected',
      disconnected: 'walletDisconnected',
      accountChanged: 'walletAccountChanged',
      chainChanged: 'walletChainChanged',
    }[event];

    document.dispatchEvent(new CustomEvent(domEvent, {
      detail: {
        event,
        data: {
          address: this.address,
          chainId: this.chainId,
          walletType: this.walletType,
          ...extra,
        },
      },
    }));
  }
}
