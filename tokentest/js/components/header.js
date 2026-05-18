export class Header {
  constructor() {
    this.connectWalletBtn = null;
    this._connectBtnText = 'Connect Wallet';
    this._walletPickerMenu = null;
  }

  load() {
    this.connectWalletBtn = document.getElementById('connect-wallet-btn');
    if (!this.connectWalletBtn) return;

    this._connectBtnText = this.connectWalletBtn.textContent?.trim() || this._connectBtnText;

    this.connectWalletBtn.addEventListener('click', () => this.onConnectWalletClick());

    document.addEventListener('walletConnected', () => this.updateConnectButtonStatus());
    document.addEventListener('walletDisconnected', () => this.updateConnectButtonStatus());
    document.addEventListener('walletAccountChanged', () => this.updateConnectButtonStatus());
    document.addEventListener('walletChainChanged', () => this.updateConnectButtonStatus());
    document.addEventListener('click', (event) => this._handleDocumentClick(event));

    this.updateConnectButtonStatus();
  }

  async onConnectWalletClick() {
    const btn = this.connectWalletBtn;
    if (!btn) return;

    const walletManager = window.walletManager;
    const networkManager = window.networkManager;
    const walletPopup = window.walletPopup;

    if (walletManager?.isConnecting) {
      return;
    }

    if (walletManager?.isConnected?.() && networkManager?.isOnRequiredNetwork?.()) {
      walletPopup?.toggle?.(btn);
      return;
    }

    if (walletManager?.isConnected?.() && !networkManager?.isOnRequiredNetwork?.()) {
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
      await this._connectSelectedWallet(walletManager);
    } catch (error) {
      if (error?.code === 'WALLET_SELECTION_REQUIRED') {
        try {
          const walletId = await this._promptWalletSelection(error.wallets || []);
          if (!walletId) return;
          await walletManager?.connectWallet?.({ walletId });
        } catch (selectionError) {
          if (selectionError?.message !== 'Wallet selection cancelled.') {
            window.alert(selectionError?.message || 'Failed to connect wallet');
          }
        }
      } else {
        window.alert(error?.message || 'Failed to connect wallet');
      }
    } finally {
      this.hideWalletPicker();
      this.updateConnectButtonStatus();
    }
  }

  async _connectSelectedWallet(walletManager) {
    const wallets = await walletManager?.getDiscoveredWallets?.();
    if (!wallets?.length) {
      throw new Error('No compatible wallet was found in this browser.');
    }

    if (wallets.length === 1) {
      await walletManager.connectWallet({ walletId: wallets[0].id });
      return;
    }

    await walletManager.connectWallet();
  }

  async _promptWalletSelection(wallets) {
    this.hideWalletPicker();

    if (!wallets.length) {
      throw new Error('No compatible wallet was found in this browser.');
    }

    return new Promise((resolve, reject) => {
      const menu = document.createElement('div');
      menu.className = 'wallet-picker-menu';
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', 'Choose a wallet');

      const title = document.createElement('div');
      title.className = 'wallet-picker-menu__title';
      title.textContent = 'Choose a wallet';
      menu.appendChild(title);

      wallets.forEach((wallet) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'wallet-picker-menu__item';
        item.setAttribute('role', 'menuitem');
        item.textContent = wallet.info?.name || 'Wallet';
        item.addEventListener('click', () => {
          const pending = this._walletSelectionPromise;
          this._walletSelectionPromise = null;
          this._removeWalletPickerMenu();
          pending?.resolve(wallet.id);
        });
        menu.appendChild(item);
      });

      const navSection = this.connectWalletBtn?.closest('.nav-section') || this.connectWalletBtn?.parentElement;
      if (!navSection) {
        reject(new Error('Wallet picker could not be displayed.'));
        return;
      }

      navSection.classList.add('has-wallet-picker');
      navSection.appendChild(menu);
      this._walletPickerMenu = menu;

      this._walletSelectionPromise = { resolve, reject };
    });
  }

  hideWalletPicker() {
    if (this._walletSelectionPromise) {
      this._walletSelectionPromise.reject(new Error('Wallet selection cancelled.'));
      this._walletSelectionPromise = null;
    }

    this._removeWalletPickerMenu();
  }

  _removeWalletPickerMenu() {
    if (this._walletPickerMenu) {
      this._walletPickerMenu.remove();
      this._walletPickerMenu = null;
    }

    this.connectWalletBtn?.closest('.nav-section')?.classList.remove('has-wallet-picker');
  }

  _handleDocumentClick(event) {
    if (!this._walletPickerMenu) return;

    const navSection = this.connectWalletBtn?.closest('.nav-section');
    if (navSection?.contains(event.target)) return;

    this.hideWalletPicker();
    this.updateConnectButtonStatus();
  }

  updateConnectButtonStatus() {
    const walletManager = window.walletManager;
    const networkManager = window.networkManager;

    if (!this.connectWalletBtn) return;

    if (walletManager?.isConnecting) {
      this.renderConnectButton({ text: 'Connecting…', disabled: true });
      return;
    }

    const isConnected = !!walletManager?.isConnected?.();
    const address = walletManager?.getAddress?.();
    const onPolygon = !!networkManager?.isOnRequiredNetwork?.();

    if (!isConnected) {
      this.renderConnectButton({ text: 'Connect Wallet', disabled: false });
      return;
    }

    if (!onPolygon) {
      this.renderConnectButton({ text: 'Connect to Polygon', disabled: false });
      return;
    }

    const short = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected';
    this.renderConnectButton({ text: short, disabled: false, connected: true });
  }

  renderConnectButton({ text, disabled = false, connected = false } = {}) {
    const btn = this.connectWalletBtn;
    if (!btn) return;

    btn.textContent = text || this._connectBtnText;
    btn.disabled = !!disabled;
    btn.classList.toggle('is-connected', !!connected);
  }
}
