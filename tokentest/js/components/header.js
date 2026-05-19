export class Header {
  constructor() {
    this.connectWalletBtn = null;
    this._connectBtnText = 'Connect Wallet';
    this._walletPicker = null;
  }

  load() {
    this.connectWalletBtn = document.getElementById('connect-wallet-btn');
    if (!this.connectWalletBtn) return;

    this._connectBtnText = this.connectWalletBtn.textContent.trim() || this._connectBtnText;
    this.connectWalletBtn.addEventListener('click', () => this.onConnectWalletClick());

    const refresh = () => this.updateConnectButtonStatus();
    document.addEventListener('walletConnected', refresh);
    document.addEventListener('walletDisconnected', refresh);
    document.addEventListener('walletAccountChanged', refresh);
    document.addEventListener('walletChainChanged', refresh);
    document.addEventListener('click', (event) => this._onDocumentClick(event));

    refresh();
  }

  async onConnectWalletClick() {
    const walletManager = window.walletManager;
    const networkManager = window.networkManager;
    const walletPopup = window.walletPopup;

    if (walletManager.isConnecting) return;

    if (walletManager.isConnected() && networkManager.isOnRequiredNetwork()) {
      walletPopup.toggle(this.connectWalletBtn);
      return;
    }

    if (walletManager.isConnected() && !networkManager.isOnRequiredNetwork()) {
      this.renderConnectButton({ text: 'Connecting to Polygon…', disabled: true });
      try {
        await networkManager.ensurePolygonNetwork();
      } catch {
        window.alert('Please connect to Polygon in your wallet.');
      } finally {
        this.updateConnectButtonStatus();
      }
      return;
    }

    this.renderConnectButton({ text: 'Connecting…', disabled: true });
    try {
      await walletManager.connectWallet();
    } catch (error) {
      if (error.code !== 'WALLET_SELECTION_REQUIRED') {
        window.alert(error.message || 'Failed to connect wallet');
        return;
      }

      try {
        const walletId = await this._pickWallet(error.wallets);
        await walletManager.connectWallet({ walletId });
      } catch (selectionError) {
        if (selectionError.message !== 'Wallet selection cancelled.') {
          window.alert(selectionError.message || 'Failed to connect wallet');
        }
      }
    } finally {
      this._closeWalletPicker();
      this.updateConnectButtonStatus();
    }
  }

  _pickWallet(wallets) {
    this._closeWalletPicker();

    return new Promise((resolve, reject) => {
      const navSection = this.connectWalletBtn.closest('.nav-section');
      const menu = document.createElement('div');
      menu.className = 'wallet-picker-menu';
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', 'Choose a wallet');

      const title = document.createElement('div');
      title.className = 'wallet-picker-menu__title';
      title.textContent = 'Choose a wallet';
      menu.appendChild(title);

      for (const wallet of wallets) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'wallet-picker-menu__item';
        item.setAttribute('role', 'menuitem');
        item.textContent = wallet.info?.name || 'Wallet';
        item.addEventListener('click', () => {
          const walletId = wallet.id;
          this._closeWalletPicker(false);
          resolve(walletId);
        });
        menu.appendChild(item);
      }

      navSection.classList.add('has-wallet-picker');
      navSection.appendChild(menu);
      this._walletPicker = { menu, reject };
    });
  }

  _closeWalletPicker(cancelled = true) {
    if (!this._walletPicker) return;

    if (cancelled) {
      this._walletPicker.reject(new Error('Wallet selection cancelled.'));
    }

    this._walletPicker.menu.remove();
    this.connectWalletBtn.closest('.nav-section').classList.remove('has-wallet-picker');
    this._walletPicker = null;
  }

  _onDocumentClick(event) {
    if (!this._walletPicker) return;
    if (this.connectWalletBtn.closest('.nav-section').contains(event.target)) return;
    this._closeWalletPicker();
    this.updateConnectButtonStatus();
  }

  updateConnectButtonStatus() {
    if (!this.connectWalletBtn) return;

    const walletManager = window.walletManager;
    const networkManager = window.networkManager;

    if (walletManager.isConnecting) {
      this.renderConnectButton({ text: 'Connecting…', disabled: true });
      return;
    }

    if (!walletManager.isConnected()) {
      this.renderConnectButton({ text: 'Connect Wallet', disabled: false });
      return;
    }

    if (!networkManager.isOnRequiredNetwork()) {
      this.renderConnectButton({ text: 'Connect to Polygon', disabled: false });
      return;
    }

    const address = walletManager.getAddress();
    const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected';
    this.renderConnectButton({ text: short, disabled: false, connected: true });
  }

  renderConnectButton({ text, disabled = false, connected = false }) {
    this.connectWalletBtn.textContent = text || this._connectBtnText;
    this.connectWalletBtn.disabled = disabled;
    this.connectWalletBtn.classList.toggle('is-connected', connected);
  }
}
